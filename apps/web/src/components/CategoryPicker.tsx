'use client';
import type { CategoryNodeDto } from '@kleps/shared';
import { useEffect, useState } from 'react';
import { browserApi, errorMessage } from '@/lib/browser-api';
import { t } from '@/lib/i18n';
import { Alert, Button, Spinner } from './ui';

/** Two-level (or deeper) category drill-down; resolves when a leaf is chosen. */
export function CategoryPicker({ onPick }: { onPick: (category: { id: string; slug: string; name: string }) => void }) {
  const [tree, setTree] = useState<CategoryNodeDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trail, setTrail] = useState<CategoryNodeDto[]>([]);

  useEffect(() => {
    browserApi.categories.tree().then(setTree, (e: unknown) => setError(errorMessage(e)));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!tree) return <div className="flex justify-center py-10 text-accent"><Spinner /></div>;

  const current = trail.length ? trail[trail.length - 1]!.children : tree;
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{trail.length ? t('sell.chooseSubcategory') : t('sell.chooseCategory')}</h2>
      {trail.length > 0 && (
        <p className="text-sm text-fg-muted">
          {trail.map((c) => c.name).join(' › ')}{' '}
          <button type="button" className="ml-2 font-medium text-accent hover:underline" onClick={() => setTrail(trail.slice(0, -1))}>
            {t('common.back')}
          </button>
        </p>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {current.map((c) => (
          <li key={c.id}>
            <Button
              type="button"
              variant="secondary"
              className="w-full justify-between py-4 text-left"
              onClick={() => (c.children.length ? setTrail([...trail, c]) : onPick({ id: c.id, slug: c.slug, name: c.name }))}
            >
              <span>{c.name}</span>
              <span aria-hidden>›</span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
