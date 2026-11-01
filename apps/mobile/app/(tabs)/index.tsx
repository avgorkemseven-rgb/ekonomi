import type { CategoryNodeDto } from '@kleps/shared';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/api';
import { ListingList } from '@/components/ListingList';
import { Empty, ErrorView, Input, Loading, Wordmark } from '@/components/ui';
import { usePaginated } from '@/components/usePaginated';
import { t } from '@/i18n';
import { fontSizes, radii, spacing, useTheme } from '@/theme';

export default function DiscoverScreen() {
  const c = useTheme();
  const [categories, setCategories] = useState<CategoryNodeDto[]>([]);
  const [q, setQ] = useState('');
  const feed = usePaginated((page) => api.listings.search({ page, pageSize: 20 }), []);

  useEffect(() => {
    api.categories.tree().then(setCategories, () => setCategories([]));
  }, []);

  if (feed.loading) return <Loading />;
  if (feed.error) return <ErrorView message={feed.error} onRetry={() => void feed.reload()} />;

  const header = (
    <View style={{ gap: spacing.lg, marginBottom: spacing.sm }}>
      <Wordmark />
      <Text style={{ color: c.text, fontSize: fontSizes.xl, fontWeight: '800' }}>{t('home.heroTitle')}</Text>
      <Input
        accessibilityLabel={t('search.placeholder')}
        placeholder={t('home.searchPlaceholder')}
        value={q}
        onChangeText={setQ}
        returnKeyType="search"
        onSubmitEditing={() => router.push({ pathname: '/search', params: { q } })}
      />
      {categories.map((root) => (
        <View key={root.id} style={{ gap: spacing.sm }}>
          <Link href={`/category/${root.slug}`} asChild>
            <Pressable accessibilityRole="link"><Text style={{ color: c.text, fontWeight: '700', fontSize: fontSizes.lg }}>{root.name}</Text></Pressable>
          </Link>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {root.children.map((child) => (
              <Link key={child.id} href={`/category/${child.slug}`} asChild>
                <Pressable accessibilityRole="link" style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Text style={{ color: c.text, fontSize: fontSizes.sm }}>{child.name}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        </View>
      ))}
      <Text style={{ color: c.text, fontWeight: '700', fontSize: fontSizes.lg, marginTop: spacing.sm }}>{t('home.latest')}</Text>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <ListingList items={feed.items} header={header} empty={<Empty title={t('home.emptyLatest')} />} onEndReached={() => void feed.loadMore()} refreshing={feed.refreshing} onRefresh={() => void feed.reload(true)} />
    </SafeAreaView>
  );
}
