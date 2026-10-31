import { createT, translateDynamic } from '@kleps/i18n';

export const t = createT('tr');

/** Translates API error codes / validation message keys with a safe fallback. */
export function tr(key: string, fallback?: string): string {
  return translateDynamic(t, key, fallback ?? t('common.genericError'));
}
