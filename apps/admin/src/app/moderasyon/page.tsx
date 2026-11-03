'use client';
import type { AdminListingItem } from '@kleps/api-client';
import { LISTING_STATUSES, type ListingStatus, type Paginated } from '@kleps/shared';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, EmptyState, Input, Spinner } from '@/components/ui';
import { browserApi, errorMessage } from '@/lib/browser-api';
import { formatDate, priceLabel } from '@/lib/format';
import { t } from '@/lib/i18n';

const RISK_LABELS: Record<string, string> = {
  contact_info: 'İletişim bilgisi',
  external_link: 'Harici bağlantı',
  payment_info: 'Ödeme bilgisi (IBAN)',
  off_platform_payment: 'Platform dışı ödeme',
  counterfeit_terms: 'Sahte/replika ifadesi',
  new_account_velocity: 'Yeni hesap, yoğun ilan',
  suspicious_price: 'Şüpheli fiyat',
  category_changed: 'Yayındayken kategori değişti',
  media_changed: 'Onaylı fotoğraflar değişti',
};

const WEB_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function ModerationPage() {
  const [status, setStatus] = useState<ListingStatus | ''>('PENDING_REVIEW');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AdminListingItem> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<{ id: string; kind: 'reject' | 'remove' } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await browserApi.admin.listings({ status: status || undefined, q: q || undefined, page, pageSize: 20 }));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [status, q, page]);
  useEffect(() => void load(), [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setActing(null);
      setReason('');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t('admin.moderation')}</h1>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Durum" value={status} onChange={(e) => { setStatus(e.target.value as ListingStatus | ''); setPage(1); }} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm">
          <option value="">{t('common.all')}</option>
          {LISTING_STATUSES.map((s) => <option key={s} value={s}>{t(`listing.statuses.${s}`)}</option>)}
        </select>
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); void load(); }} className="flex flex-1 gap-2">
          <Input aria-label="Ara" placeholder="Başlık, ilan no veya kullanıcı adı" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
          <Button type="submit" variant="secondary">{t('common.search')}</Button>
        </form>
      </div>
      {error && <Alert>{error}</Alert>}
      {!data ? <Spinner /> : data.items.length === 0 ? <EmptyState title="Kayıt yok" /> : (
        <ul className="space-y-3">
          {data.items.map((l) => (
            <li key={l.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="h-24 w-32 flex-none overflow-hidden rounded-xl bg-muted">
                  {l.coverImage && <img src={l.coverImage.thumbUrl} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <a href={`${WEB_URL}/ilan/${l.id}`} target="_blank" rel="noreferrer" className="font-semibold hover:text-accent">{l.title}</a>
                  <p className="text-sm">{priceLabel(l.priceAmount)} · {l.category.name} · {l.city ?? '—'}</p>
                  <p className="text-xs text-fg-muted">
                    @{l.seller.username} ({l.seller.displayName}) · üyelik {formatDate(l.seller.createdAt)} · güncelleme {formatDate(l.updatedAt)}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Badge tone={l.status === 'ACTIVE' ? 'success' : l.status === 'PENDING_REVIEW' ? 'warning' : 'neutral'}>{t(`listing.statuses.${l.status}`)}</Badge>
                    {l.riskScore > 0 && <Badge tone="danger">Risk {l.riskScore}</Badge>}
                    {l.riskReasons.map((r) => <Badge key={r} tone="warning">{RISK_LABELS[r] ?? r}</Badge>)}
                  </div>
                  {l.moderationNote && <p className="text-xs text-fg-muted">Not: {l.moderationNote}</p>}
                </div>
                <div className="flex flex-wrap items-start gap-2 sm:flex-col">
                  {l.status === 'PENDING_REVIEW' && <Button disabled={busy} onClick={() => void run(() => browserApi.admin.approve(l.id))}>{t('admin.approve')}</Button>}
                  {(l.status === 'PENDING_REVIEW' || l.status === 'ACTIVE') && <Button variant="secondary" disabled={busy} onClick={() => setActing({ id: l.id, kind: 'reject' })}>{t('admin.reject')}</Button>}
                  {l.status !== 'REMOVED' && <Button variant="danger" disabled={busy} onClick={() => setActing({ id: l.id, kind: 'remove' })}>{t('admin.remove')}</Button>}
                </div>
              </div>
              {acting?.id === l.id && (
                <form
                  className="mt-3 flex flex-col gap-2 border-t border-line pt-3 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(() => (acting.kind === 'reject' ? browserApi.admin.reject(l.id, reason) : browserApi.admin.remove(l.id, reason)));
                  }}
                >
                  <label htmlFor={`reason-${l.id}`} className="sr-only">{t('admin.reason')}</label>
                  <Input id={`reason-${l.id}`} autoFocus required minLength={3} maxLength={500} placeholder={`${t('admin.reason')} (kullanıcıya gösterilir)`} value={reason} onChange={(e) => setReason(e.target.value)} />
                  <Button type="submit" variant="danger" loading={busy}>{acting.kind === 'reject' ? t('admin.reject') : t('admin.remove')}</Button>
                  <Button type="button" variant="ghost" onClick={() => setActing(null)}>{t('common.cancel')}</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('common.previous')}</Button>
          <span className="self-center text-sm">{t('common.page', { page, total: data.totalPages })}</span>
          <Button variant="secondary" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>{t('common.next')}</Button>
        </div>
      )}
    </div>
  );
}
