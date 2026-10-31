import type { ListingCardDto } from '@kleps/shared';
import { formatPrice } from '@kleps/shared';
import { Link } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';
import { t } from '../i18n';
import { fontSizes, radii, spacing, useTheme } from '../theme';
import { Badge } from './ui';

export function ListingCard({ listing, showStatus }: { listing: ListingCardDto; showStatus?: boolean }) {
  const c = useTheme();
  const price = listing.priceAmount == null ? t('listing.priceOnRequest') : formatPrice(listing.priceAmount);
  return (
    <Link href={`/listing/${listing.id}`} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={`${listing.title}, ${price}`} style={{ flex: 1, backgroundColor: c.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
        {listing.coverImage ? (
          <Image source={{ uri: listing.coverImage.thumbUrl }} style={{ width: '100%', aspectRatio: 4 / 3, backgroundColor: c.surfaceMuted }} accessibilityIgnoresInvertColors />
        ) : (
          <View style={{ width: '100%', aspectRatio: 4 / 3, backgroundColor: c.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: c.textMuted, fontSize: fontSizes.xs }}>{t('listing.noPhotos')}</Text>
          </View>
        )}
        <View style={{ padding: spacing.md, gap: 4 }}>
          <Text numberOfLines={2} style={{ color: c.text, fontSize: fontSizes.sm, fontWeight: '500' }}>{listing.title}</Text>
          <Text style={{ color: c.text, fontSize: fontSizes.md, fontWeight: '800' }}>{price}</Text>
          <Text style={{ color: c.textMuted, fontSize: fontSizes.xs }}>{[listing.city, listing.district].filter(Boolean).join(' / ')}</Text>
          {showStatus && <Badge text={t(`listing.statuses.${listing.status}`)} tone={listing.status === 'ACTIVE' ? 'success' : listing.status === 'PENDING_REVIEW' ? 'warning' : 'neutral'} />}
        </View>
      </Pressable>
    </Link>
  );
}
