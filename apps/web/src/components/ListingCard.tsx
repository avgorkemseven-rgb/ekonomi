import type { ListingCardDto } from '@kleps/shared';
import Link from 'next/link';
import { priceLabel, relativeDays } from '@/lib/format';
import { t } from '@/lib/i18n';
import { Badge } from './ui';

export function ListingCard({ listing, showStatus }: { listing: ListingCardDto; showStatus?: boolean }) {
  return (
    <Link
      href={`/ilan/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-shadow hover:shadow-lg focus-visible:shadow-lg"
      data-testid="listing-card"
    >
      <div className="relative aspect-[4/3] bg-muted">
        {listing.coverImage ? (
          <img src={listing.coverImage.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" width={listing.coverImage.width} height={listing.coverImage.height} />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-fg-muted">{t('listing.noPhotos')}</div>
        )}
        {listing.condition && (
          <span className="absolute left-2 top-2">
            <Badge>{t(`listing.conditions.${listing.condition}`)}</Badge>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <p className="line-clamp-2 text-sm font-medium group-hover:text-accent">{listing.title}</p>
        <p className="mt-auto pt-1 text-base font-bold">{priceLabel(listing.priceAmount)}</p>
        <p className="text-xs text-fg-muted">
          {[listing.city, listing.district].filter(Boolean).join(' / ')}
          {listing.publishedAt && ` · ${relativeDays(listing.publishedAt)}`}
        </p>
        {showStatus && (
          <span className="pt-1">
            <Badge tone={listing.status === 'ACTIVE' ? 'success' : listing.status === 'PENDING_REVIEW' ? 'warning' : 'neutral'}>{t(`listing.statuses.${listing.status}`)}</Badge>
          </span>
        )}
      </div>
    </Link>
  );
}

export function ListingGrid({ listings }: { listings: ListingCardDto[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {listings.map((l) => (
        <li key={l.id} className="flex">
          <ListingCard listing={l} />
        </li>
      ))}
    </ul>
  );
}
