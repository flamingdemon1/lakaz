/**
 * app/login.tsx — LOG IN with email/phone + password, plus links to sign-up, one-time code and
 * forgot password, a language picker, and a TEMPORARY "skip login" button for building/rehearsing.
 * Owner: Person 3/4 (Zuhayr). SAMPLE accounts only — see src/data/auth.tsx.
 */
import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthHeader } from '@/components/AuthHeader';
import { FormError, LanguagePicker, LinkButton, PasswordField, TextField } from '@/components/forms';
import { AppText, Button, Card, Screen, SimulatedTag } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { resetTo } from '@/lib/nav';
import { colors, space } from '@/theme';

/** Log in screen. */
export default function Login() {
  const { t, login, bypass } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Checks the fields, then logs in. Unverified accounts are sent to the code screen. */
  const onLogin = async () => {
    if (!identifier.trim() || !password) {
      setError('Enter your email or phone, and your password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await login(identifier, password);
      resetTo(r === 'ok' ? '/' : '/verify');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** TEMPORARY: straight into the app as the demo caregiver. */
  const onBypass = () => {
    bypass();
    resetTo('/');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <AuthHeader headline={t('loginHeadline')} title={t('loginTitle')} body={t('appTagline')} />
      <LanguagePicker />

      <Card style={styles.gap}>
        <TextField
          label={t('emailOrPhone')}
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="username"
          textContentType="username"
          placeholder="name@example.com / 5xxx xxxx"
          returnKeyType="next"
        />
        <PasswordField
          label={t('password')}
          value={password}
          onChangeText={setPassword}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={onLogin}
        />
        <FormError message={error} />
        <Button label={t('login')} icon="log-in" size="lg" loading={busy} onPress={onLogin} />
        <LinkButton label={t('forgotPassword')} onPress={() => router.push('/forgot-password')} />
      </Card>

      <Button label={t('useCode')} icon="keypad" tone="secondary" onPress={() => router.push('/otp')} />

      <View style={styles.row}>
        <AppText color={colors.textMuted}>{t('noAccount')}</AppText>
        <LinkButton label={t('createAccount')} onPress={() => router.push('/signup')} />
      </View>

      {/* TEMPORARY — remove before the pitch. Lets the team skip login while building. */}
      <Card style={styles.temp}>
        <SimulatedTag text="TEMPORARY · DEV ONLY" />
        <Button label={t('bypass')} icon="flash" tone="secondary" onPress={onBypass} />
        <View style={styles.row}>
          <LinkButton label="Help alert (sample)" onPress={() => router.push('/help-alert')} />
          <LinkButton label="Responder page" onPress={() => router.push('/responder')} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: space.sm },
  temp: { gap: space.sm, borderWidth: 2, borderColor: colors.simulated, borderStyle: 'dashed' },
});
