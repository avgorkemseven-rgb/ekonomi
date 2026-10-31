'use client';
import { MAX_LISTING_PHOTOS, type ListingImageDto } from '@kleps/shared';
import { useRef, useState } from 'react';
import { browserApi, errorMessage } from '@/lib/browser-api';
import { t } from '@/lib/i18n';
import { Alert, Button } from './ui';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';

export function PhotoManager({ listingId, images, onChange }: { listingId: string; images: ListingImageDto[]; onChange: (images: ListingImageDto[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setBusy(true);
    let current = [...images];
    const list = Array.from(files).slice(0, MAX_LISTING_PHOTOS - current.length);
    try {
      // Sequential uploads keep memory bounded and preserve the chosen order.
      for (const [i, file] of list.entries()) {
        setProgress(`${t('sell.uploading')} ${i + 1}/${list.length}`);
        const form = new FormData();
        form.append('file', file);
        const image = await browserApi.listings.uploadImage(listingId, form);
        current = [...current, image];
        onChange(current);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      setProgress(null);
      if (input.current) input.current.value = '';
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await browserApi.listings.deleteImage(listingId, id);
      onChange(images.filter((i) => i.id !== id).map((img, position) => ({ ...img, position })));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function move(from: number, to: number) {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    setError(null);
    try {
      onChange(await browserApi.listings.reorderImages(listingId, { imageIds: next.map((i) => i.id) }));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section aria-labelledby="photos-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="photos-title" className="text-lg font-semibold">
            {t('listing.photos')} <span className="text-sm font-normal text-fg-muted">({images.length}/{MAX_LISTING_PHOTOS})</span>
          </h2>
          <p className="text-xs text-fg-muted">{t('sell.photoHint', { max: MAX_LISTING_PHOTOS })}</p>
        </div>
        <input ref={input} id="photo-input" type="file" accept={ACCEPT} multiple className="sr-only" onChange={(e) => void upload(e.target.files)} disabled={busy || images.length >= MAX_LISTING_PHOTOS} data-testid="photo-input" />
        <Button type="button" variant="secondary" loading={busy} disabled={images.length >= MAX_LISTING_PHOTOS} onClick={() => input.current?.click()}>
          {progress ?? t('sell.addPhotos')}
        </Button>
      </div>
      {error && <Alert>{error}</Alert>}
      {images.length > 0 && (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="photo-list">
          {images.map((img, i) => (
            <li key={img.id} className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="relative aspect-square bg-muted">
                <img src={img.thumbUrl} alt={`Fotoğraf ${i + 1}`} className="h-full w-full object-cover" />
                {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-fg">KAPAK</span>}
              </div>
              <div className="flex items-center justify-between gap-1 p-1.5 text-xs">
                <button type="button" onClick={() => void move(i, i - 1)} disabled={i === 0} aria-label={t('sell.moveLeft')} className="rounded px-2 py-1 hover:bg-muted disabled:opacity-30">‹</button>
                {i !== 0 && (
                  <button type="button" onClick={() => void move(i, 0)} className="rounded px-1.5 py-1 hover:bg-muted">{t('sell.makeCover')}</button>
                )}
                <button type="button" onClick={() => void remove(img.id)} aria-label={`${t('common.delete')} ${i + 1}`} className="rounded px-2 py-1 text-danger hover:bg-danger/10">✕</button>
                <button type="button" onClick={() => void move(i, i + 1)} disabled={i === images.length - 1} aria-label={t('sell.moveRight')} className="rounded px-2 py-1 hover:bg-muted disabled:opacity-30">›</button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
