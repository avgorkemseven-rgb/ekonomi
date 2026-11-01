'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useSession } from './SessionProvider';
import { Spinner } from './ui';

/** Client-side gate for account pages (the API enforces authorization regardless). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!loading && !user) router.replace(`/giris?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);
  if (loading || !user) {
    return (
      <div className="flex justify-center py-24 text-accent">
        <Spinner />
      </div>
    );
  }
  return <>{children}</>;
}
