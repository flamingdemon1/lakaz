/**
 * app/(tabs)/profile.tsx — PROFILE: personal info (edit), verification badges, language,
 * links to trusted family & caregivers and account security, log out.
 * Owner: Person 3/4 (Zuhayr). SAMPLE account data (src/data/auth.tsx).
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FormError, LanguagePicker, TextField } from '@/components/forms';
import { AppText, Button, Card, IconName, Screen, SectionTitle, SimulatedTag } from '@/components/ui';
import { SUPABASE_ENABLED } from '@/config';
import { useAuth } from '@/data/auth';
import { resetTo } from '@/lib/nav';
import { checkEmail, checkName, checkPhone } from '@/lib/validate';
import { colors, radius, space, statusStyles, TOUCH } from '@/theme';

/** Profile tab. */
export default function Profile() {
  const { t, user, updateProfile, logout } = useAuth();
  const [f, setF] = useState({ name: '', email: '', phone: '' });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fill the form from the account (and again if the account changes).
  useEffect(() => {
    if (user) setF({ name: user.name, email: user.email, phone: user.phone.replace('+230', '') });
  }, [user]);

  const errs = { name: checkName(f.name), email: checkEmail(f.email), phone: checkPhone(f.phone) };
  const dirty = !!user && (f.name !== user.name || f.email !== user.email || `+230${f.phone.replace(/\D/g, '')}` !== user.phone);
  const set = (k: keyof typeof f) => (v: string) => {
    setSaved(false);
    setF((s) => ({ ...s, [k]: v }));
  };

  /** Saves the profile; changed email/phone become "Not verified" again. */
  const onSave = async () => {
    setTried(true);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    setError(null);
    try {
      await updateProfile(f);
      setSaved(true);
      setTried(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** Log out and go back to the login screen. */
  const onLogout = () => {
    logout();
    resetTo('/login');
  };

  const initials = (user?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Screen>
      <View style={styles.head}>
        <View style={styles.avatar}>
          <AppText variant="title" color={colors.white}>
            {initials}
          </AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="title">{user?.name ?? '—'}</AppText>
          {!SUPABASE_ENABLED && <SimulatedTag text="SAMPLE ACCOUNT" />}
        </View>
      </View>

      <SectionTitle>{t('personalInfo')}</SectionTitle>
      {SUPABASE_ENABLED ? (
        <Card style={styles.gap}>
          <AppText>{user?.email}</AppText>
          <VerifiedBadge ok={!!user?.email_verified} />
        </Card>
      ) : <Card style={styles.gap}>
        <TextField label={t('fullName')} value={f.name} onChangeText={set('name')} error={tried ? errs.name : null} />
        <TextField
          label={t('email')}
          value={f.email}
          onChangeText={set('email')}
          keyboardType="email-address"
          autoCapitalize="none"
          error={tried ? errs.email : null}
          right={<VerifiedBadge ok={!!user?.email_verified} />}
        />
        <TextField
          label={t('phone')}
          value={f.phone}
          onChangeText={set('phone')}
          keyboardType="phone-pad"
          helper="+230 is added for you."
          error={tried ? errs.phone : null}
          right={<VerifiedBadge ok={!!user?.phone_verified} />}
        />
        <FormError message={error} />
        <Button
          label={saved ? t('saved') : t('save')}
          icon={saved ? 'checkmark' : 'save'}
          loading={busy}
          disabled={!dirty && !saved}
          onPress={onSave}
        />
      </Card>}

      <LanguagePicker />

      <Card style={styles.list}>
        {/* Guardians are now managed per person (People tab → person → Guardians). */}
        <Row icon="people" label={t('people')} onPress={() => router.push('/people')} />
        <Row icon="notifications" label="Notifications" onPress={() => router.push('/notifications')} />
        <Row icon="git-network" label="Escalation" onPress={() => router.push('/escalation')} />
        <Row icon="lock-closed" label={t('security')} onPress={() => router.push('/security')} last />
      </Card>

      <Button label={t('logout')} icon="log-out" tone="secondary" onPress={onLogout} />
    </Screen>
  );
}

/** Small green/grey "Verified / Not verified" badge inside a field. */
function VerifiedBadge({ ok }: { ok: boolean }) {
  const { t } = useAuth();
  return (
    <View style={[styles.badge, { backgroundColor: ok ? statusStyles.Resolved.soft : colors.muted }]}>
      <Ionicons name={ok ? 'checkmark-circle' : 'time'} size={14} color={ok ? statusStyles.Resolved.bg : colors.textMuted} />
      <AppText variant="label" color={ok ? statusStyles.Resolved.bg : colors.textMuted}>
        {ok ? t('verified') : t('notVerified')}
      </AppText>
    </View>
  );
}

/** Tappable list row with icon + chevron. */
function Row({ icon, label, onPress, last }: { icon: IconName; label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, !last && styles.divider, pressed && styles.pressed]}>
      <Ionicons name={icon} size={22} color={colors.link} />
      <AppText variant="bodyBold" style={styles.flex}>
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: space.xs },
  gap: { gap: space.md },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.pill },
  list: { paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH + 8 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pressed: { opacity: 0.7 },
});
