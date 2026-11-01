import type { CategoryNodeDto } from '@kleps/shared';
import Link from 'next/link';

const ICONS: Record<string, string> = { billiards: '🎱', darts: '🎯', cue: '🎱', table: '🟩', balls: '⚪', accessory: '🧰', dart: '🎯', dartboard: '🎯' };

export function CategoryGrid({ categories }: { categories: CategoryNodeDto[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {categories.map((root) => (
        <section key={root.id} className="rounded-2xl border border-line bg-surface p-5" aria-labelledby={`cat-${root.slug}`}>
          <Link href={`/kategori/${root.slug}`} className="flex items-center gap-3 hover:text-accent">
            <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-xl">
              {ICONS[root.icon ?? ''] ?? '🏅'}
            </span>
            <h3 id={`cat-${root.slug}`} className="text-lg font-bold">
              {root.name}
            </h3>
          </Link>
          <ul className="mt-4 flex flex-wrap gap-2">
            {root.children.map((child) => (
              <li key={child.id}>
                <Link href={`/kategori/${child.slug}`} className="inline-block rounded-full border border-line px-3.5 py-1.5 text-sm hover:border-accent hover:text-accent">
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
