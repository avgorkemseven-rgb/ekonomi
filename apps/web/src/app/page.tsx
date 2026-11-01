import Link from 'next/link';
import { CategoryGrid } from '@/components/CategoryGrid';
import { ListingGrid } from '@/components/ListingCard';
import { Alert, EmptyState, LinkButton } from '@/components/ui';
import { t } from '@/lib/i18n';
import { publicApi } from '@/lib/session';

export default async function HomePage() {
  const api = await publicApi();
  const [categories, latest] = await Promise.allSettled([api.categories.tree(), api.listings.search({ pageSize: 12 })]);

  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-fg px-6 py-10 text-bg sm:px-10 sm:py-14">
        <p className="wordmark text-sm text-bg/70">KLEPS</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-black leading-tight sm:text-4xl">{t('home.heroTitle')}</h1>
        <p className="mt-3 max-w-xl text-bg/80">{t('home.heroSubtitle')}</p>
        <form action="/ara" method="get" role="search" className="mt-6 flex max-w-xl gap-2">
          <label htmlFor="hero-q" className="sr-only">
            {t('search.placeholder')}
          </label>
          <input id="hero-q" name="q" type="search" placeholder={t('home.searchPlaceholder')} className="min-w-0 flex-1 rounded-xl border-0 bg-surface px-4 py-3 text-fg focus:outline-none" />
          <button className="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-fg hover:bg-accent-hover">{t('common.search')}</button>
        </form>
      </section>

      <section aria-labelledby="home-categories">
        <h2 id="home-categories" className="mb-4 text-xl font-bold">
          {t('home.categories')}
        </h2>
        {categories.status === 'fulfilled' ? <CategoryGrid categories={categories.value} /> : <Alert>{t('common.genericError')}</Alert>}
      </section>

      <section aria-labelledby="home-latest">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="home-latest" className="text-xl font-bold">
            {t('home.latest')}
          </h2>
          <Link href="/ara" className="text-sm font-medium text-accent hover:underline">
            {t('common.seeAll')}
          </Link>
        </div>
        {latest.status === 'rejected' ? (
          <Alert>{t('common.genericError')}</Alert>
        ) : latest.value.items.length ? (
          <ListingGrid listings={latest.value.items} />
        ) : (
          <EmptyState title={t('home.emptyLatest')} action={<LinkButton href="/ilan-ver">{t('nav.sell')}</LinkButton>} />
        )}
      </section>
    </div>
  );
}
