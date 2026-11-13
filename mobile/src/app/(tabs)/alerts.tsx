/**
 * app/(tabs)/alerts.tsx — open alerts and caregiver safety history.
 * Owner: Person 3 (Fahim, Zuhayr).
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HelpAlertList } from '@/app/help-alert';
import { AlertCard } from '@/components/AlertCard';
import { AppText, EmptyState, Screen } from '@/components/ui';
import { SUPABASE_ENABLED, USE_MOCK } from '@/config';
import { isOpen, isTakeover, useLakaz } from '@/data/store';
import { colors, radius, space, TOUCH } from '@/theme';

const filters = ['Open', 'Resolved', 'History', 'Incidents', 'Acknowledged'] as const;
type Filter = (typeof filters)[number];

/** Reads the alert store and renders the selected alert list. Takes no props. */
export default function Alerts() {
  return SUPABASE_ENABLED ? <HelpAlertList asTab /> : <SampleAlerts />;
}

function SampleAlerts() {
  const { alerts, error, loading } = useLakaz();
  const [filter, setFilter] = useState<Filter>('Open');

  // Resolved alerts may still retain the caregiver who acknowledged them.
  const shown = alerts.filter((alert) => {
    switch (filter) {
      case 'Open': return isOpen(alert);
      case 'Resolved': return alert.status === 'Resolved';
      case 'Incidents': return alert.status === 'Resolved' && isTakeover(alert);
      case 'Acknowledged': return Boolean(alert.acknowledged_by);
      case 'History': return true;
    }
  });

  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header" style={styles.title}>
        Alerts
      </AppText>

      {USE_MOCK && <AppText variant="smallBold">SIMULATED</AppText>}
      {filter !== 'Open' && !USE_MOCK && (
        <AppText variant="small">Showing alerts available from the server.</AppText>
      )}
      <View style={styles.chips} accessibilityRole="tablist">
        {filters.map((f) => {
          const on = f === filter;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.chip, on && styles.chipOn]}>
              <AppText variant="smallBold" color={on ? colors.white : colors.text}>
                {f}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {error && <AppText variant="small">Unable to refresh alerts.</AppText>}
      {loading && shown.length === 0 ? (
        <AppText>Loading alerts…</AppText>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={filter === 'Open' ? 'shield-checkmark' : 'archive'}
          title={filter === 'Open' ? 'No open alerts' : 'No matching alerts available'}
          body={filter === 'Open' ? 'You will hear a sound and see a full-screen alert if anything happens.' : undefined}
        />
      ) : (
        shown.map((alert) => (
          <View key={alert.alert_id} style={styles.entry}>
            {filter !== 'Open' && (
              <AppText variant="small" color={colors.textMuted}>
                Alert opened {new Date(alert.created_at).toLocaleDateString()}
                {alert.acknowledged_by ? ` · Acknowledged by ${alert.acknowledged_by}` : ''}
              </AppText>
            )}
            <AlertCard alert={alert} />
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  entry: { gap: space.sm },
  chip: {
    minHeight: TOUCH - 8,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
