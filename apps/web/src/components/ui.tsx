import Link from 'next/link';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
  secondary: 'border border-line bg-surface text-fg hover:bg-muted',
  ghost: 'text-fg hover:bg-muted',
  danger: 'border border-danger/40 bg-surface text-danger hover:bg-danger/10',
};
const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';

export function Button({
  variant = 'primary',
  loading,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button className={`${btnBase} ${variants[variant]} ${className}`} disabled={loading || props.disabled} aria-busy={loading} {...props}>
      {loading && <Spinner small />}
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = 'primary', className = '', children }: { href: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={`${btnBase} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Spinner({ small }: { small?: boolean }) {
  return (
    <span
      role="status"
      aria-label="Yükleniyor"
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${small ? 'h-4 w-4' : 'h-6 w-6'}`}
    />
  );
}

const control =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none aria-[invalid=true]:border-danger';

export function Field({ label, htmlFor, error, hint, children, optional }: { label: string; htmlFor: string; error?: string; hint?: string; optional?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label} {optional && <span className="font-normal text-fg-muted">(isteğe bağlı)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-fg-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ invalid, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={`${control} ${className}`} aria-invalid={invalid || undefined} aria-describedby={invalid && props.id ? `${props.id}-error` : undefined} {...props} />;
}

export function Textarea({ invalid, className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={`${control} min-h-32 ${className}`} aria-invalid={invalid || undefined} aria-describedby={invalid && props.id ? `${props.id}-error` : undefined} {...props} />;
}

export function Select({ invalid, className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select className={`${control} ${className}`} aria-invalid={invalid || undefined} aria-describedby={invalid && props.id ? `${props.id}-error` : undefined} {...props}>
      {children}
    </select>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' }) {
  const tones = {
    neutral: 'bg-muted text-fg-muted',
    accent: 'bg-accent-soft text-accent',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Alert({ children, tone = 'danger' }: { children: ReactNode; tone?: 'danger' | 'success' | 'info' }) {
  const tones = { danger: 'border-danger/30 bg-danger/5 text-danger', success: 'border-success/30 bg-success/5 text-success', info: 'border-accent/30 bg-accent-soft text-fg' };
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
      <p className="font-semibold">{title}</p>
      {hint && <p className="mt-1 text-sm text-fg-muted">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>{children}</div>;
}
