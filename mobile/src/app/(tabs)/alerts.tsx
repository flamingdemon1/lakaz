/**
 * app/(tabs)/alerts.tsx — list of alerts with a simple filter (Open / Resolved / All).
 * Owner: Person 3 (Fahim, Zuhayr).
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AlertCard } from '@/components/AlertCard';
import { AppText, EmptyState, Screen } from '@/components/ui';
import { isOpen, useLakaz } from '@/data/store';
import { colors, radius, space, TOUCH } from '@/theme';

type Filter = 'Open' | 'Resolved' | 'All';

/** Alerts tab. */
export default function Alerts() {
  const { alerts } = useLakaz();
  const [filter, setFilter] = useState<Filter>('Open');

  const shown = alerts.filter((a) =>
    filter === 'All' ? true : filter === 'Open' ? isOpen(a) : a.status === 'Resolved',
  );

  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header" style={styles.title}>
        Alerts
      </AppText>

      <View style={styles.chips} accessibilityRole="tablist">
        {(['Open', 'Resolved', 'All'] as Filter[]).map((f) => {
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

      {shown.length === 0 ? (
        <EmptyState
          icon={filter === 'Open' ? 'shield-checkmark' : 'archive'}
          title={filter === 'Open' ? 'No open alerts' : 'Nothing here yet'}
          body={filter === 'Open' ? 'You will hear a sound and see a full-screen alert if anything happens.' : undefined}
        />
      ) : (
        shown.map((a) => <AlertCard key={a.alert_id} alert={a} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.sm },
  chips: { flexDirection: 'row', gap: space.sm },
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
