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
import { useAuth } from '@/data/auth';
import { useLakaz } from '@/data/store';
import { ALERT_KEY, fill } from '@/i18n';
import { clock, timeAgo } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors, radius, shadow, space, statusStyles, TOUCH } from '@/theme';
import type { Alert } from '@/types';

const typeIcon: Record<Alert['type'], IconName> = {
  unexpected_exit: 'walk',
  help_requested: 'megaphone',
  sos: 'megaphone',
  device_offline: 'cloud-offline',
};

/** Input: alert. Shows type, status pill, level and age; left edge coloured by status. */
export function AlertCard({ alert, personName }: { alert: Alert; personName?: string }) {
  // Real wearer from the store (live) — falls back to the sample person's name only in sample mode.
  const now = useNow(5000);
  const { status } = useLakaz();
  personName = personName ?? (status?.person_name || (alert.live ? '' : 'Marie-Claire'));
  const s = statusStyles[alert.status];
  const { t } = useAuth();
  const title = t(ALERT_KEY[alert.type].title);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/alert/[id]', params: { id: alert.alert_id } })}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${personName}, ${fill(t('stepN'), { n: alert.level })}`}
      style={({ pressed }) => [styles.card, { borderLeftColor: s.bg }, pressed && styles.pressed]}>
      <View style={[styles.icon, { backgroundColor: s.soft }]}>
        {/* Radar pulse only while nobody has picked it up yet — stops the moment someone acknowledges. */}
        {alert.status === 'Critical' || alert.status === 'Active' ? <PulseRings color={s.bg} size={44} /> : null}
        <Ionicons name={typeIcon[alert.type]} size={24} color={s.bg} />
      </View>
      <View style={styles.body}>
        <View style={styles.top}>
          <AppText variant="bodyBold" style={styles.flex} numberOfLines={2}>
            {title}
          </AppText>
          <StatusPill status={alert.status} />
        </View>
        {/* Name on the second line so the alert type is never cut off next to the status pill. */}
        <AppText variant="small" color={colors.textMuted}>
          {personName ? `${personName} · ` : ''}{clock(alert.created_at)} · {timeAgo(alert.created_at, now)}
          {/* Real help alerts have no ladder step (the backend has no escalation yet). */}
          {alert.live ? '' : ` · ${fill(t('stepN'), { n: alert.level })}`}
          {/* Left-home alerts closed by the band coming back show WHEN she returned (Kavish, #29). Never on help
              requests: those are closed by a carer with "She is safe", not by coming home. */}
          {alert.type === 'unexpected_exit' && alert.resolved_at ? ` · ${fill(t('backHomeAt'), { time: clock(alert.resolved_at) })}` : ''}
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
