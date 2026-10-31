import { ApiError, type ApiClient } from '@kleps/api-client';
import { LISTING_CONDITIONS, LISTING_SORTS, PROVINCES, type CategoryDetailDto } from '@kleps/shared';
import Link from 'next/link';
import { t } from '@/lib/i18n';
import { ListingGrid } from './ListingCard';
import { Pagination } from './Pagination';
import { Alert, EmptyState } from './ui';

export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

const control = 'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none';

/** Server-rendered search results + filter form (plain GET form: works without JavaScript). */
export async function SearchPage({ api, params, basePath, category }: { api: ApiClient; params: RawSearchParams; basePath: string; category?: CategoryDetailDto }) {
  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    const value = first(v);
    if (value) query[k] = value;
  }
  if (category) query.category = category.slug;

  let result: Awaited<ReturnType<ApiClient['listings']['search']>> | null = null;
  let error: string | null = null;
  try {
    result = await api.listings.search(query);
  } catch (err) {
    error = err instanceof ApiError && err.code === 'VALIDATION_ERROR' ? t('errors.VALIDATION_ERROR') : t('common.genericError');
  }

  const brands = category ? category.brands : await api.brands.list().catch(() => []);
  const filterable = category?.attributes.filter((a) => a.filterable) ?? [];
  const hrefFor = (page: number) => {
    const sp = new URLSearchParams({ ...query, page: String(page) });
    sp.delete('category');
    return `${basePath}?${sp.toString()}`;
  };
  const q = first(params.q);

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside aria-label={t('search.filters')}>
        <form method="get" action={basePath} className="space-y-4 rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-semibold">{t('search.filters')}</h2>
          <div>
            <label htmlFor="f-q" className="mb-1 block text-xs font-medium text-fg-muted">
              {t('common.search')}
            </label>
            <input id="f-q" name="q" type="search" defaultValue={q} placeholder={t('search.placeholder')} className={control} />
          </div>
          {brands.length > 0 && (
            <div>
              <label htmlFor="f-brand" className="mb-1 block text-xs font-medium text-fg-muted">
                {t('listing.brand')}
              </label>
              <select id="f-brand" name="brand" defaultValue={first(params.brand)} className={control}>
                <option value="">{t('common.all')}</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <fieldset>
            <legend className="mb-1 text-xs font-medium text-fg-muted">{t('listing.price')}</legend>
            <div className="flex gap-2">
              <input aria-label={t('search.minPrice')} name="minPrice" inputMode="numeric" pattern="[0-9]*" defaultValue={first(params.minPrice)} placeholder={t('search.minPrice')} className={control} />
              <input aria-label={t('search.maxPrice')} name="maxPrice" inputMode="numeric" pattern="[0-9]*" defaultValue={first(params.maxPrice)} placeholder={t('search.maxPrice')} className={control} />
            </div>
          </fieldset>
          <div>
            <label htmlFor="f-city" className="mb-1 block text-xs font-medium text-fg-muted">
              {t('listing.city')}
            </label>
            <select id="f-city" name="city" defaultValue={first(params.city)} className={control}>
              <option value="">{t('common.all')}</option>
              {PROVINCES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-condition" className="mb-1 block text-xs font-medium text-fg-muted">
              {t('listing.condition')}
            </label>
            <select id="f-condition" name="condition" defaultValue={first(params.condition)} className={control}>
              <option value="">{t('common.all')}</option>
              {LISTING_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {t(`listing.conditions.${c}`)}
                </option>
              ))}
            </select>
          </div>
          {filterable.map((attr) => (
            <div key={attr.key}>
              {attr.type === 'NUMBER' ? (
                <fieldset>
                  <legend className="mb-1 text-xs font-medium text-fg-muted">
                    {attr.label} {attr.unit && `(${attr.unit})`}
                  </legend>
                  <div className="flex gap-2">
                    <input aria-label={`${attr.label} en az`} name={`attr_${attr.key}_min`} inputMode="decimal" defaultValue={first(params[`attr_${attr.key}_min`])} placeholder="En az" className={control} />
                    <input aria-label={`${attr.label} en çok`} name={`attr_${attr.key}_max`} inputMode="decimal" defaultValue={first(params[`attr_${attr.key}_max`])} placeholder="En çok" className={control} />
                  </div>
                </fieldset>
              ) : (
                <>
                  <label htmlFor={`f-${attr.key}`} className="mb-1 block text-xs font-medium text-fg-muted">
                    {attr.label}
                  </label>
                  <select id={`f-${attr.key}`} name={`attr_${attr.key}`} defaultValue={first(params[`attr_${attr.key}`])} className={control}>
                    <option value="">{t('common.all')}</option>
                    {attr.type === 'BOOLEAN' ? (
                      <>
                        <option value="true">{t('common.yes')}</option>
                        <option value="false">{t('common.no')}</option>
                      </>
                    ) : (
                      attr.options.map((o) => <option key={o}>{o}</option>)
                    )}
                  </select>
                </>
              )}
            </div>
          ))}
          <div>
            <label htmlFor="f-sort" className="mb-1 block text-xs font-medium text-fg-muted">
              {t('search.sort')}
            </label>
            <select id="f-sort" name="sort" defaultValue={first(params.sort) || 'newest'} className={control}>
              {LISTING_SORTS.map((s) => (
                <option key={s} value={s}>
                  {t(`search.sorts.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg hover:bg-accent-hover">
              {t('search.applyFilters')}
            </button>
            <Link href={basePath} className="rounded-xl border border-line px-4 py-2.5 text-sm hover:bg-muted">
              {t('search.clearFilters')}
            </Link>
          </div>
        </form>
      </aside>
      <section aria-live="polite">
        {error ? (
          <Alert>{error}</Alert>
        ) : result && result.items.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-fg-muted" data-testid="result-count">
              {q ? `${t('search.resultsFor', { q })} · ` : ''}
              {t('common.results', { count: result.total })}
            </p>
            <ListingGrid listings={result.items} />
            <Pagination page={result.page} totalPages={result.totalPages} hrefFor={hrefFor} />
          </>
        ) : (
          <EmptyState title={t('search.empty')} hint={t('search.emptyHint')} />
        )}
      </section>
    </div>
  );
}
