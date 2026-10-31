'use client';
import { Button, EmptyState } from '@/components/ui';
import { t } from '@/lib/i18n';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <EmptyState title={t('common.genericError')} action={<Button onClick={reset}>{t('common.retry')}</Button>} />;
}
