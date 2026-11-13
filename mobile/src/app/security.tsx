/**
 * app/security.tsx — ACCOUNT SECURITY: change password, log out, log out of all devices.
 * Owner: Person 3/4 (Zuhayr). Uses Supabase Auth in live mode.
 */
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';

import { FormError, PasswordField } from '@/components/forms';
import { AppText, Button, Card, Screen, SectionTitle } from '@/components/ui';
import { SUPABASE_ENABLED } from '@/config';
import { useAuth } from '@/data/auth';
import { router } from 'expo-router';
import { resetTo } from '@/lib/nav';
import { checkPassword } from '@/lib/validate';
import { colors, space, statusStyles } from '@/theme';

/** Security screen. */
export default function Security() {
  const { t, changePassword, logout } = useAuth();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errs = {
    current: f.current ? null : 'Enter your current password.',
    next: checkPassword(f.next) ?? (f.next === f.current ? 'Choose a different password.' : null),
    confirm: f.confirm === f.next ? null : 'Passwords do not match.',
  };
  const set = (k: keyof typeof f) => (v: string) => {
    setDone(false);
    setF((s) => ({ ...s, [k]: v }));
  };

  /** Changes the password after checking the current one. */
  const onChange = async () => {
    setTried(true);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    setError(null);
    try {
      await changePassword(f.current, f.next);
      setDone(true);
      setTried(false);
      setF({ current: '', next: '', confirm: '' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async (everywhere = false) => {
    setSigningOut(true);
    setLogoutError(null);
    try {
      await logout(everywhere);
      resetTo('/login');
    } catch (e) {
      setLogoutError((e as Error).message);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <SectionTitle>{t('changePassword')}</SectionTitle>
      <Card style={styles.gap}>
        <PasswordField label={t('currentPassword')} value={f.current} onChangeText={set('current')} autoComplete="current-password" error={tried ? errs.current : null} />
        <PasswordField
          label={t('newPassword')}
          value={f.next}
          onChangeText={set('next')}
          autoComplete="new-password"
          helper="At least 8 characters, with a number."
          error={tried ? errs.next : null}
        />
        <PasswordField label={t('confirmPassword')} value={f.confirm} onChangeText={set('confirm')} error={tried ? errs.confirm : null} />
        <FormError message={error} />
        {done ? (
          <AppText variant="bodyBold" color={statusStyles.Resolved.bg}>
            ✓ {t('saved')}
          </AppText>
        ) : null}
        <Button label={t('changePassword')} icon="key" loading={busy} disabled={signingOut} onPress={onChange} />
        {SUPABASE_ENABLED && <Button label={t('forgotPassword')} icon="mail" tone="secondary" disabled={busy || signingOut} onPress={() => router.push('/forgot-password')} />}
      </Card>

      <SectionTitle>{t('logout')}</SectionTitle>
      <Card style={styles.gap}>
        <Button label={t('logout')} icon="log-out" tone="secondary" disabled={busy || signingOut} onPress={() => onLogout()} />
        {SUPABASE_ENABLED && <Button label={t('logoutAll')} icon="phone-portrait" tone="danger" loading={signingOut} disabled={busy || signingOut} onPress={() => onLogout(true)} />}
        <FormError message={logoutError} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({ gap: { gap: space.md } });
