import { ApiError } from '@kleps/api-client';
import type { ListingDetailDto } from '@kleps/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { Gallery } from '@/components/Gallery';
import { Badge, Card, LinkButton } from '@/components/ui';
import { formatDate, formatMonth, priceLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { publicApi, serverApi } from '@/lib/session';

type Props = { params: Promise<{ id: string }> };

const loadListing = cache(async (id: string): Promise<ListingDetailDto> => {
  try {
    return await (await serverApi()).listings.get(id);
  } catch (err) {
    // Expired access token in a server component: fall back to the public view.
    if (err instanceof ApiError && err.status === 401) {
      return (await publicApi()).listings.get(id).catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 404) notFound();
        throw e;
      });
    }
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await loadListing((await params).id);
  return {
    title: listing.title,
    description: listing.description.slice(0, 160),
    openGraph: { title: listing.title, images: listing.images[0] ? [listing.images[0].url] : [] },
  };
}

function attributeValue(value: string | number | boolean, unit: string | null): string {
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no');
  return unit ? `${value} ${unit}` : String(value);
}

export default async function ListingPage({ params }: Props) {
  const listing = await loadListing((await params).id);
  const attrs = listing.attributeDefinitions.filter((d) => listing.attributes[d.key] !== undefined);

  return (
    <article className="space-y-6" data-testid="listing-detail">
      <nav aria-label="Konum" className="text-sm text-fg-muted">
        <Link href="/" className="hover:text-accent">
          Ana sayfa
        </Link>
        {listing.categoryPath.map((p) => (
          <span key={p.id}>
            {' / '}
            <Link href={`/kategori/${p.slug}`} className="hover:text-accent">
              {p.name}
            </Link>
          </span>
        ))}
      </nav>

      {listing.isOwner && listing.status !== 'ACTIVE' && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
          <strong>{t(`listing.statuses.${listing.status}`)}</strong>
          {listing.moderationNote && <span> — {listing.moderationNote}</span>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Gallery images={listing.images} title={listing.title} />
          <Card>
            <h2 className="mb-3 text-lg font-bold">{t('listing.description')}</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed">{listing.description}</p>
          </Card>
          {attrs.length > 0 && (
            <Card>
              <h2 className="mb-3 text-lg font-bold">{t('listing.attributes')}</h2>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {listing.brand && (
                  <div className="flex justify-between border-b border-line py-2">
                    <dt className="text-fg-muted">{t('listing.brand')}</dt>
                    <dd className="font-medium">{listing.brand.name}</dd>
                  </div>
                )}
                {listing.model && (
                  <div className="flex justify-between border-b border-line py-2">
                    <dt className="text-fg-muted">{t('listing.model')}</dt>
                    <dd className="font-medium">{listing.model.name}</dd>
                  </div>
                )}
                {attrs.map((d) => (
                  <div key={d.key} className="flex justify-between border-b border-line py-2">
                    <dt className="text-fg-muted">{d.label}</dt>
                    <dd className="font-medium">{attributeValue(listing.attributes[d.key]!, d.unit)}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <h1 className="text-xl font-bold leading-snug">{listing.title}</h1>
            <p className="mt-3 text-3xl font-black" data-testid="listing-price">
              {priceLabel(listing.priceAmount)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {listing.condition && <Badge tone="accent">{t(`listing.conditions.${listing.condition}`)}</Badge>}
              {listing.allowsInPerson && <Badge>{t('listing.allowsInPerson')}</Badge>}
              {listing.allowsShipping && <Badge>{t('listing.allowsShipping')}</Badge>}
            </div>
            <dl className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-fg-muted">{t('listing.location')}</dt>
                <dd>{[listing.city, listing.district].filter(Boolean).join(' / ') || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-muted">{t('listing.publishedAt')}</dt>
                <dd>{formatDate(listing.publishedAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-muted">İlan no</dt>
                <dd className="font-mono text-xs">{listing.id}</dd>
              </div>
            </dl>
            {listing.isOwner && (
              <div className="mt-4 flex gap-2">
                <LinkButton href={`/ilan-duzenle/${listing.id}`} variant="secondary" className="flex-1">
                  {t('common.edit')}
                </LinkButton>
                <LinkButton href="/hesabim/ilanlar" variant="ghost">
                  {t('nav.myListings')}
                </LinkButton>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-fg-muted">{t('listing.seller')}</h2>
            <Link href={`/satici/${listing.seller.username}`} className="mt-2 flex items-center gap-3 hover:text-accent" data-testid="seller-link">
              <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft font-bold text-accent">
                {listing.seller.displayName.slice(0, 1).toLocaleUpperCase('tr-TR')}
              </span>
              <span>
                <span className="block font-semibold">{listing.seller.displayName}</span>
                <span className="block text-xs text-fg-muted">@{listing.seller.username}</span>
              </span>
            </Link>
            <div className="mt-3 flex flex-wrap gap-2">
              {listing.seller.verificationStatus === 'VERIFIED' && <Badge tone="success">{t('seller.verified')}</Badge>}
              <Badge>{listing.seller.sellerType === 'BUSINESS' ? t('seller.business') : t('seller.individual')}</Badge>
            </div>
            <p className="mt-3 text-xs text-fg-muted">{t('seller.memberSince', { date: formatMonth(listing.seller.memberSince) })}</p>
            <p className="mt-4 rounded-xl bg-muted px-3 py-2.5 text-xs text-fg-muted">{t('listing.contactSoon')}</p>
          </Card>
        </aside>
      </div>
    </article>
  );
}
