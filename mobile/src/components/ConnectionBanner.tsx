/**
 * ConnectionBanner.tsx — thin strip at the top saying where the data comes from.
 * Owner: Person 3 (Fahim, Zuhayr).
 * Why it exists: judges (and caregivers) must never mistake simulated or stale data for live data.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, IconName } from '@/components/ui';
import { useLakaz } from '@/data/store';
import { colors, radius, space } from '@/theme';

/** Shows Live / Simulated / Reconnecting / Offline, with a retry on errors. */
export function ConnectionBanner() {
  const { mode, error, refresh } = useLakaz();

  const look: Record<typeof mode, { bg: string; icon: IconName; text: string }> = {
    mock: { bg: colors.simulated, icon: 'flask', text: 'SIMULATED data — demo mode, no backend' },
    connecting: { bg: colors.offline, icon: 'sync', text: 'Connecting to LAKAZ server…' },
    live: { bg: colors.primary, icon: 'radio', text: 'Connected to LAKAZ server' },
    // Amber, not red: losing the connection is a warning; red is kept for emergencies only.
    disconnected: { bg: colors.warning, icon: 'cloud-offline', text: 'Not connected — showing last known data' },
  };
  const l = look[mode];

  return (
    <View>
      <View style={[styles.bar, { backgroundColor: l.bg }]} accessibilityRole="summary">
        <Ionicons name={l.icon} size={16} color={colors.white} />
        <AppText variant="smallBold" color={colors.white} style={styles.flex}>
          {l.text}
        </AppText>
      </View>
      {mode === 'disconnected' && error ? (
        <Pressable onPress={refresh} style={styles.err} accessibilityRole="button" accessibilityLabel="Retry connection">
          <AppText variant="small" color={colors.text} style={styles.flex}>
            {error}
          </AppText>
          <AppText variant="smallBold" color={colors.primary}>
            Retry
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
  err: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    marginTop: space.xs,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: '#FDE8E8',
  },
  flex: { flex: 1 },
});
