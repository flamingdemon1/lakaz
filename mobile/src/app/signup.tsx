/**
 * app/signup.tsx — CREATE ACCOUNT: name, email, Mauritian phone, password (+ confirm), language, consent.
 * Owner: Person 3/4 (Zuhayr). On success goes to /verify (email + phone codes). SAMPLE only.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthHeader } from '@/components/AuthHeader';
import { FormError, LanguagePicker, LinkButton, PasswordField, TextField } from '@/components/forms';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { resetTo } from '@/lib/nav';
import { checkEmail, checkName, checkPassword, checkPhone } from '@/lib/validate';
import { colors, radius, space, TOUCH } from '@/theme';

/** Sign-up screen. Errors appear under each field after the first submit (not while typing the first time). */
export default function SignUp() {
  const { t, signUp } = useAuth();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [agree, setAgree] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errs = {
    name: checkName(f.name),
    email: checkEmail(f.email),
    phone: checkPhone(f.phone),
    password: checkPassword(f.password),
    confirm: f.confirm === f.password ? null : 'Passwords do not match.',
    agree: agree ? null : 'Please tick the box to continue.',
  };
  const valid = Object.values(errs).every((e) => e === null);
  /** Shows a field's error only after the first submit attempt. */
  const show = (k: keyof typeof errs) => (tried ? errs[k] : null);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  /** Validates, creates the (sample) account, then goes to code verification. */
  const onSubmit = async () => {
    setTried(true);
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await signUp(f);
      resetTo('/verify');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <AuthHeader title={t('createAccount')} />
      <LanguagePicker />
      <Card style={styles.gap}>
        <TextField label={t('fullName')} value={f.name} onChangeText={set('name')} autoComplete="name" textContentType="name" error={show('name')} />
        <TextField
          label={t('email')}
          value={f.email}
          onChangeText={set('email')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          error={show('email')}
        />
        <TextField
          label={t('phone')}
          value={f.phone}
          onChangeText={set('phone')}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="5xxx xxxx"
          helper="Mauritius mobile, 8 digits. +230 is added for you."
          error={show('phone')}
        />
        <PasswordField
          label={t('password')}
          value={f.password}
          onChangeText={set('password')}
          autoComplete="new-password"
          textContentType="newPassword"
          helper="At least 8 characters, with a number."
          error={show('password')}
        />
        <PasswordField label={t('confirmPassword')} value={f.confirm} onChangeText={set('confirm')} error={show('confirm')} />

        <Pressable
          onPress={() => setAgree((a) => !a)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agree }}
          // Why both: accessibilityState covers phones; aria-checked is what screen readers get on web.
          aria-checked={agree}
          style={styles.check}>
          <View style={[styles.box, agree && styles.boxOn]}>
            {agree ? <Ionicons name="checkmark" size={18} color={colors.white} /> : null}
          </View>
          <AppText variant="small" style={styles.flex}>
            {t('agree')}
          </AppText>
        </Pressable>
        {show('agree') ? (
          <AppText variant="small" color="#B91C1C">
            {errs.agree}
          </AppText>
        ) : null}

        <FormError message={error} />
        <Button label={t('continue')} icon="arrow-forward" size="lg" loading={busy} onPress={onSubmit} />
      </Card>
      <View style={styles.row}>
        <AppText color={colors.textMuted}>{t('haveAccount')}</AppText>
        <LinkButton label={t('login')} onPress={() => resetTo('/login')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: space.sm },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH },
  box: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary },
  flex: { flex: 1 },
});
