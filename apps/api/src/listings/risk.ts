import { normalizeTurkish } from '@kleps/shared';

export type RiskReason =
  | 'contact_info'
  | 'external_link'
  | 'payment_info'
  | 'off_platform_payment'
  | 'counterfeit_terms'
  | 'new_account_velocity'
  | 'suspicious_price';

export interface RiskInput {
  title: string;
  description: string;
  priceAmount: number | null;
  accountAgeHours: number;
  recentPublishCount24h: number;
}

export interface RiskAssessment {
  score: number;
  reasons: RiskReason[];
  requiresReview: boolean;
}

const WEIGHTS: Record<RiskReason, number> = {
  contact_info: 40,
  external_link: 40,
  payment_info: 60,
  off_platform_payment: 60,
  counterfeit_terms: 70,
  new_account_velocity: 30,
  suspicious_price: 30,
};

export const REVIEW_THRESHOLD = 50;

// Turkish mobile/landline numbers: 05xx…, +90 5xx…, 0 212…, with optional separators.
const PHONE = /(?:\+?90[\s.-]?)?\(?0?[2-5]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const URL = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|com\.tr|app|shop|store|io|me)\b/i;
const IBAN = /\bTR\s?\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/i;
const OFF_PLATFORM = ['kapora', 'on odeme', 'pesin odeme', 'havale ile', 'eft ile', 'whatsapp', 'telegram', 'instagram'];
const COUNTERFEIT = ['replika', 'cakma', 'muadil', 'kopya', 'fake', 'a kalite', '1. kalite replika'];

/**
 * Rule-based risk assessment run at publish time (ADR-007). Explainable by design: every point of score
 * maps to a named reason that is shown to moderators.
 */
export function assessListingRisk(input: RiskInput): RiskAssessment {
  const raw = `${input.title}\n${input.description}`;
  const text = normalizeTurkish(raw);
  const reasons = new Set<RiskReason>();

  if (PHONE.test(raw.replace(/[()]/g, '')) || EMAIL.test(raw)) reasons.add('contact_info');
  if (URL.test(raw)) reasons.add('external_link');
  if (IBAN.test(raw)) reasons.add('payment_info');
  if (OFF_PLATFORM.some((term) => text.includes(term))) reasons.add('off_platform_payment');
  if (COUNTERFEIT.some((term) => new RegExp(`(^|\\s)${term}(\\s|$)`).test(text))) reasons.add('counterfeit_terms');
  if (input.accountAgeHours < 24 && input.recentPublishCount24h >= 3) reasons.add('new_account_velocity');
  if (input.priceAmount !== null && input.priceAmount > 0 && input.priceAmount < 100 * 10) reasons.add('suspicious_price');

  const list = [...reasons];
  const score = Math.min(100, list.reduce((sum, r) => sum + WEIGHTS[r], 0));
  return { score, reasons: list, requiresReview: score >= REVIEW_THRESHOLD };
}
