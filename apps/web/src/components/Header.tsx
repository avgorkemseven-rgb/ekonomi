'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { t } from '@/lib/i18n';
import { useSession } from './SessionProvider';
import { Wordmark } from './Wordmark';

export function Header() {
  const { user, loading, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState('');

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `/ara?q=${encodeURIComponent(q.trim())}` : '/ara');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <a href="#main" className="skip-link">
        İçeriğe geç
      </a>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Wordmark />
        <form role="search" onSubmit={onSearch} className="ml-2 hidden flex-1 sm:block">
          <label htmlFor="header-search" className="sr-only">
            {t('search.placeholder')}
          </label>
          <input
            id="header-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('home.searchPlaceholder')}
            className="w-full max-w-md rounded-xl border border-line bg-bg px-3.5 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </form>
        <nav aria-label="Ana menü" className="ml-auto flex items-center gap-1 text-sm">
          <Link href="/ara" className="rounded-lg px-3 py-2 hover:bg-muted sm:hidden">
            {t('nav.search')}
          </Link>
          {!loading && user ? (
            <>
              <Link href="/hesabim/ilanlar" className={`rounded-lg px-3 py-2 hover:bg-muted ${pathname.startsWith('/hesabim') ? 'font-semibold' : ''}`}>
                {t('nav.myListings')}
              </Link>
              <Link href="/hesabim" className="hidden rounded-lg px-3 py-2 hover:bg-muted md:inline">
                {t('nav.account')}
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  router.push('/');
                  router.refresh();
                }}
                className="hidden rounded-lg px-3 py-2 hover:bg-muted md:inline"
              >
                {t('nav.logout')}
              </button>
            </>
          ) : !loading ? (
            <Link href={`/giris?next=${encodeURIComponent(pathname)}`} className="rounded-lg px-3 py-2 hover:bg-muted">
              {t('nav.login')}
            </Link>
          ) : null}
          <Link href="/ilan-ver" className="ml-1 rounded-xl bg-accent px-4 py-2 font-semibold text-accent-fg hover:bg-accent-hover">
            {t('nav.sell')}
          </Link>
        </nav>
      </div>
    </header>
  );
}
