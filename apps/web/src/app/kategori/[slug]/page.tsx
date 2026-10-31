import { ApiError } from '@kleps/api-client';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SearchPage, type RawSearchParams } from '@/components/SearchPage';
import { publicApi } from '@/lib/session';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> };

async function load(slug: string) {
  const api = await publicApi();
  try {
    return { api, category: await api.categories.detail(slug) };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { category } = await load(slug);
  return { title: `${category.name} ilanları` };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { api, category } = await load(slug);
  return (
    <div className="space-y-5">
      <nav aria-label="Konum" className="text-sm text-fg-muted">
        <Link href="/" className="hover:text-accent">
          Ana sayfa
        </Link>
        {category.path.map((p) => (
          <span key={p.id}>
            {' / '}
            <Link href={`/kategori/${p.slug}`} className="hover:text-accent" aria-current={p.id === category.id ? 'page' : undefined}>
              {p.name}
            </Link>
          </span>
        ))}
      </nav>
      <h1 className="text-2xl font-bold">{category.name}</h1>
      {category.children.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {category.children.map((c) => (
            <li key={c.id}>
              <Link href={`/kategori/${c.slug}`} className="inline-block rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm hover:border-accent hover:text-accent">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <SearchPage api={api} params={await searchParams} basePath={`/kategori/${category.slug}`} category={category} />
    </div>
  );
}
