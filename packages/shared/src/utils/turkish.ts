const FOLD: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u',
};

/** Turkish-aware lower-casing (İ→i, I→ı) that does not depend on the runtime's ICU data. */
export function turkishLowerCase(input: string): string {
  return input.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
}

/**
 * Normalizes text for search: Turkish lower-case, fold diacritics, collapse whitespace,
 * keep letters/digits/selected symbols. "ISTAKA", "ıstaka", "Istaka" → "istaka".
 */
export function normalizeTurkish(input: string): string {
  return turkishLowerCase(input.normalize('NFC'))
    .replace(/[çğıöşüâîû]/g, (ch) => FOLD[ch] ?? ch)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9.%/\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Splits a normalized query into unique search tokens (max 8, min length 2 unless numeric). */
export function searchTokens(query: string): string[] {
  const tokens = normalizeTurkish(query)
    .split(' ')
    .map((t) => t.replace(/^[.\-/]+|[.\-/]+$/g, ''))
    .filter((t) => t.length >= 2 || /^\d+$/.test(t));
  return Array.from(new Set(tokens)).slice(0, 8);
}

/** URL slug from arbitrary Turkish text. */
export function slugify(input: string, maxLength = 80): string {
  return normalizeTurkish(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}
