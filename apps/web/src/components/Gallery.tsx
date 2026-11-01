'use client';
import type { ListingImageDto } from '@kleps/shared';
import { useState } from 'react';
import { t } from '@/lib/i18n';

/** Accessible image gallery: arrow keys switch photos, thumbnails are buttons. */
export function Gallery({ images, title }: { images: ListingImageDto[]; title: string }) {
  const [index, setIndex] = useState(0);
  if (images.length === 0) {
    return <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-muted text-sm text-fg-muted">{t('listing.noPhotos')}</div>;
  }
  const current = images[Math.min(index, images.length - 1)]!;
  const go = (delta: number) => setIndex((i) => (i + delta + images.length) % images.length);

  return (
    <div
      className="space-y-3"
      tabIndex={0}
      role="region"
      aria-roledescription="galeri"
      aria-label={`${title} — ${t('listing.photos')}`}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1);
        if (e.key === 'ArrowLeft') go(-1);
      }}
    >
      <div className="relative overflow-hidden rounded-2xl bg-muted">
        <img src={current.url} alt={`${title} — ${index + 1}/${images.length}`} width={current.width} height={current.height} className="mx-auto max-h-[560px] w-full object-contain" />
        {images.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Önceki fotoğraf" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-surface/90 px-3 py-2 shadow">
              ‹
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Sonraki fotoğraf" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-surface/90 px-3 py-2 shadow">
              ›
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
              {index + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Fotoğraf ${i + 1}`}
                aria-current={i === index}
                className={`h-16 w-20 overflow-hidden rounded-lg border-2 ${i === index ? 'border-accent' : 'border-transparent'}`}
              >
                <img src={img.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
