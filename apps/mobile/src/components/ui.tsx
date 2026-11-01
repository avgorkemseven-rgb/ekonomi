import type { ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { t } from '../i18n';
import { fontSizes, radii, spacing, useTheme } from '../theme';

export function Wordmark({ size = 22 }: { size?: number }) {
  const c = useTheme();
  return (
    <Text accessibilityRole="header" style={{ fontSize: size, fontWeight: '900', letterSpacing: size * 0.2, color: c.text }}>
      KLEPS<Text style={{ color: c.accent }}>.</Text>
    </Text>
  );
}

export function Button({ title, onPress, variant = 'primary', loading, disabled }: { title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; loading?: boolean; disabled?: boolean }) {
  const c = useTheme();
  const bg = variant === 'primary' ? c.accent : c.surface;
  const fg = variant === 'primary' ? c.accentContrast : variant === 'danger' ? c.danger : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, borderColor: variant === 'primary' ? bg : c.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  const c = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.text, fontWeight: '600', fontSize: fontSizes.sm }}>{label}</Text>
      {children}
      {error ? <Text accessibilityLiveRegion="polite" style={{ color: c.danger, fontSize: fontSizes.xs }}>{error}</Text> : hint ? <Text style={{ color: c.textMuted, fontSize: fontSizes.xs }}>{hint}</Text> : null}
    </View>
  );
}

export function Input(props: TextInputProps & { invalid?: boolean }) {
  const c = useTheme();
  return (
    <TextInput
      placeholderTextColor={c.textMuted}
      {...props}
      style={[styles.input, { backgroundColor: c.surface, color: c.text, borderColor: props.invalid ? c.danger : c.border }, props.multiline && { minHeight: 110, textAlignVertical: 'top' }, props.style]}
    />
  );
}

/** Native-feeling option picker (modal list) since React Native has no built-in select. */
export function Picker<T extends string>({ label, value, options, onChange, placeholder, error }: { label: string; value: T | ''; options: { value: T; label: string }[]; onChange: (v: T | '') => void; placeholder?: string; error?: string }) {
  const c = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <Field label={label} error={error}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${current?.label ?? placeholder ?? t('sell.selectPlaceholder')}`} onPress={() => setOpen(true)} style={[styles.input, { backgroundColor: c.surface, borderColor: error ? c.danger : c.border, justifyContent: 'center' }]}>
        <Text style={{ color: current ? c.text : c.textMuted }}>{current?.label ?? placeholder ?? t('sell.selectPlaceholder')}</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg }}>
            <Text style={{ fontSize: fontSizes.lg, fontWeight: '700', color: c.text }}>{label}</Text>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)}><Text style={{ color: c.accent, fontWeight: '600' }}>{t('common.close')}</Text></Pressable>
          </View>
          <ScrollView>
            <Pressable onPress={() => { onChange(''); setOpen(false); }} style={[styles.option, { borderColor: c.border }]}>
              <Text style={{ color: c.textMuted }}>{placeholder ?? t('sell.selectPlaceholder')}</Text>
            </Pressable>
            {options.map((o) => (
              <Pressable key={o.value} accessibilityRole="button" accessibilityState={{ selected: o.value === value }} onPress={() => { onChange(o.value); setOpen(false); }} style={[styles.option, { borderColor: c.border, backgroundColor: o.value === value ? c.accentSoft : 'transparent' }]}>
                <Text style={{ color: c.text, fontWeight: o.value === value ? '700' : '400' }}>{o.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Field>
  );
}

export function Loading() {
  const c = useTheme();
  return <View style={styles.center}><ActivityIndicator color={c.accent} size="large" accessibilityLabel={t('common.loading')} /></View>;
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const c = useTheme();
  return (
    <View style={[styles.center, { gap: spacing.md, padding: spacing.xl }]}>
      <Text style={{ color: c.text, textAlign: 'center' }}>{message}</Text>
      {onRetry && <Button title={t('common.retry')} variant="secondary" onPress={onRetry} />}
    </View>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  const c = useTheme();
  return (
    <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, borderRadius: radii.lg, backgroundColor: c.surface }}>
      <Text style={{ color: c.text, fontWeight: '600', textAlign: 'center' }}>{title}</Text>
      {children}
    </View>
  );
}

export function Banner({ text, tone = 'danger' }: { text: string; tone?: 'danger' | 'success' | 'info' }) {
  const c = useTheme();
  const color = tone === 'danger' ? c.danger : tone === 'success' ? c.success : c.accent;
  return (
    <View accessibilityLiveRegion="polite" style={{ borderWidth: 1, borderColor: color, borderRadius: radii.md, padding: spacing.md }}>
      <Text style={{ color }}>{text}</Text>
    </View>
  );
}

export function Badge({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'accent' | 'success' | 'warning' }) {
  const c = useTheme();
  const map = { neutral: [c.surfaceMuted, c.textMuted], accent: [c.accentSoft, c.accent], success: [c.surfaceMuted, c.success], warning: [c.surfaceMuted, c.warning] } as const;
  const [bg, fg] = map[tone];
  return <View style={{ backgroundColor: bg, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}><Text style={{ color: fg, fontSize: fontSizes.xs, fontWeight: '600' }}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  button: { minHeight: 48, borderRadius: radii.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  buttonText: { fontWeight: '700', fontSize: fontSizes.md },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md, fontSize: fontSizes.md },
  option: { paddingHorizontal: spacing.lg, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
