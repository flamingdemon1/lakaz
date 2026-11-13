/**
 * app/forgot-password.tsx — FORGOT PASSWORD in three steps: email → code + new password → done.
 * Live recovery uses an emailed code and a temporary Supabase session.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AuthHeader } from '@/components/AuthHeader';
import { CodeField, FormError, PasswordField, ResendCode, SampleCodeHint, TextField } from '@/components/forms';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { SUPABASE_ENABLED } from '@/config';
import { useAuth } from '@/data/auth';
import { resetPassword as saveLivePassword, verifyRecoveryCode } from '@/data/supabase';
import { resetTo } from '@/lib/nav';
import { checkCode, checkEmail, checkPassword } from '@/lib/validate';
import { space, statusStyles } from '@/theme';

/** Forgot-password screen. */
export default function ForgotPassword() {
  const { t, requestPasswordReset, resetPassword } = useAuth();
  const [step, setStep] = useState<'email' | 'code' | 'reset' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
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
      setStep(SUPABASE_ENABLED ? 'code' : 'reset');
      setTried(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async () => {
    setTried(true);
    if (checkCode(code)) return;
    setBusy(true);
    setError(null);
    try {
      setRecoveryToken(await verifyRecoveryCode(email, code));
      setCode('');
      setTried(false);
      setStep('reset');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** Save the password using the recovery session or the sample account. */
  const onSave = async () => {
    setTried(true);
    if (checkPassword(pw) || (!SUPABASE_ENABLED && checkCode(code))) return;
    setBusy(true);
    setError(null);
    try {
      if (SUPABASE_ENABLED) {
        if (!recoveryToken) throw new Error('Request a new recovery code.');
        await saveLivePassword(recoveryToken, pw);
        setRecoveryToken(null);
      } else {
        await resetPassword(email, code, pw);
      }
      setPw('');
      setStep('done');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <AuthHeader title={t('forgotTitle')} body={step === 'email' ? t('forgotBody') : step === 'code' ? 'If an account exists for this email, you’ll receive a recovery code.' : undefined} />
      {!SUPABASE_ENABLED && step === 'reset' ? <SampleCodeHint /> : null}
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
        ) : step === 'code' ? (
          <>
            <AppText variant="small">{email}</AppText>
            <CodeField label={t('emailCode')} value={code} onChangeText={setCode} error={tried ? checkCode(code) : null} />
            <FormError message={error} />
            <Button label={t('verify')} icon="shield-checkmark" loading={busy} onPress={onVerify} />
            <ResendCode onResend={() => requestPasswordReset(email)} onError={setError} />
          </>
        ) : step === 'reset' ? (
          <>
            <AppText variant="small">{email}</AppText>
            {!SUPABASE_ENABLED && <CodeField label={t('code')} value={code} onChangeText={setCode} error={tried ? checkCode(code) : null} />}
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
            {SUPABASE_ENABLED ? (
              <Button label="Request a new code" icon="mail" tone="secondary" disabled={busy} onPress={() => {
                setRecoveryToken(null);
                setPw('');
                setError(null);
                setTried(false);
                setStep('email');
              }} />
            ) : <ResendCode onResend={() => requestPasswordReset(email)} onError={setError} />}
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
