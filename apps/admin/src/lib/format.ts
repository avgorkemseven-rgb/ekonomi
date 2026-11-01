import { formatPrice } from '@kleps/shared';
import { t } from './i18n';

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const monthFmt = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });

export const formatDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : '—');
export const formatMonth = (iso: string) => monthFmt.format(new Date(iso));
export const priceLabel = (kurus: number | null) => (kurus == null ? t('listing.priceOnRequest') : formatPrice(kurus));

export function relativeDays(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Bugün';
  if (days === 1) return 'Dün';
  return `${days} gün önce`;
}
