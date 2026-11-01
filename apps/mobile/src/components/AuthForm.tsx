import { ApiError } from '@kleps/api-client';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { errorMessage, fieldError, t } from '../i18n';
import { useSession } from '../session';
import { spacing, useTheme } from '../theme';
import { Banner, Button, Field, Input, Wordmark } from './ui';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const c = useTheme();
  const { login, register } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const isRegister = mode === 'register';

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (isRegister) await register({ email, password, username, displayName });
      else await login({ email, password });
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const top = error && !(error instanceof ApiError && error.code === 'VALIDATION_ERROR' && error.issues?.length) ? errorMessage(error) : null;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Wordmark size={26} />
        {top && <Banner text={top} />}
        {isRegister && (
          <>
            <Field label={t('auth.displayName')} error={fieldError(error, 'displayName')}>
              <Input value={displayName} onChangeText={setDisplayName} autoComplete="name" accessibilityLabel={t('auth.displayName')} />
            </Field>
            <Field label={t('auth.username')} error={fieldError(error, 'username')} hint={t('auth.usernameHint')}>
              <Input value={username} onChangeText={setUsername} autoCapitalize="none" autoComplete="username" accessibilityLabel={t('auth.username')} />
            </Field>
          </>
        )}
        <Field label={t('auth.email')} error={fieldError(error, 'email')}>
          <Input value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" accessibilityLabel={t('auth.email')} />
        </Field>
        <Field label={t('auth.password')} error={fieldError(error, 'password')} hint={isRegister ? t('auth.passwordHint') : undefined}>
          <Input value={password} onChangeText={setPassword} secureTextEntry autoComplete={isRegister ? 'new-password' : 'current-password'} accessibilityLabel={t('auth.password')} />
        </Field>
        {isRegister && <Text style={{ color: c.textMuted, fontSize: 12 }}>{t('auth.termsNotice')}</Text>}
        <Button title={isRegister ? t('auth.registerCta') : t('auth.loginCta')} onPress={() => void submit()} loading={busy} />
        <Link href={isRegister ? '/login' : '/register'} replace style={{ color: c.accent, textAlign: 'center', fontWeight: '600' }}>
          {isRegister ? `${t('auth.haveAccount')} ${t('nav.login')}` : `${t('auth.noAccount')} ${t('nav.register')}`}
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
