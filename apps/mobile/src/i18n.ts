import { createT, translateDynamic } from '@kleps/i18n';
import { ApiError } from '@kleps/api-client';

export const t = createT('tr');

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'NETWORK_ERROR') return t('common.networkError');
    return translateDynamic(t, `errors.${err.code}`, err.message);
  }
  return t('common.genericError');
}

export function fieldError(err: unknown, field: string): string | undefined {
  if (!(err instanceof ApiError)) return undefined;
  const key = err.fieldError(field);
  return key ? translateDynamic(t, key, t('validation.invalid')) : undefined;
}
