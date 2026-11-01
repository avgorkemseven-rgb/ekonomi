import { assessListingRisk } from './risk';

const base = { priceAmount: 500_000, accountAgeHours: 500, recentPublishCount24h: 0 };

describe('assessListingRisk', () => {
  it('passes a normal listing', () => {
    const r = assessListingRisk({ ...base, title: 'Predator REVO 12.4 istaka', description: 'Az kullanılmış, kutulu.' });
    expect(r).toEqual({ score: 0, reasons: [], requiresReview: false });
  });

  it('flags contact info and links', () => {
    const r = assessListingRisk({ ...base, title: 'Istaka', description: 'Ara: 0532 123 45 67 veya www.ornek.com' });
    expect(r.reasons).toEqual(expect.arrayContaining(['contact_info', 'external_link']));
    expect(r.requiresReview).toBe(true);
  });

  it('flags IBAN and off-platform payment requests', () => {
    const r = assessListingRisk({ ...base, title: 'Dart seti', description: 'Kapora için TR12 0006 1005 1978 6457 8413 26' });
    expect(r.reasons).toEqual(expect.arrayContaining(['payment_info', 'off_platform_payment']));
    expect(r.requiresReview).toBe(true);
  });

  it('flags counterfeit terms with Turkish normalization', () => {
    expect(assessListingRisk({ ...base, title: 'ÇAKMA Predator', description: 'temiz' }).reasons).toContain('counterfeit_terms');
    expect(assessListingRisk({ ...base, title: 'Replika istaka', description: 'x' }).requiresReview).toBe(true);
  });

  it('does not flag substrings of normal words', () => {
    // "kopya" must not match inside other words; "çakmak" is not "çakma".
    expect(assessListingRisk({ ...base, title: 'Çakmak ve istaka', description: 'temiz ürün' }).reasons).toEqual([]);
  });

  it('flags velocity of brand-new accounts but alone stays below threshold', () => {
    const r = assessListingRisk({ ...base, accountAgeHours: 2, recentPublishCount24h: 5, title: 'Istaka', description: 'temiz' });
    expect(r.reasons).toEqual(['new_account_velocity']);
    expect(r.requiresReview).toBe(false);
  });
});
