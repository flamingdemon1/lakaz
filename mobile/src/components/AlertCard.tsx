/**
 * AlertCard.tsx — one alert in a list (home screen + alerts tab). Tapping opens the detail screen.
 * Owner: Person 3/4 (Fahim, Zuhayr).
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PulseRings } from '@/components/motion';
import { AppText, IconName, StatusPill } from '@/components/ui';
import { alertTitle, clock, timeAgo } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors, radius, shadow, space, statusStyles, TOUCH } from '@/theme';
import type { Alert } from '@/types';

const typeIcon: Record<Alert['type'], IconName> = {
  unexpected_exit: 'walk',
  sos: 'megaphone',
  low_battery: 'battery-dead',
  device_offline: 'cloud-offline',
  possible_removal: 'hand-left',
};

/** Input: alert. Shows type, status pill, level and age; left edge coloured by status. */
export function AlertCard({ alert, personName = 'Marie-Claire' }: { alert: Alert; personName?: string }) {
  const now = useNow(5000);
  const s = statusStyles[alert.status];
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/alert/[id]', params: { id: alert.alert_id } })}
      accessibilityRole="button"
      accessibilityLabel={`${alertTitle[alert.type]}, ${personName}, ${alert.status}, level ${alert.level}. Open details`}
      style={({ pressed }) => [styles.card, { borderLeftColor: s.bg }, pressed && styles.pressed]}>
      <View style={[styles.icon, { backgroundColor: s.soft }]}>
        {/* Radar pulse only while nobody has picked it up yet — stops the moment someone acknowledges. */}
        {alert.status === 'Critical' || alert.status === 'Active' ? <PulseRings color={s.bg} size={44} /> : null}
        <Ionicons name={typeIcon[alert.type]} size={24} color={s.bg} />
      </View>
      <View style={styles.body}>
        <View style={styles.top}>
          <AppText variant="bodyBold" style={styles.flex} numberOfLines={2}>
            {alertTitle[alert.type]}
          </AppText>
          <StatusPill status={alert.status} />
        </View>
        {/* Name on the second line so the alert type is never cut off next to the status pill. */}
        <AppText variant="small" color={colors.textMuted}>
          {personName} · {clock(alert.created_at)} · {timeAgo(alert.created_at, now)} · Step {alert.level}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: TOUCH + 24,
    padding: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderLeftWidth: 6,
    ...shadow,
    overflow: 'hidden', // keeps the pulse rings inside the card
  },
  pressed: { opacity: 0.85 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
