'use client';
import { ApiError, createApiClient } from '@kleps/api-client';
import { t, tr } from './i18n';

/**
 * Browser API client. Requests go to the same-origin BFF proxy, which attaches the httpOnly session
 * and refreshes tokens transparently. One retry covers parallel requests racing on a token refresh.
 */
export const browserApi = createApiClient({
  baseUrl: '/api/proxy',
  onUnauthorized: async () => {
    await new Promise((r) => setTimeout(r, 250));
    return true;
  },
});

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'NETWORK_ERROR') return t('common.networkError');
    return tr(`errors.${err.code}`, err.message);
  }
  return t('common.genericError');
}

/** Field-level message for a validation error, translated when possible. */
export function fieldError(err: unknown, field: string): string | undefined {
  if (!(err instanceof ApiError)) return undefined;
  const key = err.fieldError(field);
  return key ? tr(key, t('validation.invalid')) : undefined;
}

export { ApiError };
