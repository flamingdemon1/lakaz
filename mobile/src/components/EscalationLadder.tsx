/**
 * EscalationLadder.tsx — vertical step list showing how far an incident has escalated (section 9 / F),
 * WITH the real contact names, the timer for each step, and — if the community step is blocked — why.
 * Owner: Person 3/4 (Zuhayr). This is the "wow" visual during the demo: judges watch it climb.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { communityBlockedReason, fmtDelay, useEscalation } from '@/data/escalation';
import { usePeople } from '@/data/people';
import { colors, space, statusStyles } from '@/theme';
import type { Alert } from '@/types';

/**
 * Inputs: the alert. Steps at or below alert.level are "reached".
 * When acknowledged, the ladder shows that escalation stopped (section 9: "stop escalating").
 */
export function EscalationLadder({ alert }: { alert: Alert }) {
  const { timers, settings } = useEscalation();
  const { get } = usePeople();
  const p = get(alert.person_id);
  const primary = p?.guardians.find((g) => g.role === 'primary');
  const secondary = p?.guardians.filter((g) => g.role === 'secondary') ?? [];
  const stopped = alert.status === 'Acknowledged' || alert.status === 'Resolved';
  const blocked = communityBlockedReason(alert, settings);

  const steps = [
    { level: 0, title: 'Band vibrates + voice warning', detail: 'Kreol prompt on the band/laptop', after: '0 s' },
    { level: 1, title: 'Primary caregiver', detail: primary ? `${primary.name} (${primary.relationship})` : 'No primary set', after: fmtDelay(timers.l1) },
    {
      level: 2,
      title: 'Secondary caregiver + live tracking',
      detail: secondary.length ? secondary.map((g) => g.name).join(', ') : 'No secondary set',
      after: fmtDelay(timers.l2),
    },
    { level: 3, title: 'Community alert', detail: 'Verified responders nearby', after: fmtDelay(timers.l3) },
  ];

  return (
    <View accessibilityLabel={`Escalation level ${alert.level} of 3`}>
      {steps.map((step, i) => {
        const reached = step.level <= alert.level;
        const current = step.level === alert.level && !stopped;
        const skipped = step.level === 3 && !reached && !!blocked && !stopped;
        const color = reached ? (step.level === 3 ? statusStyles.Critical.bg : statusStyles.Active.bg) : colors.border;
        const last = i === steps.length - 1;
        return (
          <View key={step.level} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: reached ? color : colors.card, borderColor: color }]}>
                {reached ? <Ionicons name="checkmark" size={14} color={colors.white} /> : skipped ? <Ionicons name="remove" size={14} color={colors.textMuted} /> : null}
              </View>
              {!last && <View style={[styles.line, { backgroundColor: step.level < alert.level ? color : colors.border }]} />}
            </View>
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <AppText variant={current ? 'bodyBold' : 'body'} color={reached ? colors.text : colors.textMuted} style={styles.flex}>
                  {step.title}
                </AppText>
                {current ? (
                  <AppText variant="label" color={color}>
                    NOW
                  </AppText>
                ) : (
                  <AppText variant="small" color={colors.textMuted}>
                    {step.after}
                  </AppText>
                )}
              </View>
              <AppText variant="small" color={colors.textMuted}>
                {step.detail}
              </AppText>
              {skipped ? (
                <AppText variant="small" color={statusStyles.Active.bg}>
                  Won't trigger: {blocked}
                </AppText>
              ) : null}
            </View>
          </View>
        );
      })}
      {stopped ? (
        <View style={styles.stopped}>
          <Ionicons name="hand-left" size={18} color={statusStyles.Acknowledged.bg} />
          <AppText variant="smallBold" color={statusStyles.Acknowledged.bg}>
            {alert.status === 'Resolved' ? 'Incident closed' : 'Escalation stopped — a caregiver has it'}
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
  flex: { flex: 1 },
  stopped: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
});
