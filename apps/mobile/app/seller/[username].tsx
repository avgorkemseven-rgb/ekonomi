import type { PublicUserDto } from '@kleps/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '@/api';
import { ListingList } from '@/components/ListingList';
import { Badge, Empty, ErrorView, Loading } from '@/components/ui';
import { usePaginated } from '@/components/usePaginated';
import { errorMessage, t } from '@/i18n';
import { fontSizes, spacing, useTheme } from '@/theme';

const monthFmt = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });

export default function SellerScreen() {
  const c = useTheme();
  const { username } = useLocalSearchParams<{ username: string }>();
  const [profile, setProfile] = useState<PublicUserDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listings = usePaginated((page) => api.users.listings(username, { page, pageSize: 20 }), [username]);

  useEffect(() => {
    api.users.profile(username).then(setProfile, (e: unknown) => setError(errorMessage(e)));
  }, [username]);

  if (error) return <ErrorView message={error} />;
  if (!profile) return <Loading />;

  const header = (
    <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
      <Text accessibilityRole="header" style={{ color: c.text, fontSize: fontSizes.xxl, fontWeight: '800' }}>{profile.displayName}</Text>
      <Text style={{ color: c.textMuted }}>@{profile.username}{profile.city ? ` · ${profile.city}` : ''}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {profile.verificationStatus === 'VERIFIED' && <Badge text={t('seller.verified')} tone="success" />}
        <Badge text={profile.sellerType === 'BUSINESS' ? t('seller.business') : t('seller.individual')} />
        <Badge text={t('seller.activeListings', { count: profile.activeListingCount })} tone="accent" />
      </View>
      {profile.bio && <Text style={{ color: c.text }}>{profile.bio}</Text>}
      <Text style={{ color: c.textMuted, fontSize: fontSizes.xs }}>{t('seller.memberSince', { date: monthFmt.format(new Date(profile.memberSince)) })}</Text>
    </View>
  );
  return (
    <ListingList items={listings.items} header={header} empty={listings.loading ? <Loading /> : <Empty title={t('seller.noListings')} />} onEndReached={() => void listings.loadMore()} refreshing={listings.refreshing} onRefresh={() => void listings.reload(true)} />
  );
}
