'use client';
import type { MeDto } from '@kleps/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { tr, t } from '@/lib/i18n';
import { useSession } from './SessionProvider';
import { Alert, Button, Field, Input } from './ui';

interface ErrorBody {
  error?: string;
  issues?: { path: string[]; message: string }[];
}

function safeNext(next: string | null): string {
  // Only allow same-site relative redirects.
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = useSession();
  const [error, setError] = useState<ErrorBody | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fieldErr = (field: string) => {
    const key = error?.issues?.find((i) => i.path[0] === field)?.message;
    return key ? tr(key, t('validation.invalid')) : undefined;
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const res = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as ErrorBody & { user?: MeDto };
      if (!res.ok) {
        setError(data);
        return;
      }
      setUser(data.user ?? null);
      router.push(safeNext(params.get('next')));
      router.refresh();
    } catch {
      setError({ error: 'NETWORK_ERROR' });
    } finally {
      setSubmitting(false);
    }
  }

  const isRegister = mode === 'register';
  const topError = error && (!error.issues?.length || error.error !== 'VALIDATION_ERROR')
    ? error.error === 'NETWORK_ERROR' ? t('common.networkError') : tr(`errors.${error.error}`)
    : null;

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <h1 className="text-2xl font-bold">{isRegister ? t('auth.registerTitle') : t('auth.loginTitle')}</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          {topError && <Alert>{topError}</Alert>}
          {isRegister && (
            <>
              <Field label={t('auth.displayName')} htmlFor="displayName" error={fieldErr('displayName')}>
                <Input id="displayName" name="displayName" autoComplete="name" required invalid={!!fieldErr('displayName')} />
              </Field>
              <Field label={t('auth.username')} htmlFor="username" error={fieldErr('username')} hint={t('auth.usernameHint')}>
                <Input id="username" name="username" autoComplete="username" required invalid={!!fieldErr('username')} />
              </Field>
            </>
          )}
          <Field label={t('auth.email')} htmlFor="email" error={fieldErr('email')}>
            <Input id="email" name="email" type="email" autoComplete="email" required invalid={!!fieldErr('email')} />
          </Field>
          <Field label={t('auth.password')} htmlFor="password" error={fieldErr('password')} hint={isRegister ? t('auth.passwordHint') : undefined}>
            <Input id="password" name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} required invalid={!!fieldErr('password')} />
          </Field>
          {isRegister && <p className="text-xs text-fg-muted">{t('auth.termsNotice')}</p>}
          <Button type="submit" loading={submitting} className="w-full">
            {isRegister ? t('auth.registerCta') : t('auth.loginCta')}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-fg-muted">
          {isRegister ? t('auth.haveAccount') : t('auth.noAccount')}{' '}
          <Link href={`${isRegister ? '/giris' : '/kayit'}${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`} className="font-semibold text-accent hover:underline">
            {isRegister ? t('nav.login') : t('nav.register')}
          </Link>
        </p>
      </div>
    </div>
  );
}
