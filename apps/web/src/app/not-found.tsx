import { EmptyState, LinkButton } from '@/components/ui';
import { t } from '@/lib/i18n';

export default function NotFound() {
  return <EmptyState title={t('common.notFound')} action={<LinkButton href="/">{t('common.home')}</LinkButton>} />;
}
