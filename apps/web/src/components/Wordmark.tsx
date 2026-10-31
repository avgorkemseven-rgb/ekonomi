import Link from 'next/link';

/** Temporary typographic KLEPS wordmark (not a final trademark asset). */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <Link href="/" aria-label="KLEPS ana sayfa" className={`wordmark text-xl text-fg ${className}`}>
      KLEPS<span className="text-accent">.</span>
    </Link>
  );
}
