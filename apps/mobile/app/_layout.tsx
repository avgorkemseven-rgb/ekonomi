import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { t } from '@/i18n';
import { SessionProvider } from '@/session';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const c = useTheme();
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: c.surface },
            headerTintColor: c.text,
            contentStyle: { backgroundColor: c.background },
            headerBackTitle: t('common.back'),
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="listing/[id]" options={{ title: t('listing.detailsTitle') }} />
          <Stack.Screen name="seller/[username]" options={{ title: t('listing.sellerProfile') }} />
          <Stack.Screen name="category/[slug]" options={{ title: t('nav.categories') }} />
          <Stack.Screen name="edit/[id]" options={{ title: t('sell.title') }} />
          <Stack.Screen name="my-listings" options={{ title: t('myListings.title') }} />
          <Stack.Screen name="login" options={{ title: t('auth.loginTitle'), presentation: 'modal' }} />
          <Stack.Screen name="register" options={{ title: t('auth.registerTitle'), presentation: 'modal' }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
