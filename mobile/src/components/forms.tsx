/**
 * forms.tsx — accessible form pieces for the account screens.
 * Owner: Person 3/4 (Zuhayr).
 * UX rules (ui-ux-pro-max): visible label above every field (never placeholder-only), error shown right
 * under its field, helper text for formats, 48 px+ touch targets, the right keyboard for each field.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { AppText, SimulatedTag } from '@/components/ui';
import { SAMPLE_CODE, useAuth } from '@/data/auth';
import { Lang, LANG_NAMES } from '@/i18n';
import { colors, fonts, radius, space, statusStyles, TOUCH } from '@/theme';

/** Labelled text field with optional helper and error text. */
export function TextField({
  label,
  error,
  helper,
  right,
  ...input
}: TextInputProps & { label: string; error?: string | null; helper?: string; right?: React.ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <AppText variant="smallBold">{label}</AppText>
      <View
        style={[
          styles.inputWrap,
          focused && styles.inputFocused,
          !!error && { borderColor: statusStyles.Critical.bg },
        ]}>
        <TextInput
          {...input}
          accessibilityLabel={label}
          accessibilityHint={helper}
          placeholderTextColor={colors.textMuted}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[styles.input, input.style]}
        />
        {right}
      </View>
      {error ? (
        <View style={styles.errRow} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={16} color={statusStyles.Critical.bg} />
          <AppText variant="small" color={statusStyles.Critical.bg} style={styles.flex}>
            {error}
          </AppText>
        </View>
      ) : helper ? (
        <AppText variant="small" color={colors.textMuted}>
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

/** Password field with a show/hide eye button. */
export function PasswordField(props: TextInputProps & { label: string; error?: string | null; helper?: string }) {
  const { t } = useAuth();
  const [show, setShow] = useState(false);
  return (
    <TextField
      {...props}
      secureTextEntry={!show}
      autoCapitalize="none"
      autoCorrect={false}
      right={
        <Pressable
          onPress={() => setShow((s) => !s)}
          accessibilityRole="button"
          accessibilityLabel={show ? t('hidePassword') : t('showPassword')}
          hitSlop={8}
          style={styles.eye}>
          <Ionicons name={show ? 'eye-off' : 'eye'} size={22} color={colors.textMuted} />
        </Pressable>
      }
    />
  );
}

/** 6-digit code field: number pad, one-time-code autofill, big spaced digits. */
export function CodeField(props: TextInputProps & { label: string; error?: string | null }) {
  return (
    <TextField
      {...props}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="••••••"
      style={styles.code}
      onChangeText={(v) => props.onChangeText?.(v.replace(/\D/g, ''))}
    />
  );
}

/** Purple hint that shows the SAMPLE code, because no real SMS/email is sent yet. */
export function SampleCodeHint() {
  const { t } = useAuth();
  return (
    <View style={styles.sample}>
      <SimulatedTag text="SAMPLE" />
      <AppText variant="small" color={colors.text} style={styles.flex}>
        {t('sampleNote')} Code: <AppText variant="smallBold">{SAMPLE_CODE}</AppText>
      </AppText>
    </View>
  );
}

/** Three-way language switch (English / Français / Kreol). */
export function LanguagePicker() {
  const { lang, setLang, t } = useAuth();
  return (
    <View style={styles.field}>
      <AppText variant="smallBold">{t('language')}</AppText>
      <View style={styles.segment} accessibilityRole="radiogroup">
        {(Object.keys(LANG_NAMES) as Lang[]).map((l) => {
          const on = l === lang;
          return (
            <Pressable
              key={l}
              onPress={() => setLang(l)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              aria-checked={on} // web screen readers
              style={[styles.segBtn, on && styles.segOn]}>
              <AppText variant="smallBold" color={on ? colors.white : colors.text}>
                {LANG_NAMES[l]}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Red box for a form-level error (e.g. wrong password). */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.formErr} accessibilityLiveRegion="assertive">
      <Ionicons name="warning" size={20} color={statusStyles.Critical.bg} />
      <AppText variant="small" style={styles.flex}>
        {message}
      </AppText>
    </View>
  );
}

/**
 * "Send a new code" link that is disabled for 30 s after each send.
 * Why 30 s: stops people hammering the button (and in real life, SMS costs money).
 */
export function ResendCode({ onResend }: { onResend: () => Promise<void> }) {
  const { t } = useAuth();
  const [left, setLeft] = useState(30);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  const waiting = left > 0;
  return (
    <Pressable
      disabled={waiting}
      onPress={async () => {
        await onResend();
        setLeft(30);
      }}
      accessibilityRole="button"
      accessibilityState={{ disabled: waiting }}
      style={styles.resend}>
      <AppText variant="smallBold" color={waiting ? colors.textMuted : colors.primary}>
        {waiting ? `${t('resendIn')} ${left} s` : t('resend')}
      </AppText>
    </Pressable>
  );
}

/** Small "text link" button (e.g. "Forgot password?"). */
export function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={8} style={styles.link}>
      <AppText variant="bodyBold" color={colors.primary}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH + 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: space.md,
  },
  inputFocused: { borderColor: colors.primary, borderWidth: 2 },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 18, color: colors.text, paddingVertical: space.sm, minWidth: 0 },
  code: { fontFamily: fonts.bold, fontSize: 26, letterSpacing: 10 },
  eye: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center', marginRight: -space.md },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flex: { flex: 1 },
  sample: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.simulated,
  },
  segment: { flexDirection: 'row', gap: space.xs, backgroundColor: colors.muted, padding: 4, borderRadius: radius.md },
  segBtn: { flex: 1, minHeight: TOUCH - 4, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.primary },
  formErr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: statusStyles.Critical.soft,
  },
  resend: { minHeight: TOUCH, justifyContent: 'center', alignSelf: 'center' },
  link: { minHeight: TOUCH - 8, justifyContent: 'center', alignSelf: 'center' },
});
