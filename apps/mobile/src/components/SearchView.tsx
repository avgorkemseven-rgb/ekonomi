import { LISTING_CONDITIONS, LISTING_SORTS, PROVINCES, type ListingCondition, type ListingSort } from '@kleps/shared';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api } from '../api';
import { ListingList } from './ListingList';
import { Empty, ErrorView, Input, Loading, Picker } from './ui';
import { usePaginated } from './usePaginated';
import { t } from '../i18n';
import { fontSizes, spacing, useTheme } from '../theme';

export function SearchView({ category }: { category?: string }) {
  const c = useTheme();
  const params = useLocalSearchParams<{ q?: string }>();
  const [input, setInput] = useState(params.q ?? '');
  const [q, setQ] = useState(params.q ?? '');
  const [city, setCity] = useState<string>('');
  const [condition, setCondition] = useState<ListingCondition | ''>('');
  const [sort, setSort] = useState<ListingSort>('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [applied, setApplied] = useState(0);

  const results = usePaginated(
    (page) => api.listings.search({ q, category, city, condition, sort, minPrice: minPrice || undefined, maxPrice: maxPrice || undefined, page, pageSize: 20 }),
    [q, category, city, condition, sort, applied],
  );

  const header = (
    <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
      <Input accessibilityLabel={t('search.placeholder')} placeholder={t('search.placeholder')} value={input} onChangeText={setInput} returnKeyType="search" onSubmitEditing={() => setQ(input.trim())} />
      <Pressable accessibilityRole="button" onPress={() => setShowFilters((s) => !s)}>
        <Text style={{ color: c.accent, fontWeight: '600' }}>{t('search.filters')} {showFilters ? '▲' : '▼'}</Text>
      </Pressable>
      {showFilters && (
        <View style={{ gap: spacing.md }}>
          <Picker label={t('listing.city')} value={city} placeholder={t('common.all')} options={PROVINCES.map((p) => ({ value: p, label: p }))} onChange={setCity} />
          <Picker label={t('listing.condition')} value={condition} placeholder={t('common.all')} options={LISTING_CONDITIONS.map((x) => ({ value: x, label: t(`listing.conditions.${x}`) }))} onChange={setCondition} />
          <Picker label={t('search.sort')} value={sort} options={LISTING_SORTS.map((x) => ({ value: x, label: t(`search.sorts.${x}`) }))} onChange={(v) => setSort(v || 'newest')} />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Input style={{ flex: 1 }} accessibilityLabel={t('search.minPrice')} placeholder={t('search.minPrice')} keyboardType="number-pad" value={minPrice} onChangeText={setMinPrice} onEndEditing={() => setApplied((n) => n + 1)} />
            <Input style={{ flex: 1 }} accessibilityLabel={t('search.maxPrice')} placeholder={t('search.maxPrice')} keyboardType="number-pad" value={maxPrice} onChangeText={setMaxPrice} onEndEditing={() => setApplied((n) => n + 1)} />
          </View>
        </View>
      )}
      {!results.loading && <Text style={{ color: c.textMuted, fontSize: fontSizes.sm }}>{t('common.results', { count: results.total })}</Text>}
    </View>
  );

  if (results.error) return <ErrorView message={results.error} onRetry={() => void results.reload()} />;
  return (
    <ListingList
      items={results.items}
      header={header}
      empty={results.loading ? <Loading /> : <Empty title={t('search.empty')}><Text style={{ color: c.textMuted }}>{t('search.emptyHint')}</Text></Empty>}
      onEndReached={() => void results.loadMore()}
      refreshing={results.refreshing}
      onRefresh={() => void results.reload(true)}
    />
  );
}
