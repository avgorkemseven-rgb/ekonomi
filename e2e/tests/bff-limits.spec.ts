import http from 'node:http';
import net from 'node:net';
import { expect, test } from '@playwright/test';
import sharp from 'sharp';

/**
 * Regression tests for bounded request bodies in the web and admin BFF proxies: oversized bodies are rejected without
 * the server buffering them, whatever Content-Length says (or doesn't), while normal uploads and token refresh work.
 */
const WEB = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:3000');
const ADMIN = new URL(process.env.E2E_ADMIN_URL ?? 'http://localhost:3001');
const MB = 1024 * 1024;

test.skip(({ isMobile }) => isMobile, 'transport-level tests run once (desktop project)');

interface StreamResult {
  status: number | null;
  bytesSentBeforeResponse: number;
  error?: string;
}

/** Streams `total` bytes with chunked encoding (no Content-Length) and records how much was sent before the response. */
function streamChunked(base: URL, path: string, total: number, extraHeaders: Record<string, string> = {}): Promise<StreamResult> {
  return new Promise((resolve) => {
    let sent = 0;
    let done = false;
    const req = http.request(
      {
        host: base.hostname,
        port: base.port,
        path,
        method: 'POST',
        headers: { Origin: base.origin, 'Content-Type': 'application/octet-stream', 'Transfer-Encoding': 'chunked', ...extraHeaders },
      },
      (res) => {
        done = true;
        res.resume();
        resolve({ status: res.statusCode ?? null, bytesSentBeforeResponse: sent });
        req.destroy();
      },
    );
    req.on('error', (e) => {
      if (!done) resolve({ status: null, bytesSentBeforeResponse: sent, error: e.message });
    });
    const chunk = Buffer.alloc(256 * 1024, 0x61);
    const pump = () => {
      while (!done && sent < total) {
        sent += chunk.length;
        if (!req.write(chunk)) return void req.once('drain', pump);
      }
      if (!done) req.end();
    };
    pump();
  });
}

/** Sends raw HTTP bytes and returns the status line's code. */
function rawRequest(base: URL, payload: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(Number(base.port), base.hostname, () => socket.write(payload));
    let data = '';
    socket.on('data', (d) => {
      data += d.toString('latin1');
      const m = data.match(/^HTTP\/1\.1 (\d{3})/);
      if (m) {
        resolve(Number(m[1]));
        socket.destroy();
      }
    });
    socket.on('error', reject);
    socket.setTimeout(10_000, () => reject(new Error('timeout')));
  });
}

for (const [name, base] of [
  ['web', WEB],
  ['admin', ADMIN],
] as const) {
  test.describe(`${name} BFF proxy body limit`, () => {
    test('rejects a declared oversized Content-Length before reading the body', async () => {
      const status = await new Promise<number | undefined>((resolve, reject) => {
        const req = http.request(
          { host: base.hostname, port: base.port, path: '/api/proxy/v1/listings', method: 'POST', headers: { Origin: base.origin, 'Content-Type': 'application/json', 'Content-Length': String(50 * MB) } },
          (res) => {
            res.resume();
            resolve(res.statusCode);
            req.destroy();
          },
        );
        req.on('error', reject);
        req.write('{'); // body never completes: a 413 proves the server did not wait to buffer it
      });
      expect(status).toBe(413);
    });

    test('stops reading a chunked body without Content-Length once it exceeds the limit', async () => {
      const result = await streamChunked(base, '/api/proxy/v1/listings', 64 * MB);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(413);
      // The server answered long before the client finished streaming 64 MB.
      expect(result.bytesSentBeforeResponse).toBeLessThan(40 * MB);
    });

    test('rejects a malformed Content-Length', async () => {
      const status = await rawRequest(
        base,
        `POST /api/proxy/v1/listings HTTP/1.1\r\nHost: ${base.host}\r\nOrigin: ${base.origin}\r\nContent-Type: application/json\r\nContent-Length: 12abc\r\nConnection: close\r\n\r\n{}`,
      );
      expect(status).toBe(400);
    });

    test('bounds the auth login body', async () => {
      const result = await streamChunked(base, '/api/auth/login', 2 * MB, { 'Content-Type': 'application/json' });
      expect(result.status).toBe(413);
    });
  });
}

test('normal JSON + photo uploads and token-refresh replay still work through the web proxy', async ({ playwright }) => {
  const ctx = await playwright.request.newContext({ baseURL: WEB.origin, extraHTTPHeaders: { Origin: WEB.origin } });
  const run = Date.now().toString(36);
  await ctx.post('/api/auth/register', {
    data: { email: `b${run}@e2e.kleps.local`, username: `b${run}`, password: 'Sifre12345', displayName: 'Limit Test' },
  }).then((r) => expect(r.status()).toBe(201));

  // Force the refresh path: invalid access cookie, valid refresh cookie. The buffered body must be replayed.
  const state = await ctx.storageState();
  const rt = state.cookies.find((c) => c.name === 'kleps_rt')!;
  await ctx.dispose();
  const ctx2 = await playwright.request.newContext({
    baseURL: WEB.origin,
    extraHTTPHeaders: { Origin: WEB.origin },
    storageState: { cookies: [rt, { ...rt, name: 'kleps_at', value: 'expired.or.invalid' }], origins: [] },
  });
  const categories = (await (await ctx2.get('/api/proxy/v1/categories')).json()) as { slug: string; children: { id: string; slug: string }[] }[];
  const darts = categories.find((c) => c.slug === 'dart')!.children.find((c) => c.slug === 'dart-oklari')!;
  const created = await ctx2.post('/api/proxy/v1/listings', { data: { categoryId: darts.id, title: `Limit testi dart ${run}` } });
  expect(created.status()).toBe(201);
  const listing = (await created.json()) as { id: string };
  expect((await ctx2.storageState()).cookies.find((c) => c.name === 'kleps_at')?.value).not.toBe('expired.or.invalid');

  // A realistic multi-megabyte photo goes through the bounded reader untouched.
  const noise = Buffer.alloc(1600 * 1200 * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24;
  const photo = await sharp(noise, { raw: { width: 1600, height: 1200, channels: 3 } }).jpeg({ quality: 100 }).toBuffer();
  expect(photo.length).toBeGreaterThan(1 * MB);
  const up = await ctx2.post(`/api/proxy/v1/listings/${listing.id}/images`, {
    multipart: { file: { name: 'big.jpg', mimeType: 'image/jpeg', buffer: photo } },
  });
  expect(up.status()).toBe(201);
  await ctx2.dispose();
});
