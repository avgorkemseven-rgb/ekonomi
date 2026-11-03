/**
 * Bounded request-body reading for server-side proxies (web/admin BFF). Reads a web ReadableStream chunk by chunk
 * and stops — cancelling the source — as soon as more than `limit` bytes arrived, so memory use is bounded by
 * `limit` + one chunk regardless of Content-Length (absent with chunked encoding, or simply untrusted).
 */
export type LimitedBody = { ok: true; body: Uint8Array } | { ok: false; reason: 'too_large' };

export async function readBodyWithLimit(stream: ReadableStream<Uint8Array> | null, limit: number): Promise<LimitedBody> {
  if (!stream) return { ok: true, body: new Uint8Array(0) };
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel('request body too large').catch(() => undefined);
        return { ok: false, reason: 'too_large' };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, body };
}

/**
 * Validates a Content-Length header before reading. Returns 'too_large' when it declares more than `limit`,
 * 'invalid' when malformed, or 'ok' (also when absent — the streaming limit still applies).
 */
export function checkDeclaredLength(header: string | null, limit: number): 'ok' | 'too_large' | 'invalid' {
  if (header === null) return 'ok';
  if (!/^\d{1,16}$/.test(header.trim())) return 'invalid';
  return Number(header) > limit ? 'too_large' : 'ok';
}
