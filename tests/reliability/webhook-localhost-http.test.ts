import { createServer, type Server } from 'node:http';
import { describe, expect, test, afterAll, beforeAll } from 'vitest';

import {
  isLoopbackHost,
  validateHttpsUrl,
  sendJsonWebhook,
} from '../../src/notifications/webhook.js';

describe('isLoopbackHost', () => {
  test('recognises localhost variants', () => {
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('::1')).toBe(true);
    expect(isLoopbackHost('[::1]')).toBe(true);
  });

  test('rejects non-loopback hosts', () => {
    expect(isLoopbackHost('example.com')).toBe(false);
    expect(isLoopbackHost('192.168.1.1')).toBe(false);
    expect(isLoopbackHost('localhost.evil.com')).toBe(false);
    expect(isLoopbackHost('')).toBe(false);
  });
});

describe('validateHttpsUrl – localhost HTTP exception', () => {
  test('allows http://localhost', () => {
    const url = validateHttpsUrl('http://localhost:3000/hook', 'test');
    expect(url.protocol).toBe('http:');
    expect(url.hostname).toBe('localhost');
  });

  test('allows http://127.0.0.1', () => {
    const url = validateHttpsUrl('http://127.0.0.1:8080/hook', 'test');
    expect(url.protocol).toBe('http:');
    expect(url.hostname).toBe('127.0.0.1');
  });

  test('allows http://[::1]', () => {
    const url = validateHttpsUrl('http://[::1]:9090/hook', 'test');
    expect(url.protocol).toBe('http:');
    expect(url.hostname).toBe('[::1]');
  });

  test('rejects http:// for external hosts', () => {
    expect(() => validateHttpsUrl('http://example.com/hook', 'test')).toThrow(
      /must use HTTPS/i,
    );
  });

  test('rejects http:// for private-but-non-loopback IPs', () => {
    expect(() => validateHttpsUrl('http://192.168.1.1/hook', 'test')).toThrow(
      /must use HTTPS/i,
    );
    expect(() => validateHttpsUrl('http://10.0.0.1/hook', 'test')).toThrow(
      /must use HTTPS/i,
    );
  });

  test('still allows https:// for any host', () => {
    const url = validateHttpsUrl('https://example.com/hook', 'test');
    expect(url.protocol).toBe('https:');
  });

  test('still rejects missing / invalid URLs', () => {
    expect(() => validateHttpsUrl('', 'test')).toThrow(/required/i);
    expect(() => validateHttpsUrl('not-a-url', 'test')).toThrow(/invalid/i);
  });
});

describe('sendJsonWebhook – localhost HTTP round-trip', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ echo: JSON.parse(body) }));
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = server.address();
    port = typeof addr === 'object' && addr !== null ? addr.port : 0;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  test('delivers payload to localhost over plain HTTP', async () => {
    const result = await sendJsonWebhook({
      url: `http://127.0.0.1:${port}/webhook`,
      payload: { msg: 'hello' },
    });

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body!)).toStrictEqual({
      echo: { msg: 'hello' },
    });
  });

  test('rejects plain HTTP to external host without network call', async () => {
    const result = await sendJsonWebhook({
      url: 'http://example.com/webhook',
      payload: { msg: 'hello' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/must use HTTPS/i);
    expect(result.statusCode).toBeUndefined();
  });
});
