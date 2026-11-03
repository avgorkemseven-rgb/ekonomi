import { classifyListingChange, freeTextOf, needsMediaReview } from './moderation-policy';

const current = {
  categoryId: 'c1',
  title: 'Target dart seti',
  description: 'Temiz set',
  priceAmount: 100_000,
  district: null,
  brandId: 'b1',
  modelId: null,
  attributes: { weight: 23, tipType: 'Çelik' },
};

describe('classifyListingChange', () => {
  it('ignores harmless fields and unchanged values', () => {
    expect(classifyListingChange(current, { condition: 'FAIR', city: 'Ankara', allowsShipping: true })).toEqual({ categoryChanged: false, contentChanged: false });
    expect(classifyListingChange(current, { title: 'Target dart seti', attributes: { tipType: 'Çelik', weight: 23 } }).contentChanged).toBe(false);
  });
  it('detects content and category changes', () => {
    expect(classifyListingChange(current, { district: 'Kadıköy' }).contentChanged).toBe(true);
    expect(classifyListingChange(current, { priceAmount: 90_000 }).contentChanged).toBe(true);
    expect(classifyListingChange(current, { attributes: { weight: 24, tipType: 'Çelik' } }).contentChanged).toBe(true);
    expect(classifyListingChange(current, { categoryId: 'c2' }).categoryChanged).toBe(true);
    expect(classifyListingChange(current, { categoryId: 'c1' }).categoryChanged).toBe(false);
  });
});

describe('freeTextOf', () => {
  it('collects district and string attribute values', () => {
    expect(freeTextOf({ district: 'Bornova', attributes: { a: 'x', b: 3, c: true } })).toEqual(['Bornova', 'x']);
  });
});

describe('needsMediaReview', () => {
  const reviewed = new Date('2026-01-10T00:00:00Z');
  const old = (position: number) => ({ position, createdAt: new Date('2026-01-09T00:00:00Z') });
  const fresh = (position: number) => ({ position, createdAt: new Date('2026-01-11T00:00:00Z') });

  it('keeps reviewed sets and minority additions live', () => {
    expect(needsMediaReview([old(0), old(1)], reviewed)).toBe(false);
    expect(needsMediaReview([old(0), fresh(1)], reviewed)).toBe(false);
    expect(needsMediaReview([old(0), old(1), fresh(2)], reviewed)).toBe(false);
  });
  it('flags an unreviewed cover or an unreviewed majority', () => {
    expect(needsMediaReview([fresh(0), old(1), old(2)], reviewed)).toBe(true);
    expect(needsMediaReview([old(0), fresh(1), fresh(2)], reviewed)).toBe(true);
    expect(needsMediaReview([fresh(0)], reviewed)).toBe(true);
  });
  it('treats everything as unreviewed when there was no decision point', () => {
    expect(needsMediaReview([old(0)], null)).toBe(true);
    expect(needsMediaReview([], null)).toBe(false);
  });
});
