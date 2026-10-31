import type { ListingDetailDto } from '@kleps/shared';
import { formatPrice } from '@kleps/shared';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Dimensions, FlatList, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '@/api';
import { Badge, Button, ErrorView, Loading } from '@/components/ui';
import { errorMessage, t } from '@/i18n';
import { fontSizes, radii, spacing, useTheme } from '@/theme';

const WIDTH = Dimensions.get('window').width;

function attrValue(v: string | number | boolean, unit: string | null): string {
  if (typeof v === 'boolean') return v ? t('common.yes') : t('common.no');
  return unit ? `${v} ${unit}` : String(v);
}

export default function ListingScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<ListingDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);

  const load = useCallback(() => {
    setError(null);
    api.listings.get(id).then(setListing, (e: unknown) => setError(errorMessage(e)));
  }, [id]);
  useEffect(load, [load]);

  if (error) return <ErrorView message={error} onRetry={load} />;
  if (!listing) return <Loading />;

  const attrs = listing.attributeDefinitions.filter((d) => listing.attributes[d.key] !== undefined);
  const row = (label: string, value: string) => (
    <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <Text style={{ color: c.textMuted }}>{label}</Text>
      <Text style={{ color: c.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
      {listing.images.length ? (
        <View>
          <FlatList
            data={listing.images}
            horizontal
            pagingEnabled
            keyExtractor={(i) => i.id}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / WIDTH))}
            renderItem={({ item, index: i }) => (
              <Image source={{ uri: item.url }} style={{ width: WIDTH, height: WIDTH * 0.75, backgroundColor: c.surfaceMuted }} resizeMode="contain" accessibilityLabel={`${listing.title} ${i + 1}/${listing.images.length}`} />
            )}
          />
          {listing.images.length > 1 && (
            <Text style={{ position: 'absolute', right: 12, bottom: 12, color: '#fff', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, fontSize: fontSizes.xs }}>
              {index + 1} / {listing.images.length}
            </Text>
          )}
        </View>
      ) : (
        <View style={{ height: WIDTH * 0.6, backgroundColor: c.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.textMuted }}>{t('listing.noPhotos')}</Text></View>
      )}

      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        {listing.isOwner && listing.status !== 'ACTIVE' && <Badge text={t(`listing.statuses.${listing.status}`)} tone="warning" />}
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: fontSizes.xl, fontWeight: '700' }}>{listing.title}</Text>
        <Text style={{ color: c.text, fontSize: fontSizes.xxl, fontWeight: '900' }}>{listing.priceAmount == null ? t('listing.priceOnRequest') : formatPrice(listing.priceAmount)}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {listing.condition && <Badge text={t(`listing.conditions.${listing.condition}`)} tone="accent" />}
          {listing.allowsInPerson && <Badge text={t('listing.allowsInPerson')} />}
          {listing.allowsShipping && <Badge text={t('listing.allowsShipping')} />}
        </View>
        <Text style={{ color: c.textMuted }}>{listing.categoryPath.map((p) => p.name).join(' › ')} · {[listing.city, listing.district].filter(Boolean).join(' / ')}</Text>

        <View style={{ backgroundColor: c.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg }}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: fontSizes.lg, marginBottom: spacing.sm }}>{t('listing.description')}</Text>
          <Text style={{ color: c.text, lineHeight: 22 }}>{listing.description}</Text>
        </View>

        {(attrs.length > 0 || listing.brand) && (
          <View style={{ backgroundColor: c.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
            {listing.brand && row(t('listing.brand'), listing.brand.name)}
            {listing.model && row(t('listing.model'), listing.model.name)}
            {attrs.map((d) => row(d.label, attrValue(listing.attributes[d.key]!, d.unit)))}
          </View>
        )}

        <Link href={`/seller/${listing.seller.username}`} asChild>
          <Pressable accessibilityRole="link" style={{ backgroundColor: c.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: c.accent, fontWeight: '800' }}>{listing.seller.displayName.slice(0, 1).toLocaleUpperCase('tr-TR')}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontWeight: '700' }}>{listing.seller.displayName}</Text>
              <Text style={{ color: c.textMuted, fontSize: fontSizes.xs }}>@{listing.seller.username} · {listing.seller.verificationStatus === 'VERIFIED' ? t('seller.verified') : listing.seller.sellerType === 'BUSINESS' ? t('seller.business') : t('seller.individual')}</Text>
            </View>
            <Text style={{ color: c.textMuted }}>›</Text>
          </Pressable>
        </Link>
        <Text style={{ color: c.textMuted, fontSize: fontSizes.xs }}>{t('listing.contactSoon')}</Text>
        {listing.isOwner && <Button title={t('common.edit')} variant="secondary" onPress={() => router.push(`/edit/${listing.id}`)} />}
      </View>
    </ScrollView>
  );
}
