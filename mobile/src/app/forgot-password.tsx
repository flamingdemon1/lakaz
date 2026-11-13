/**
 * app/forgot-password.tsx — FORGOT PASSWORD in three steps: email → code + new password → done.
 * Owner: Person 3/4 (Zuhayr). SAMPLE: no email is sent; the code is shown in the purple hint.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AuthHeader } from '@/components/AuthHeader';
import { CodeField, FormError, PasswordField, ResendCode, SampleCodeHint, TextField } from '@/components/forms';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { resetTo } from '@/lib/nav';
import { checkCode, checkEmail, checkPassword } from '@/lib/validate';
import { space, statusStyles } from '@/theme';

/** Forgot-password screen. */
export default function ForgotPassword() {
  const { t, requestPasswordReset, resetPassword } = useAuth();
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Step 1: ask for a reset code. Same message whether or not the email exists (account security). */
  const onSend = async () => {
    setTried(true);
    if (checkEmail(email)) return;
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setStep('reset');
      setTried(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** Step 2: code + new password. */
  const onSave = async () => {
    setTried(true);
    if (checkCode(code) || checkPassword(pw)) return;
    setBusy(true);
    setError(null);
    try {
      await resetPassword(email, code, pw);
      setStep('done');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <AuthHeader title={t('forgotTitle')} body={step === 'email' ? t('forgotBody') : undefined} />
      {step === 'reset' ? <SampleCodeHint /> : null}
      <Card style={styles.gap}>
        {step === 'email' ? (
          <>
            <TextField
              label={t('email')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={tried ? checkEmail(email) : null}
            />
            <FormError message={error} />
            <Button label={t('sendCode')} icon="mail" size="lg" loading={busy} onPress={onSend} />
          </>
        ) : step === 'reset' ? (
          <>
            <AppText variant="small">{email}</AppText>
            <CodeField label={t('code')} value={code} onChangeText={setCode} error={tried ? checkCode(code) : null} />
            <PasswordField
              label={t('newPassword')}
              value={pw}
              onChangeText={setPw}
              autoComplete="new-password"
              helper="At least 8 characters, with a number."
              error={tried ? checkPassword(pw) : null}
            />
            <FormError message={error} />
            <Button label={t('savePassword')} icon="key" size="lg" loading={busy} onPress={onSave} />
            <ResendCode onResend={() => requestPasswordReset(email)} />
          </>
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={48} color={statusStyles.Resolved.bg} style={styles.center} />
            <AppText variant="bodyBold" style={styles.text}>
              {t('passwordSaved')}
            </AppText>
            <Button label={t('backToLogin')} icon="log-in" size="lg" onPress={() => resetTo('/login')} />
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  center: { alignSelf: 'center' },
  text: { textAlign: 'center' },
});
