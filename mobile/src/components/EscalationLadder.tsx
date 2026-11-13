/**
 * EscalationLadder.tsx — vertical step list showing how far the alert has escalated (section 9).
 * Owner: Person 3/4 (Zuhayr). This is the "wow" visual during the demo: judges watch it climb.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { USE_MOCK } from '@/config';
import { ladderSteps } from '@/lib/format';
import { colors, space, statusStyles } from '@/theme';
import type { Alert } from '@/types';

/**
 * Inputs: the alert. Steps at or below alert.level are "reached".
 * When acknowledged, the ladder shows that escalation stopped (section 9: "stop escalating").
 */
export function EscalationLadder({ alert }: { alert: Alert }) {
  const stopped = alert.status === 'Acknowledged' || alert.status === 'Resolved';
  return (
    <View accessibilityLabel={`Escalation level ${alert.level} of 3`}>
      {ladderSteps.map((step, i) => {
        const reached = step.level <= alert.level;
        const current = step.level === alert.level && !stopped;
        const color = reached
          ? step.level === 3
            ? statusStyles.Critical.bg
            : statusStyles.Active.bg
          : colors.border;
        const last = i === ladderSteps.length - 1;
        return (
          <View key={step.level} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: reached ? color : colors.card, borderColor: color }]}>
                {reached ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
              </View>
              {!last && <View style={[styles.line, { backgroundColor: step.level < alert.level ? color : colors.border }]} />}
            </View>
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <AppText variant={current ? 'bodyBold' : 'body'} color={reached ? colors.text : colors.textMuted}>
                  {step.title}
                </AppText>
                {current ? (
                  <AppText variant="label" color={color}>
                    NOW
                  </AppText>
                ) : null}
              </View>
              <AppText variant="small" color={colors.textMuted}>
                {step.detail} · {USE_MOCK ? `${step.demo} (demo)` : `${step.demo} demo / ${step.real} real`}
              </AppText>
            </View>
          </View>
        );
      })}
      {stopped ? (
        <View style={styles.stopped}>
          <Ionicons name="hand-left" size={18} color={statusStyles.Acknowledged.bg} />
          <AppText variant="smallBold" color={statusStyles.Acknowledged.bg}>
            Escalation stopped — a caregiver has it
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  rail: { alignItems: 'center', width: 24 },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  line: { width: 3, flex: 1, minHeight: 22, marginVertical: 2, borderRadius: 2 },
  body: { flex: 1, paddingBottom: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stopped: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
});
