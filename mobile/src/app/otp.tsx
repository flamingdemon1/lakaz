/**
 * app/otp.tsx — LOG IN WITH A ONE-TIME CODE (OTP) sent by SMS. Two steps: phone → code.
 * Owner: Person 3/4 (Zuhayr). SAMPLE: no SMS is sent; the code is shown in the purple hint.
 */
import { Redirect } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AuthHeader } from '@/components/AuthHeader';
import { CodeField, FormError, LinkButton, ResendCode, SampleCodeHint, TextField } from '@/components/forms';
import { Button, Card, Screen } from '@/components/ui';
import { SUPABASE_ENABLED } from '@/config';
import { useAuth } from '@/data/auth';
import { resetTo } from '@/lib/nav';
import { checkCode, checkPhone } from '@/lib/validate';
import { space } from '@/theme';

/** OTP login screen. `step` decides which half of the form is shown. */
export default function OtpLogin() {
  const { t, requestOtp, loginWithOtp } = useAuth();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Step 1: send the code. */
  const onSend = async () => {
    setTried(true);
    if (checkPhone(phone)) return;
    setBusy(true);
    setError(null);
    try {
      await requestOtp(phone);
      setStep('code');
      setTried(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** Step 2: check the code and sign in. */
  const onLogin = async () => {
    setTried(true);
    if (checkCode(code)) return;
    setBusy(true);
    setError(null);
    try {
      await loginWithOtp(phone, code);
      resetTo('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (SUPABASE_ENABLED) return <Redirect href="/login" />;

  return (
    <Screen edges={['bottom']}>
      <AuthHeader title={t('otpTitle')} body={step === 'phone' ? t('otpBody') : phone} />
      {step === 'code' ? <SampleCodeHint /> : null}
      <Card style={styles.gap}>
        {step === 'phone' ? (
          <>
            <TextField
              label={t('phone')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              placeholder="5xxx xxxx"
              error={tried ? checkPhone(phone) : null}
              onSubmitEditing={onSend}
            />
            <FormError message={error} />
            <Button label={t('sendCode')} icon="chatbubble-ellipses" size="lg" loading={busy} onPress={onSend} />
          </>
        ) : (
          <>
            <CodeField label={t('code')} value={code} onChangeText={setCode} error={tried ? checkCode(code) : null} onSubmitEditing={onLogin} />
            <FormError message={error} />
            <Button label={t('login')} icon="log-in" size="lg" loading={busy} onPress={onLogin} />
            <ResendCode onResend={() => requestOtp(phone)} />
            <LinkButton label={t('changeNumber')} onPress={() => { setStep('phone'); setCode(''); setError(null); }} />
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({ gap: { gap: space.md } });
