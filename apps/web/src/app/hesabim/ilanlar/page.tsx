'use client';
import { LISTING_STATUSES, type ListingCardDto, type ListingStatus, type Paginated } from '@kleps/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { useSession } from '@/components/SessionProvider';
import { Alert, Badge, Button, EmptyState, LinkButton, Spinner } from '@/components/ui';
import { browserApi, errorMessage } from '@/lib/browser-api';
import { formatDate, priceLabel } from '@/lib/format';
import { t } from '@/lib/i18n';

const TABS: (ListingStatus | '')[] = ['', 'ACTIVE', 'DRAFT', 'PENDING_REVIEW', 'EXPIRED', 'REJECTED', 'SOLD', 'ARCHIVED'];

function MyListings() {
  const { user } = useSession();
  const [status, setStatus] = useState<ListingStatus | ''>('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<ListingCardDto> | null>(null);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, active] = await Promise.all([
        browserApi.me.listings({ status: status || undefined, page, pageSize: 20 }),
        browserApi.me.listings({ status: 'ACTIVE', pageSize: 1 }),
      ]);
      setData(list);
      setActiveCount(active.total);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [status, page]);
  useEffect(() => void load(), [load]);

  async function act(id: string, action: () => Promise<unknown>, success?: string) {
    setBusy(id);
    setError(null);
    setMessage(null);
    try {
      await action();
      if (success) setMessage(success);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('myListings.title')}</h1>
          {user && activeCount !== null && <p className="text-sm text-fg-muted">{t('myListings.limitInfo', { used: activeCount, limit: user.activeListingLimit })}</p>}
        </div>
        <LinkButton href="/ilan-ver">{t('nav.sell')}</LinkButton>
      </div>
      <div role="tablist" aria-label="Durum" className="flex gap-1 overflow-x-auto pb-1">
        {TABS.filter((s) => s === '' || LISTING_STATUSES.includes(s)).map((s) => (
          <button
            key={s || 'all'}
            role="tab"
            aria-selected={status === s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm ${status === s ? 'bg-fg text-bg' : 'bg-surface text-fg-muted hover:bg-muted'}`}
          >
            {s ? t(`listing.statuses.${s}`) : t('common.all')}
          </button>
        ))}
      </div>
      {error && <Alert>{error}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}
      {!data ? (
        <div className="flex justify-center py-16 text-accent"><Spinner /></div>
      ) : data.items.length === 0 ? (
        <EmptyState title={t('myListings.empty')} action={<LinkButton href="/ilan-ver">{t('nav.sell')}</LinkButton>} />
      ) : (
        <ul className="space-y-3" data-testid="my-listings">
          {data.items.map((l) => (
            <li key={l.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 sm:flex-row sm:items-center">
              <div className="h-20 w-28 flex-none overflow-hidden rounded-xl bg-muted">
                {l.coverImage && <img src={l.coverImage.thumbUrl} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={l.status === 'ACTIVE' ? `/ilan/${l.id}` : `/ilan-duzenle/${l.id}`} className="line-clamp-1 font-medium hover:text-accent">
                  {l.title}
                </Link>
                <p className="text-sm font-semibold">{priceLabel(l.priceAmount)}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                  <Badge tone={l.status === 'ACTIVE' ? 'success' : l.status === 'PENDING_REVIEW' ? 'warning' : 'neutral'}>{t(`listing.statuses.${l.status}`)}</Badge>
                  {l.expiresAt && l.status === 'ACTIVE' && <span>{t('listing.expiresAt')}: {formatDate(l.expiresAt)}</span>}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['DRAFT', 'ACTIVE', 'PENDING_REVIEW', 'REJECTED', 'EXPIRED'].includes(l.status) && (
                  <LinkButton href={`/ilan-duzenle/${l.id}`} variant="secondary">{t('common.edit')}</LinkButton>
                )}
                {(l.status === 'EXPIRED' || (l.status === 'ACTIVE' && l.expiresAt && new Date(l.expiresAt).getTime() - Date.now() < 7 * 86_400_000)) && (
                  <Button variant="secondary" loading={busy === l.id} onClick={() => void act(l.id, () => browserApi.listings.renew(l.id), t('myListings.renewed'))}>
                    {t('myListings.renew')}
                  </Button>
                )}
                {['ACTIVE', 'PENDING_REVIEW', 'EXPIRED'].includes(l.status) && (
                  <>
                    <Button variant="ghost" disabled={busy === l.id} onClick={() => void act(l.id, () => browserApi.listings.close(l.id, { reason: 'SOLD' }))}>
                      {t('myListings.markSold')}
                    </Button>
                    <Button variant="ghost" disabled={busy === l.id} onClick={() => void act(l.id, () => browserApi.listings.close(l.id, { reason: 'ARCHIVED' }))}>
                      {t('myListings.archive')}
                    </Button>
                  </>
                )}
                {l.status === 'DRAFT' && (
                  <Button variant="danger" disabled={busy === l.id} onClick={() => { if (confirm('Taslak silinsin mi?')) void act(l.id, () => browserApi.listings.remove(l.id)); }}>
                    {t('common.delete')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('common.previous')}</Button>
          <span className="self-center text-sm text-fg-muted">{t('common.page', { page, total: data.totalPages })}</span>
          <Button variant="secondary" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>{t('common.next')}</Button>
        </div>
      )}
    </div>
  );
}

export default function MyListingsPage() {
  return (
    <RequireAuth>
      <MyListings />
    </RequireAuth>
  );
}
