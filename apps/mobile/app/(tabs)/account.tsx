import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { Button, Loading } from '@/components/ui';
import { t } from '@/i18n';
import { useSession } from '@/session';
import { fontSizes, radii, spacing, useTheme } from '@/theme';

export default function AccountScreen() {
  const c = useTheme();
  const { user, ready, logout } = useSession();
  if (!ready) return <Loading />;
  if (!user) {
    return (
      <View style={{ flex: 1, padding: spacing.xl, gap: spacing.md, justifyContent: 'center', backgroundColor: c.background }}>
        <Text style={{ color: c.text, fontSize: fontSizes.lg, textAlign: 'center' }}>{t('auth.loginRequired')}</Text>
        <Button title={t('nav.login')} onPress={() => router.push('/login')} />
        <Button title={t('nav.register')} variant="secondary" onPress={() => router.push('/register')} />
      </View>
    );
  }
  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}>
      <View style={{ backgroundColor: c.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg, gap: 4 }}>
        <Text style={{ color: c.text, fontSize: fontSizes.xl, fontWeight: '800' }}>{user.displayName}</Text>
        <Text style={{ color: c.textMuted }}>@{user.username} · {user.email}</Text>
        <Text style={{ color: c.textMuted, fontSize: fontSizes.xs }}>{t('myListings.limitInfo', { used: '—', limit: user.activeListingLimit })}</Text>
      </View>
      <Button title={t('nav.myListings')} onPress={() => router.push('/my-listings')} />
      <Button title={t('listing.sellerProfile')} variant="secondary" onPress={() => router.push(`/seller/${user.username}`)} />
      <Button title={t('nav.logout')} variant="danger" onPress={() => void logout()} />
    </ScrollView>
  );
}
