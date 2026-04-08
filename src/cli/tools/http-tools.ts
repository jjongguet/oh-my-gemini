import type { CliToolDefinition } from './types.js';
import {
  createJsonResult,
  readNumber,
  readString,
  readStringMap,
  truncateText,
} from './common.js';

interface HttpToolFactoryOptions {
  defaultTimeoutMs?: number;
}

function normalizeMethod(value: string | undefined): string {
  const method = value?.trim().toUpperCase() ?? 'GET';

  if (!method) {
    return 'GET';
  }

  return method;
}

function parseUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('url must be a valid absolute URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('url protocol must be http or https.');
  }

  return parsed.toString();
}

export function createHttpTools(options: HttpToolFactoryOptions = {}): CliToolDefinition[] {
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 15_000;

  return [
    {
      category: 'http',
      name: 'omp_http_request',
      description: 'Perform an HTTP request and return status/headers/body.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'HTTP/HTTPS URL to request.' },
          method: { type: 'string', description: 'HTTP method (default: GET).' },
          headers: { type: 'object', description: 'Optional request headers map.' },
          body: {
            type: 'string',
            description: 'Optional raw request body. Use bodyJson for structured payloads.',
          },
          bodyJson: {
            type: 'object',
            description: 'Optional JSON body object (serialized automatically).',
          },
          timeoutMs: { type: 'number', description: 'Request timeout in milliseconds (default: 15000).' },
          maxBytes: { type: 'number', description: 'Maximum UTF-8 response bytes returned (default: 1000000).' },
        },
        required: ['url'],
      },
      async handler(args) {
        const safeArgs = args;
        const rawUrl = readString(safeArgs, 'url', { required: true }) ?? '';
        const url = parseUrl(rawUrl);
        const method = normalizeMethod(readString(safeArgs, 'method'));
        const headers = readStringMap(safeArgs, 'headers');
        const timeoutMs = readNumber(safeArgs, 'timeoutMs', {
          defaultValue: defaultTimeoutMs,
          min: 100,
          max: 120_000,
          integer: true,
        });
        const maxBytes = readNumber(safeArgs, 'maxBytes', {
          defaultValue: 1_000_000,
          min: 1,
          max: 5_000_000,
          integer: true,
        });

        const rawBody = readString(safeArgs, 'body', { trim: false });
        const bodyJson = safeArgs.bodyJson;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        let body: string | undefined;
        if (rawBody != null) {
          body = rawBody;
        } else if (bodyJson != null) {
          body = JSON.stringify(bodyJson);
          if (!Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
            headers['content-type'] = 'application/json';
          }
        }

        try {
          const response = await fetch(url, {
            method,
            headers,
            body,
            signal: controller.signal,
          });

          const responseBody = await response.text();
          const responseHeaders = Object.fromEntries(response.headers.entries());

          return createJsonResult({
            url,
            method,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: responseHeaders,
            body: truncateText(responseBody, maxBytes),
            bodyTruncated: Buffer.byteLength(responseBody, 'utf8') > maxBytes,
            bodyBytes: Buffer.byteLength(responseBody, 'utf8'),
          });
        } finally {
          clearTimeout(timeout);
        }
      },
    },
  ];
}
