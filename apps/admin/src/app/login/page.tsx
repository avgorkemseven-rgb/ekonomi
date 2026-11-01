'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAdmin } from '@/components/AdminShell';
import { Alert, Button, Field, Input } from '@/components/ui';
import { t, tr } from '@/lib/i18n';

export default function AdminLogin() {
  const router = useRouter();
  const { setUser } = useAdmin();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error === 'FORBIDDEN' ? t('admin.notAdmin') : tr(`errors.${data.error}`));
        return;
      }
      setUser(data.user);
      router.replace('/');
    } catch {
      setError(t('common.networkError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-surface p-6">
        <h1 className="wordmark text-xl">
          KLEPS<span className="text-accent">.</span> <span className="text-sm tracking-normal text-fg-muted">Yönetim</span>
        </h1>
        {error && <Alert>{error}</Alert>}
        <Field label={t('auth.email')} htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="username" required />
        </Field>
        <Field label={t('auth.password')} htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Button type="submit" loading={busy} className="w-full">
          {t('auth.loginCta')}
        </Button>
      </form>
    </div>
  );
}
