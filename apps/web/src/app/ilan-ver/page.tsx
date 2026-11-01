'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CategoryPicker } from '@/components/CategoryPicker';
import { ListingForm } from '@/components/ListingForm';
import { RequireAuth } from '@/components/RequireAuth';
import { Card } from '@/components/ui';
import { t } from '@/lib/i18n';

export default function SellPage() {
  const router = useRouter();
  const [category, setCategory] = useState<{ id: string; slug: string; name: string } | null>(null);

  return (
    <RequireAuth>
      <div className="mx-auto max-w-3xl space-y-5">
        <h1 className="text-2xl font-bold">{t('sell.title')}</h1>
        <ol className="flex gap-2 text-xs font-medium" aria-label="Adımlar">
          {[t('sell.stepCategory'), t('sell.stepDetails'), t('sell.stepPhotos'), t('sell.stepReview')].map((s, i) => (
            <li key={s} aria-current={(category ? 1 : 0) === i ? 'step' : undefined} className={`rounded-full px-3 py-1 ${(category ? 1 : 0) === i ? 'bg-accent text-accent-fg' : 'bg-muted text-fg-muted'}`}>
              {i + 1}. {s}
            </li>
          ))}
        </ol>
        <Card>
          {category ? (
            <div className="space-y-4">
              <button type="button" onClick={() => setCategory(null)} className="text-sm font-medium text-accent hover:underline">
                ‹ {t('sell.stepCategory')}
              </button>
              <ListingForm categorySlug={category.slug} submitLabel={t('sell.continueToPhotos')} onSaved={(l) => router.push(`/ilan-duzenle/${l.id}`)} />
            </div>
          ) : (
            <CategoryPicker onPick={setCategory} />
          )}
        </Card>
      </div>
    </RequireAuth>
  );
}
