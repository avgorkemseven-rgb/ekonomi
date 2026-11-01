import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

const icon = (glyph: string) =>
  function TabIcon({ color }: { color: string }) {
    return <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;
  };

export default function TabsLayout() {
  const c = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('nav.discover'), headerShown: false, tabBarIcon: icon('◎') }} />
      <Tabs.Screen name="search" options={{ title: t('nav.search'), tabBarIcon: icon('⌕') }} />
      <Tabs.Screen name="sell" options={{ title: t('nav.sell'), tabBarIcon: icon('＋') }} />
      <Tabs.Screen name="account" options={{ title: t('nav.account'), tabBarIcon: icon('◉') }} />
    </Tabs>
  );
}
