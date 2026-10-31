import { describe, expect, it } from 'vitest';
import { normalizeTurkish, searchTokens, slugify, turkishLowerCase } from './turkish';
import { formatPrice, tlToKurus } from './money';
import { PROVINCES, isProvince } from './provinces';
import { validateAttributes } from './attributes';
import { parseListingSearchQuery, registerSchema, listingCreateSchema } from '../index';

describe('turkish normalization', () => {
  it('lower-cases with Turkish rules', () => {
    expect(turkishLowerCase('İSTANBUL')).toBe('istanbul');
    expect(turkishLowerCase('ISPARTA')).toBe('ısparta');
  });
  it('folds diacritics so variants match', () => {
    expect(normalizeTurkish('ISTAKA')).toBe('istaka');
    expect(normalizeTurkish('ıstaka')).toBe('istaka');
    expect(normalizeTurkish('İstaka')).toBe('istaka');
    expect(normalizeTurkish('Çanta Şaft Ğ Ü Ö')).toBe('canta saft g u o');
    expect(normalizeTurkish('  Dart   Oku!! ')).toBe('dart oku');
  });
  it('keeps measurement characters', () => {
    expect(normalizeTurkish('%90 Tungsten 12.5mm')).toBe('%90 tungsten 12.5mm');
  });
  it('tokenizes queries', () => {
    expect(searchTokens('Predator ISTAKA istaka a 9')).toEqual(['predator', 'istaka', '9']);
  });
  it('slugifies', () => {
    expect(slugify('Bilardo Istekası & Aksesuarları')).toBe('bilardo-istekasi-aksesuarlari');
    expect(slugify('Çift Parça Şaft — 12,5 mm')).toBe('cift-parca-saft-12-5-mm');
  });
});

describe('money', () => {
  it('converts TL to kuruş', () => {
    expect(tlToKurus(1250.5)).toBe(125050);
    expect(tlToKurus('1.250,50')).toBe(125050);
    expect(tlToKurus('1250.50')).toBe(125050);
    expect(tlToKurus('42.500')).toBe(4250000);
    expect(tlToKurus('1.250.000')).toBe(125000000);
    expect(tlToKurus('42.5')).toBe(4250);
    expect(tlToKurus('12,5')).toBe(1250);
    expect(tlToKurus('4.25.0')).toBeNull();
    expect(tlToKurus('abc')).toBeNull();
    expect(tlToKurus(-1)).toBeNull();
  });
  it('formats prices in Turkish', () => {
    expect(formatPrice(1250000)).toMatch(/12\.500/);
    expect(formatPrice(1250000)).toContain('₺');
  });
});

describe('provinces', () => {
  it('has all 81 provinces', () => {
    expect(PROVINCES).toHaveLength(81);
    expect(new Set(PROVINCES).size).toBe(81);
    expect(isProvince('İstanbul')).toBe(true);
    expect(isProvince('Istanbul')).toBe(false);
  });
});

describe('attribute validation', () => {
  const defs = [
    { key: 'tipSize', label: 'Uç çapı', type: 'NUMBER' as const, options: [], required: true },
    { key: 'joint', label: 'Bağlantı', type: 'SELECT' as const, options: ['Radial', '3/8x10'], required: false },
    { key: 'case', label: 'Kılıf', type: 'BOOLEAN' as const, options: [], required: false },
  ];
  it('coerces and validates', () => {
    const r = validateAttributes(defs, { tipSize: '12,5', joint: 'Radial', case: 'true' }, true);
    expect(r.issues).toEqual([]);
    expect(r.values).toEqual({ tipSize: 12.5, joint: 'Radial', case: true });
  });
  it('reports problems', () => {
    const r = validateAttributes(defs, { joint: 'Other', foo: 'x' }, true);
    expect(r.issues).toEqual(
      expect.arrayContaining([
        { key: 'foo', code: 'unknown' },
        { key: 'tipSize', code: 'required' },
        { key: 'joint', code: 'option' },
      ]),
    );
  });
  it('allows missing required attributes in drafts', () => {
    expect(validateAttributes(defs, {}, false).issues).toEqual([]);
  });
});

describe('schemas', () => {
  it('validates registration', () => {
    expect(
      registerSchema.safeParse({ email: ' A@B.co ', password: 'abc12345', username: 'Ali_K', displayName: 'Ali' })
        .success,
    ).toBe(true);
    const weak = registerSchema.safeParse({ email: 'a@b.co', password: 'abcdefgh', username: 'ali', displayName: 'Ali' });
    expect(weak.success).toBe(false);
  });
  it('rejects bad listing input', () => {
    expect(listingCreateSchema.safeParse({ categoryId: 'x', title: 'abc' }).success).toBe(false);
    expect(listingCreateSchema.safeParse({ categoryId: 'x', title: 'Predator istaka', city: 'Atlantis' }).success).toBe(
      false,
    );
  });
  it('parses search query with attribute filters', () => {
    const r = parseListingSearchQuery({ q: 'istaka', minPrice: '100', attr_tipSize_min: '12', attr_bad$: 'x', page: '2' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.attrs).toEqual({ tipSize_min: '12' });
      expect(r.data.page).toBe(2);
      expect(r.data.minPrice).toBe(100);
      expect(r.data.sort).toBe('newest');
    }
  });
});
