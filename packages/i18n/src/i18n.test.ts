import { describe, expect, it } from 'vitest';
import { createT, translateDynamic } from './index';

describe('i18n', () => {
  const t = createT('tr');
  it('translates nested keys with params', () => {
    expect(t('listing.conditions.NEW')).toBe('Sıfır');
    expect(t('common.page', { page: 2, total: 5 })).toBe('Sayfa 2 / 5');
  });
  it('falls back to Turkish for missing English keys', () => {
    expect(createT('en')('listing.conditions.NEW')).toBe('Sıfır');
    expect(createT('en')('nav.sell')).toBe('Sell');
  });
  it('handles dynamic keys', () => {
    expect(translateDynamic(t, 'errors.EMAIL_TAKEN', 'x')).toBe('Bu e-posta adresi zaten kayıtlı.');
    expect(translateDynamic(t, 'errors.NOPE', 'fallback')).toBe('fallback');
  });
});
