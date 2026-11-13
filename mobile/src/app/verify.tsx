/**
 * app/verify.tsx — EMAIL + PHONE VERIFICATION after sign-up (or after logging in to an unverified account).
 * Live verification requires only the email code.
 */
import { Redirect } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AuthHeader } from '@/components/AuthHeader';
import { CodeField, FormError, ResendCode, SampleCodeHint } from '@/components/forms';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { SUPABASE_ENABLED } from '@/config';
import { useAuth } from '@/data/auth';
import { resetTo } from '@/lib/nav';
import { checkCode } from '@/lib/validate';
import { colors, space } from '@/theme';

/** Two code boxes (email, phone) and one Verify button. */
export default function Verify() {
  const { t, pending, verifyAccount, resendCode } = useAuth();
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nothing to verify (e.g. page reloaded) → back to log in.
  if (!pending) return <Redirect href="/login" />;

  /** Checks both codes, then verifies and signs in. */
  const onVerify = async () => {
    setTried(true);
    if (checkCode(emailCode) || (!SUPABASE_ENABLED && checkCode(phoneCode))) return;
    setBusy(true);
    setError(null);
    try {
      await verifyAccount(emailCode, phoneCode);
      resetTo('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <AuthHeader title={t('verifyTitle')} body={SUPABASE_ENABLED ? 'Enter the verification code sent to your email address.' : t('verifyBody')} />
      {!SUPABASE_ENABLED && <SampleCodeHint />}
      <Card style={styles.gap}>
        <AppText variant="small" color={colors.textMuted}>
          {pending.email}{!SUPABASE_ENABLED && ` · ${pending.phone}`}
        </AppText>
        <CodeField label={t('emailCode')} value={emailCode} onChangeText={setEmailCode} error={tried ? checkCode(emailCode) : null} />
        {!SUPABASE_ENABLED && <CodeField label={t('phoneCode')} value={phoneCode} onChangeText={setPhoneCode} error={tried ? checkCode(phoneCode) : null} />}
        <FormError message={error} />
        <Button label={t('verify')} icon="shield-checkmark" size="lg" loading={busy} onPress={onVerify} />
        <ResendCode onResend={resendCode} onError={setError} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({ gap: { gap: space.md } });
