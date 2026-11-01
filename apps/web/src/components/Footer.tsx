import { t } from '@/lib/i18n';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-fg-muted sm:flex-row sm:justify-between">
        <p>
          <span className="wordmark text-fg">KLEPS</span> · {t('brand.tagline')}
        </p>
        <p>© {new Date().getFullYear()} KLEPS · Türkiye</p>
      </div>
    </footer>
  );
}
