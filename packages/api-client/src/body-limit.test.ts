import { describe, expect, it } from 'vitest';
import { checkDeclaredLength, readBodyWithLimit } from './body-limit';

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(chunks[i++]!);
      else controller.close();
    },
  });
}

describe('readBodyWithLimit', () => {
  it('returns the full body when within the limit (exact limit included)', async () => {
    const r = await readBodyWithLimit(streamOf([new Uint8Array([1, 2]), new Uint8Array([3, 4])]), 4);
    expect(r).toEqual({ ok: true, body: new Uint8Array([1, 2, 3, 4]) });
  });

  it('treats a missing body as empty', async () => {
    expect(await readBodyWithLimit(null, 10)).toEqual({ ok: true, body: new Uint8Array(0) });
  });

  it('rejects as soon as the limit is exceeded and cancels the source without draining it', async () => {
    let pulled = 0;
    let cancelled = false;
    // An endless source (like a chunked upload with no Content-Length): the read must still terminate.
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(1024));
      },
      cancel() {
        cancelled = true;
      },
    });
    const r = await readBodyWithLimit(endless, 10 * 1024);
    expect(r).toEqual({ ok: false, reason: 'too_large' });
    expect(cancelled).toBe(true);
    expect(pulled).toBeLessThanOrEqual(12); // limit / chunk + 1, plus at most one read-ahead
  });

  it('rejects a single oversized chunk', async () => {
    expect((await readBodyWithLimit(streamOf([new Uint8Array(11)]), 10)).ok).toBe(false);
  });
});

describe('checkDeclaredLength', () => {
  it('accepts absent or acceptable values', () => {
    expect(checkDeclaredLength(null, 100)).toBe('ok');
    expect(checkDeclaredLength('100', 100)).toBe('ok');
  });
  it('rejects oversized and malformed values', () => {
    expect(checkDeclaredLength('101', 100)).toBe('too_large');
    expect(checkDeclaredLength('99999999999999999999', 100)).toBe('invalid');
    expect(checkDeclaredLength('-5', 100)).toBe('invalid');
    expect(checkDeclaredLength('12abc', 100)).toBe('invalid');
    expect(checkDeclaredLength('', 100)).toBe('invalid');
  });
});
