/**
 * LocationCard.tsx — map + honest freshness line ("updated X s ago").
 * Owner: Person 3/4 (Fahim, Zuhayr).
 * Team rule: never call old location data "live". Fresh = fix < 60 s old (section 7.2).
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { LocationMap } from '@/components/LocationMap';
import { AppText, Card, SectionTitle, SimulatedTag } from '@/components/ui';
import { USE_MOCK } from '@/config';
import { MOCK_HOME } from '@/data/mock';
import { isFresh, timeAgo } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors, radius, space, statusStyles } from '@/theme';
import type { Alert } from '@/types';

/**
 * Inputs: the alert whose last_location to show, and a `title`.
 * Shows a "GPS searching" state when there is no fix yet (indoors, section 10 pitfall 5).
 */
export function LocationCard({ alert, title = 'Last known location', mapHeight = 200 }: {
  alert: Alert;
  title?: string;
  mapHeight?: number;
}) {
  const now = useNow();
  const loc = alert.last_location;
  const fresh = isFresh(alert, now);

  return (
    <View style={styles.gap}>
      <SectionTitle right={USE_MOCK ? <SimulatedTag text="SIMULATED GPS" /> : undefined}>{title}</SectionTitle>
      <Card style={styles.gap}>
        {loc ? (
          <>
            <LocationMap lat={loc.lat} lng={loc.lng} fresh={fresh} height={mapHeight}
              // Why mock-only: the real home centre is set to the venue on the day (section 7.5) — not known here yet.
              home={USE_MOCK ? MOCK_HOME : undefined} />
            <View style={styles.row}>
              <View style={[styles.dot, { backgroundColor: fresh ? statusStyles.Resolved.bg : colors.offline }]} />
              <AppText variant="bodyBold" style={styles.flex}>
                {fresh ? 'Recent fix' : 'Old position — not live'}
              </AppText>
              <AppText color={colors.textMuted}>updated {timeAgo(loc.at, now)}</AppText>
            </View>
            {!fresh ? (
              <AppText variant="small" color={colors.textMuted}>
                No new GPS fix for over 60 s. The person may be indoors or the band may be offline.
              </AppText>
            ) : null}
          </>
        ) : (
          <View style={styles.searching}>
            <Ionicons name="locate" size={28} color={colors.textMuted} />
            <AppText variant="bodyBold">GPS searching…</AppText>
            <AppText variant="small" color={colors.textMuted} style={styles.center}>
              No location fix yet. GPS needs a clear view of the sky.
            </AppText>
          </View>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  flex: { flex: 1 },
  searching: {
    alignItems: 'center',
    gap: space.sm,
    padding: space.xl,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  center: { textAlign: 'center' },
});
