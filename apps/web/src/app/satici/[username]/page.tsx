import { ApiError } from '@kleps/api-client';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ListingGrid } from '@/components/ListingCard';
import { Pagination } from '@/components/Pagination';
import { Badge, Card, EmptyState } from '@/components/ui';
import { formatMonth } from '@/lib/format';
import { t } from '@/lib/i18n';
import { publicApi } from '@/lib/session';

type Props = { params: Promise<{ username: string }>; searchParams: Promise<{ page?: string }> };

const loadProfile = cache(async (username: string) => {
  try {
    return await (await publicApi()).users.profile(username);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await loadProfile((await params).username);
  return { title: `${profile.displayName} (@${profile.username})` };
}

export default async function SellerPage({ params, searchParams }: Props) {
  const { username } = await params;
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const profile = await loadProfile(username);
  const listings = await (await publicApi()).users.listings(username, { page, pageSize: 24 });

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-2xl font-bold text-accent">
          {profile.displayName.slice(0, 1).toLocaleUpperCase('tr-TR')}
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="seller-name">
            {profile.displayName}
          </h1>
          <p className="text-sm text-fg-muted">
            @{profile.username}
            {profile.city && ` · ${profile.city}`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {profile.verificationStatus === 'VERIFIED' && <Badge tone="success">{t('seller.verified')}</Badge>}
            <Badge>{profile.sellerType === 'BUSINESS' ? t('seller.business') : t('seller.individual')}</Badge>
            <Badge tone="accent">{t('seller.activeListings', { count: profile.activeListingCount })}</Badge>
          </div>
          {profile.bio && <p className="mt-3 text-sm">{profile.bio}</p>}
        </div>
        <p className="text-xs text-fg-muted">{t('seller.memberSince', { date: formatMonth(profile.memberSince) })}</p>
      </Card>
      {listings.items.length ? (
        <>
          <ListingGrid listings={listings.items} />
          <Pagination page={listings.page} totalPages={listings.totalPages} hrefFor={(p) => `/satici/${profile.username}?page=${p}`} />
        </>
      ) : (
        <EmptyState title={t('seller.noListings')} />
      )}
    </div>
  );
}
