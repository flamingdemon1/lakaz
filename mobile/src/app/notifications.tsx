/**
 * app/notifications.tsx — NOTIFICATION SETTINGS: what the caregiver is told about, and how
 * (banner / sound / vibration). Honest note about push notifications in Expo Go.
 * Owner: Person 3/4 (Fahim, Zuhayr). Data: src/data/notify.tsx.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, IconName, Screen, SectionTitle, SimulatedTag } from '@/components/ui';
import { CATEGORY_INFO, NotifyCategory, Pref, useNotify } from '@/data/notify';
import { colors, radius, space, statusStyles, TOUCH } from '@/theme';

const TONE_COLOR = {
  critical: statusStyles.Critical.bg,
  warning: statusStyles.Active.bg,
  good: statusStyles.Resolved.bg,
  info: colors.primary,
} as const;

/** Notification settings screen. */
export default function NotificationSettings() {
  const { prefs, setPref, push } = useNotify();

  return (
    <Screen edges={['bottom']}>
      {/* Sample stores stay sample even when Supabase authentication is live. */}
      <SimulatedTag text="SAMPLE DATA" />
      <AppText variant="small" color={colors.textMuted}>Sample screen: not connected to the band yet.</AppText>
      <Card style={styles.push}>
        <Ionicons name="phone-portrait" size={24} color={colors.link} />
        <View style={styles.flex}>
          <AppText variant="bodyBold">Push notifications</AppText>
          <AppText variant="small" color={colors.textMuted}>
            This test version can only alert you while the app is open (Expo Go can't receive push). The real app will
            alert you even when it's closed. Until then, keep the app open during the demo.
          </AppText>
        </View>
      </Card>

      <SectionTitle right={<SimulatedTag text="SAVED ON THIS PHONE ONLY" />}>Alert types</SectionTitle>
      {(Object.keys(CATEGORY_INFO) as NotifyCategory[]).map((c) => {
        const info = CATEGORY_INFO[c];
        const p = prefs[c];
        const color = TONE_COLOR[info.tone];
        return (
          <Card key={c} style={styles.gap}>
            <View style={styles.row}>
              <View style={[styles.icon, { backgroundColor: `${color}22` }]}>
                <Ionicons name={info.icon as IconName} size={20} color={color} />
              </View>
              <View style={styles.flex}>
                <AppText variant="bodyBold">{info.label}</AppText>
                <AppText variant="small" color={colors.textMuted}>
                  {info.desc}
                </AppText>
              </View>
            </View>
            {info.locked ? (
              <View style={styles.locked}>
                <Ionicons name="lock-closed" size={16} color={statusStyles.Critical.bg} />
                <AppText variant="smallBold" color={statusStyles.Critical.bg}>
                  Always on — banner, sound and vibration (safety)
                </AppText>
              </View>
            ) : (
              <View style={styles.pills}>
                {(['banner', 'sound', 'vibrate'] as (keyof Pref)[]).map((k) => (
                  <Pill key={k} label={k === 'banner' ? 'Banner' : k === 'sound' ? 'Sound' : 'Vibrate'} on={p[k]} onPress={() => setPref(c, k, !p[k])} />
                ))}
              </View>
            )}
          </Card>
        );
      })}

      <Button
        label="Send a test notification"
        icon="notifications"
        tone="secondary"
        onPress={() => push({ category: 'zone_departure', title: 'This is a test notification', body: 'Banners look like this', sample: true })}
      />
    </Screen>
  );
}

/** On/off pill used for banner / sound / vibrate. */
function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      aria-checked={on}
      accessibilityLabel={label}
      style={[styles.pill, on && styles.pillOn]}>
      <Ionicons name={on ? 'checkmark' : 'close'} size={16} color={on ? colors.white : colors.textMuted} />
      <AppText variant="smallBold" color={on ? colors.white : colors.textMuted}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  push: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', marginTop: space.sm },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  locked: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  pills: { flexDirection: 'row', gap: space.sm },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: TOUCH - 4,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pillOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
