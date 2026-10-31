import Link from 'next/link';
import { t } from '@/lib/i18n';

export function Pagination({ page, totalPages, hrefFor }: { page: number; totalPages: number; hrefFor: (page: number) => string }) {
  if (totalPages <= 1) return null;
  const cls = 'rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-muted';
  return (
    <nav aria-label="Sayfalama" className="mt-8 flex items-center justify-center gap-3">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} className={cls} rel="prev">
          {t('common.previous')}
        </Link>
      )}
      <span className="text-sm text-fg-muted" aria-current="page">
        {t('common.page', { page, total: totalPages })}
      </span>
      {page < totalPages && (
        <Link href={hrefFor(page + 1)} className={cls} rel="next">
          {t('common.next')}
        </Link>
      )}
    </nav>
  );
}
