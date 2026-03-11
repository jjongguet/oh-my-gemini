import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

import { prependNotificationTags } from './tags.js';

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 64 * 1024;

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  body?: string;
  error?: string;
}

export interface JsonWebhookOptions {
  url: string;
  payload: unknown;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface SlackWebhookOptions {
  webhookUrl: string;
  text: string;
  username?: string;
  channel?: string;
  iconEmoji?: string;
  mention?: string;
  tagList?: string[];
  timeoutMs?: number;
}

export interface GenericWebhookOptions {
  url: string;
  payload?: Record<string, unknown>;
  message?: string;
  headers?: Record<string, string>;
  method?: 'POST' | 'PUT';
  timeoutMs?: number;
}

function normalizeTimeoutMs(timeoutMs: number | undefined): number {
  if (!Number.isInteger(timeoutMs) || (timeoutMs ?? 0) <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return timeoutMs as number;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isSuccessStatus(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 300;
}

function readResponseBody(chunks: Buffer[]): string {
  if (chunks.length === 0) {
    return '';
  }

  return Buffer.concat(chunks).toString('utf8');
}

export function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || hostname === '[::1]';
}

export function validateHttpsUrl(rawUrl: string, context: string): URL {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error(`${context}: URL is required`);
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`${context}: invalid URL`);
  }

  if (parsed.protocol === 'http:' && isLoopbackHost(parsed.hostname)) {
    return parsed;
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`${context}: URL must use HTTPS`);
  }

  return parsed;
}

export function validateSlackWebhookUrl(webhookUrl: string): URL {
  const parsed = validateHttpsUrl(webhookUrl, 'Slack webhook');

  const allowedHost =
    parsed.hostname === 'hooks.slack.com'
    || parsed.hostname.endsWith('.hooks.slack.com');

  if (!allowedHost) {
    throw new Error('Slack webhook: URL host must be hooks.slack.com');
  }

  return parsed;
}

export async function sendJsonWebhook(options: JsonWebhookOptions): Promise<WebhookDeliveryResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = validateHttpsUrl(options.url, 'Webhook');
  } catch (error) {
    return {
      success: false,
      error: formatError(error),
    };
  }

  const method = options.method ?? 'POST';
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs);
  const body = JSON.stringify(options.payload);

  return new Promise<WebhookDeliveryResult>((resolve) => {
    const requestFn = parsedUrl.protocol === 'http:' ? httpRequest : httpsRequest;
    const request = requestFn(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port ? Number(parsedUrl.port) : undefined,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method,
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body).toString(),
          ...(options.headers ?? {}),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let collectedBytes = 0;

        response.on('data', (chunk) => {
          const buffer = Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(String(chunk));

          if (collectedBytes >= MAX_RESPONSE_BYTES) {
            return;
          }

          const remaining = MAX_RESPONSE_BYTES - collectedBytes;
          const limitedChunk = buffer.subarray(0, remaining);
          chunks.push(limitedChunk);
          collectedBytes += limitedChunk.length;
        });

        response.on('end', () => {
          const statusCode = response.statusCode ?? 0;
          const responseBody = readResponseBody(chunks);

          if (!isSuccessStatus(statusCode)) {
            resolve({
              success: false,
              statusCode,
              body: responseBody,
              error: `HTTP ${statusCode}`,
            });
            return;
          }

          resolve({
            success: true,
            statusCode,
            body: responseBody,
          });
        });
      },
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Request timeout after ${timeoutMs}ms`));
    });

    request.on('error', (error) => {
      resolve({
        success: false,
        error: formatError(error),
      });
    });

    request.write(body);
    request.end();
  });
}

export function composeSlackText(
  text: string,
  mention: string | undefined,
  tagList: string[] | undefined,
): string {
  const body = text.trim();
  const tags = prependNotificationTags('', tagList, 'slack').trim();
  return [mention?.trim() || undefined, tags || undefined, body || undefined]
    .filter((value): value is string => Boolean(value))
    .join('\n');
}

export function prefixMessageWithTags(message: string, tagList: readonly string[] | undefined): string {
  return prependNotificationTags(message, tagList, 'webhook');
}

export async function sendSlackWebhook(
  options: SlackWebhookOptions,
): Promise<WebhookDeliveryResult> {
  let validatedWebhookUrl: URL;
  try {
    validatedWebhookUrl = validateSlackWebhookUrl(options.webhookUrl);
  } catch (error) {
    return {
      success: false,
      error: formatError(error),
    };
  }

  const payload: Record<string, unknown> = {
    text: composeSlackText(options.text, options.mention, options.tagList),
  };

  if (options.username) {
    payload.username = options.username;
  }

  if (options.channel) {
    payload.channel = options.channel;
  }

  if (options.iconEmoji) {
    payload.icon_emoji = options.iconEmoji;
  }

  return sendJsonWebhook({
    url: validatedWebhookUrl.toString(),
    payload,
    timeoutMs: options.timeoutMs,
  });
}

export async function sendGenericWebhook(options: GenericWebhookOptions): Promise<WebhookDeliveryResult> {
  const payload = options.payload ?? (options.message ? { message: options.message } : {});
  return sendJsonWebhook({
    url: options.url,
    payload,
    headers: options.headers,
    method: options.method,
    timeoutMs: options.timeoutMs,
  });
}
