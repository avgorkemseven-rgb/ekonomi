'use client';
import type { MeDto } from '@kleps/shared';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { t } from '@/lib/i18n';
import { Spinner } from './ui';

const AdminContext = createContext<{ user: MeDto | null; setUser: (u: MeDto | null) => void }>({ user: null, setUser: () => undefined });
export const useAdmin = () => useContext(AdminContext);

const NAV = [
  { href: '/', label: t('admin.dashboard') },
  { href: '/moderasyon', label: t('admin.moderation') },
  { href: '/kategoriler', label: t('admin.categories') },
  { href: '/kullanicilar', label: 'Kullanıcılar', adminOnly: true },
  { href: '/kayitlar', label: t('admin.auditLog') },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      setUser(((await res.json()) as { user: MeDto | null }).user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => void load(), [load]);

  useEffect(() => {
    if (!loading && !user && pathname !== '/login') router.replace('/login');
  }, [loading, user, pathname, router]);

  if (pathname === '/login') return <AdminContext.Provider value={{ user, setUser }}>{children}</AdminContext.Provider>;
  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-accent">
        <Spinner />
      </div>
    );
  }

  return (
    <AdminContext.Provider value={{ user, setUser }}>
      <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
        <aside className="border-b border-line bg-surface p-4 md:min-h-screen md:border-b-0 md:border-r">
          <p className="wordmark text-lg">
            KLEPS<span className="text-accent">.</span> <span className="text-xs font-semibold tracking-normal text-fg-muted">YÖNETİM</span>
          </p>
          <nav aria-label="Yönetim menüsü" className="mt-6 flex gap-1 overflow-x-auto md:flex-col">
            {NAV.filter((n) => !n.adminOnly || user.role === 'ADMIN').map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={pathname === n.href ? 'page' : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${pathname === n.href ? 'bg-accent-soft font-semibold text-accent' : 'hover:bg-muted'}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 hidden text-xs text-fg-muted md:block">
            <p className="font-medium text-fg">{user.displayName}</p>
            <p>{user.role}</p>
            <button
              type="button"
              className="mt-2 text-accent hover:underline"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                setUser(null);
                router.replace('/login');
              }}
            >
              {t('nav.logout')}
            </button>
          </div>
        </aside>
        <main id="main" className="p-4 md:p-8">
          {children}
        </main>
      </div>
    </AdminContext.Provider>
  );
}
