import type { Metadata } from 'next';
import { SearchPage, type RawSearchParams } from '@/components/SearchPage';
import { t } from '@/lib/i18n';
import { publicApi } from '@/lib/session';

export const metadata: Metadata = { title: 'İlan ara' };

export default async function SearchRoute({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const api = await publicApi();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t('search.title')}</h1>
      <SearchPage api={api} params={await searchParams} basePath="/ara" />
    </div>
  );
}
