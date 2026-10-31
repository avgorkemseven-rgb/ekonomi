import type { CategoryNodeDto } from '@kleps/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '@/api';
import { ListingFormMobile } from '@/components/ListingFormMobile';
import { Button, ErrorView, Loading } from '@/components/ui';
import { errorMessage, t } from '@/i18n';
import { useSession } from '@/session';
import { fontSizes, radii, spacing, useTheme } from '@/theme';

export default function SellScreen() {
  const c = useTheme();
  const { user, ready } = useSession();
  const [tree, setTree] = useState<CategoryNodeDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trail, setTrail] = useState<CategoryNodeDto[]>([]);
  const [leaf, setLeaf] = useState<CategoryNodeDto | null>(null);

  useEffect(() => {
    api.categories.tree().then(setTree, (e: unknown) => setError(errorMessage(e)));
  }, []);

  if (!ready) return <Loading />;
  if (!user) {
    return (
      <View style={{ flex: 1, padding: spacing.xl, gap: spacing.md, justifyContent: 'center', backgroundColor: c.background }}>
        <Text style={{ color: c.text, textAlign: 'center', fontSize: fontSizes.lg }}>{t('auth.loginRequired')}</Text>
        <Button title={t('nav.login')} onPress={() => router.push('/login')} />
      </View>
    );
  }
  if (error) return <ErrorView message={error} />;
  if (!tree) return <Loading />;

  const options = trail.length ? trail[trail.length - 1]!.children : tree;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        {leaf ? (
          <>
            <Pressable accessibilityRole="button" onPress={() => setLeaf(null)}><Text style={{ color: c.accent, fontWeight: '600' }}>‹ {t('sell.stepCategory')}</Text></Pressable>
            <ListingFormMobile
              key={leaf.id}
              categorySlug={leaf.slug}
              submitLabel={t('sell.continueToPhotos')}
              onSaved={(l) => {
                setLeaf(null);
                setTrail([]);
                router.push(`/edit/${l.id}`);
              }}
            />
          </>
        ) : (
          <>
            <Text accessibilityRole="header" style={{ color: c.text, fontSize: fontSizes.lg, fontWeight: '700' }}>{trail.length ? t('sell.chooseSubcategory') : t('sell.chooseCategory')}</Text>
            {trail.length > 0 && (
              <Pressable accessibilityRole="button" onPress={() => setTrail(trail.slice(0, -1))}><Text style={{ color: c.accent }}>‹ {trail.map((x) => x.name).join(' › ')}</Text></Pressable>
            )}
            {options.map((cat) => (
              <Pressable
                key={cat.id}
                accessibilityRole="button"
                onPress={() => (cat.children.length ? setTrail([...trail, cat]) : setLeaf(cat))}
                style={{ backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, flexDirection: 'row', justifyContent: 'space-between' }}
              >
                <Text style={{ color: c.text, fontWeight: '600' }}>{cat.name}</Text>
                <Text style={{ color: c.textMuted }}>›</Text>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
