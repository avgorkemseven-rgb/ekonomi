import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient, toQueryString } from './index';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('toQueryString', () => {
  it('drops empty values and flattens attrs', () => {
    expect(toQueryString({ q: 'istaka', page: 2, city: undefined, brand: '', attrs: { tipSize_min: 12, x: undefined } })).toBe(
      '?q=istaka&page=2&attr_tipSize_min=12',
    );
    expect(toQueryString({})).toBe('');
  });
});

describe('createApiClient', () => {
  it('sends bearer tokens and parses JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { id: 'u1' }));
    const api = createApiClient({ baseUrl: 'http://api/', getAccessToken: () => 'tok', fetch: fetchMock });
    await expect(api.auth.me()).resolves.toEqual({ id: 'u1' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://api/v1/auth/me');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('does not send tokens to public catalog endpoints', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, []));
    const api = createApiClient({ baseUrl: 'http://api', getAccessToken: () => 'tok', fetch: fetchMock });
    await api.categories.tree();
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBeUndefined();
  });

  it('throws ApiError with code and issues', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json(400, { statusCode: 400, error: 'VALIDATION_ERROR', message: 'bad', issues: [{ path: ['title'], message: 'validation.titleMin' }] }),
    );
    const api = createApiClient({ baseUrl: 'http://api', fetch: fetchMock });
    const err = await api.listings.create({ categoryId: 'c', title: 'x' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('VALIDATION_ERROR');
    expect((err as ApiError).fieldError('title')).toBe('validation.titleMin');
  });

  it('retries once after a successful refresh on 401', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(401, { error: 'UNAUTHORIZED' })).mockResolvedValueOnce(json(200, { ok: true }));
    const onUnauthorized = vi.fn().mockResolvedValue(true);
    const api = createApiClient({ baseUrl: 'http://api', getAccessToken: () => 't', onUnauthorized, fetch: fetchMock });
    await expect(api.me.listings()).resolves.toEqual({ ok: true });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('maps network failures to NETWORK_ERROR', async () => {
    const api = createApiClient({ baseUrl: 'http://api', fetch: vi.fn().mockRejectedValue(new TypeError('fetch failed')) });
    await expect(api.categories.tree()).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });
});
