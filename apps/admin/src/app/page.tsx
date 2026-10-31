'use client';
import type { AdminStats } from '@kleps/api-client';
import { LISTING_STATUSES } from '@kleps/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Card, Spinner } from '@/components/ui';
import { browserApi, errorMessage } from '@/lib/browser-api';
import { t } from '@/lib/i18n';

export default function Dashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    browserApi.admin.stats().then(setStats, (e: unknown) => setError(errorMessage(e)));
  }, []);
  if (error) return <Alert>{error}</Alert>;
  if (!stats) return <Spinner />;
  const pending = stats.listingsByStatus.PENDING_REVIEW ?? 0;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('admin.dashboard')}</h1>
      {pending > 0 && (
        <Alert tone="info">
          <Link href="/moderasyon" className="font-semibold underline">
            {pending} ilan incelemeyi bekliyor →
          </Link>
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><p className="text-xs text-fg-muted">Kullanıcı</p><p className="text-2xl font-bold">{stats.users}</p></Card>
        <Card><p className="text-xs text-fg-muted">Kategori</p><p className="text-2xl font-bold">{stats.categories}</p></Card>
        <Card><p className="text-xs text-fg-muted">Son 24 saatte ilan</p><p className="text-2xl font-bold">{stats.listingsCreatedLast24h}</p></Card>
        <Card><p className="text-xs text-fg-muted">İncelemede</p><p className="text-2xl font-bold text-warning">{pending}</p></Card>
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">İlan durumları</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          {LISTING_STATUSES.map((s) => (
            <div key={s} className="flex justify-between rounded-lg bg-muted px-3 py-2">
              <dt>{t(`listing.statuses.${s}`)}</dt>
              <dd className="font-semibold">{stats.listingsByStatus[s] ?? 0}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
