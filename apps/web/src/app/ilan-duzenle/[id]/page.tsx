'use client';
import type { ListingDetailDto } from '@kleps/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ListingForm } from '@/components/ListingForm';
import { PhotoManager } from '@/components/PhotoManager';
import { RequireAuth } from '@/components/RequireAuth';
import { Alert, Badge, Button, Card, LinkButton, Spinner } from '@/components/ui';
import { ApiError, browserApi, errorMessage } from '@/lib/browser-api';
import { tr, t } from '@/lib/i18n';

function Editor({ id }: { id: string }) {
  const [listing, setListing] = useState<ListingDetailDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<unknown>(null);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    browserApi.listings.get(id).then(setListing, (e: unknown) => setLoadError(errorMessage(e)));
  }, [id]);
  useEffect(load, [load]);

  if (loadError) return <Alert>{loadError}</Alert>;
  if (!listing) return <div className="flex justify-center py-24 text-accent"><Spinner /></div>;
  if (!listing.isOwner) return <Alert>{t('errors.FORBIDDEN')}</Alert>;

  const canPublish = listing.status === 'DRAFT' || listing.status === 'REJECTED';
  const editable = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'EXPIRED'].includes(listing.status);

  async function publish() {
    setPublishError(null);
    setNotice(null);
    setPublishing(true);
    try {
      const result = await browserApi.listings.publish(id);
      setListing(result);
      setNotice(result.status === 'ACTIVE' ? t('sell.published') : t('sell.pendingReview'));
    } catch (err) {
      setPublishError(err);
    } finally {
      setPublishing(false);
    }
  }

  const issues = publishError instanceof ApiError ? publishError.issues ?? [] : [];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{listing.status === 'DRAFT' ? t('sell.title') : t('common.edit')}</h1>
        <Badge tone={listing.status === 'ACTIVE' ? 'success' : listing.status === 'PENDING_REVIEW' ? 'warning' : 'neutral'}>
          <span data-testid="listing-status">{t(`listing.statuses.${listing.status}`)}</span>
        </Badge>
      </div>
      {listing.moderationNote && <Alert>{listing.moderationNote}</Alert>}

      {editable && (
        <Card>
          <PhotoManager listingId={id} images={listing.images} onChange={(images) => setListing((l) => (l ? { ...l, images } : l))} />
        </Card>
      )}

      {editable && (
        <Card>
          <ListingForm categorySlug={listing.category.slug} listing={listing} submitLabel={t('common.save')} onSaved={(l) => setListing(l)} />
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">{t('sell.stepReview')}</h2>
        {notice && <Alert tone="success">{notice}</Alert>}
        {publishError != null && (
          <Alert>
            {errorMessage(publishError)}
            {issues.length > 0 && (
              <ul className="mt-2 list-disc pl-5">
                {issues.map((i) => (
                  <li key={i.path.join('.')}>{tr(i.message, t('validation.invalid'))}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          {canPublish && (
            <Button onClick={() => void publish()} loading={publishing} data-testid="publish-button">
              {publishing ? t('sell.publishing') : t('sell.publish')}
            </Button>
          )}
          {listing.status === 'ACTIVE' && <LinkButton href={`/ilan/${id}`}>İlanı görüntüle</LinkButton>}
          <LinkButton href="/hesabim/ilanlar" variant="secondary">{t('nav.myListings')}</LinkButton>
        </div>
        {listing.status === 'DRAFT' && listing.images.length === 0 && <p className="text-xs text-fg-muted">{t('sell.needPhoto')}</p>}
      </Card>
      <p className="text-xs text-fg-muted">
        <Link href={`/ilan/${id}`} className="underline">Önizleme</Link>
      </p>
    </div>
  );
}

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <Editor id={id} />
    </RequireAuth>
  );
}
