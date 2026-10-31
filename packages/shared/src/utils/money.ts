import { MAX_PRICE_KURUS } from '../constants';

/** Converts a TL amount (number or "1.250,50"/"1250.50" string) to integer kuruş. Returns null if invalid. */
export function tlToKurus(value: number | string): number | null {
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else {
    const trimmed = value.trim().replace(/\s|₺|TL/gi, '');
    if (!trimmed) return null;
    // Turkish format uses "." for thousands and "," for decimals.
    const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
    n = Number(normalized);
  }
  if (!Number.isFinite(n) || n < 0) return null;
  const kurus = Math.round(n * 100);
  return kurus > MAX_PRICE_KURUS ? null : kurus;
}

export function kurusToTl(kurus: number): number {
  return kurus / 100;
}

const formatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

/** "12.500 ₺" style display string. */
export function formatPrice(kurus: number): string {
  return formatter.format(kurus / 100);
}
