/**
 * DemoControls.tsx — SIMULATED buttons that fake band events (mock mode only).
 * Owner: Person 3 (Fahim, Zuhayr).
 * Purpose: build and rehearse the UI before the backend/band are ready, and as a stage fallback.
 * In live mode this panel is hidden — Kavish's simulator web page sends real events instead.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, SimulatedTag } from '@/components/ui';
import { USE_MOCK } from '@/config';
import { addSampleHelpEvent, IS_SAMPLE, resetSampleHelpEvents } from '@/data/helpAlert';
import { useLakaz } from '@/data/store';
import { colors, space } from '@/theme';

/** Four buttons: leave home, SOS, back home, reset. Returns null in live mode. */
export function DemoControls() {
  const { sim } = useLakaz();
  if (!USE_MOCK) return null;
  return (
    <Card style={[styles.card]}>
      <View style={styles.head}>
        <SimulatedTag text="DEMO CONTROLS" />
        <AppText variant="small" color={colors.textMuted} style={styles.flex}>
          Fake band events. Ladder uses demo timers 10 s / 25 s / 45 s.
        </AppText>
      </View>
      <View style={styles.grid}>
        <View style={styles.cell}>
          <Button label="Leave home" icon="walk" tone="secondary" onPress={sim.leaveHome} />
        </View>
        <View style={styles.cell}>
          <Button label="SOS" icon="megaphone" tone="secondary" onPress={sim.sos} />
        </View>
        <View style={styles.cell}>
          <Button label="Back home" icon="home" tone="secondary" onPress={sim.backHome} />
        </View>
        {/* Fakes the band's help button → takeover pops up. Hidden when real Supabase alerts are on. */}
        {IS_SAMPLE ? (
          <View style={styles.cell}>
            <Button label="Help button" icon="hand-left" tone="secondary" onPress={addSampleHelpEvent} />
          </View>
        ) : null}
        <View style={styles.cell}>
          <Button label="Reset" icon="refresh" tone="ghost" onPress={() => { sim.reset(); resetSampleHelpEvents(); }} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, borderWidth: 2, borderColor: colors.simulated, borderStyle: 'dashed' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { flexGrow: 1, flexBasis: '45%' },
});
