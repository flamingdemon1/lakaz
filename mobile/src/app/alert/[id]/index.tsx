/**
 * app/alert/[id]/index.tsx — INCIDENT / ALERT DETAIL: what happened, status, escalation ladder with names,
 * "Escalate now", incident timeline, where, and what to do. (Section F builds on the original alert screen.)
 * Owner: Person 3/4 (Fahim, Zuhayr). Priority #2 in the demo order (alert + acknowledge).
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CallContacts } from '@/components/CallContacts';
import { EscalationLadder } from '@/components/EscalationLadder';
import { LocationCard } from '@/components/LocationCard';
import { AppText, Button, Card, EmptyState, IconName, Screen, SectionTitle, SimulatedTag, StatusPill } from '@/components/ui';
import { USE_MOCK } from '@/config';
import { TimelineEntry, useEscalation } from '@/data/escalation';
import { MOCK_CAREGIVERS } from '@/data/mock';
import { useLakaz } from '@/data/store';
import { alertAdvice, alertExplainer, alertTitle, clock, ESCALATING, timeAgo } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors, radius, space, statusStyles } from '@/theme';

/** Detail screen for one alert, chosen by the `id` in the URL. */
export default function AlertDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { alerts, acknowledge, resolve, escalateNow, me } = useLakaz();
  const { timeline: timelineOf } = useEscalation();
  const now = useNow();
  const [busy, setBusy] = useState<'ack' | 'resolve' | 'escalate' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const alert = alerts.find((a) => a.alert_id === id);
  if (!alert) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="help-circle" title="Alert not found" body="It may have been cleared after a demo reset." />
      </Screen>
    );
  }

  const s = statusStyles[alert.status];
  const canAck = alert.status === 'Active' || alert.status === 'Critical';
  const canResolve = alert.status !== 'Resolved';
  // Escalate only open, unacknowledged emergencies that aren't at the top yet.
  const canEscalate = canAck && alert.level < 3 && USE_MOCK;
  const timeline = timelineOf(alert.alert_id);
  const ackName = alert.acknowledged_by
    ? alert.acknowledged_by === me?.id
      ? 'You'
      : MOCK_CAREGIVERS[alert.acknowledged_by as keyof typeof MOCK_CAREGIVERS]?.name ?? alert.acknowledged_by
    : null;

  /** Runs an action and shows a readable error instead of failing silently. */
  const run = async (kind: 'ack' | 'resolve' | 'escalate') => {
    setBusy(kind);
    setErr(null);
    try {
      await (kind === 'ack' ? acknowledge(alert.alert_id) : kind === 'resolve' ? resolve(alert.alert_id) : escalateNow(alert.alert_id));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen edges={[]}>
      <View style={[styles.banner, { backgroundColor: s.soft, borderColor: s.bg }]}>
        <View style={styles.bannerTop}>
          <StatusPill status={alert.status} large />
          {USE_MOCK ? <SimulatedTag /> : null}
        </View>
        <AppText variant="title">Marie-Claire · {alertTitle[alert.type]}</AppText>
        <AppText color={colors.text}>{alertExplainer[alert.type]}</AppText>
        <AppText variant="small" color={colors.textMuted}>
          Started {clock(alert.created_at)} ({timeAgo(alert.created_at, now)}) · {alert.alert_id}
        </AppText>
        {ackName ? (
          <View style={styles.ackRow}>
            <Ionicons name="person-circle" size={20} color={statusStyles.Acknowledged.bg} />
            <AppText variant="smallBold" color={statusStyles.Acknowledged.bg}>
              {ackName} acknowledged this alert
            </AppText>
          </View>
        ) : null}
      </View>

      {canAck || canResolve ? (
        <View style={styles.actions}>
          {canAck ? (
            <Button
              label="I've got it"
              icon="hand-left"
              tone="danger"
              size="lg"
              loading={busy === 'ack'}
              onPress={() => run('ack')}
              accessibilityHint="Stops escalation and tells others you are handling it"
            />
          ) : null}
          {canResolve ? (
            <Button
              label="She is safe — close alert"
              icon="checkmark-circle"
              tone={canAck ? 'secondary' : 'success'}
              loading={busy === 'resolve'}
              onPress={() => run('resolve')}
            />
          ) : null}
          {err ? (
            <AppText variant="small" color={statusStyles.Critical.bg}>
              Didn't work: {err}
            </AppText>
          ) : null}
        </View>
      ) : (
        <Card style={styles.resolved}>
          <Ionicons name="checkmark-circle" size={26} color={statusStyles.Resolved.bg} />
          <AppText variant="bodyBold">Resolved — Marie-Claire is safe.</AppText>
        </Card>
      )}

      {/* Section F: call emergency contacts (sample numbers never dialled; 999/114 need a 2nd tap). */}
      {alert.status !== 'Resolved' ? (
        <>
          <SectionTitle>Call</SectionTitle>
          <CallContacts personId={alert.person_id} alertId={alert.alert_id} />
        </>
      ) : null}

      <SectionTitle>What to do</SectionTitle>
      <Card style={styles.advice}>
        <Ionicons name="bulb" size={20} color={colors.primary} />
        <AppText style={styles.flex}>{alertAdvice[alert.type]}</AppText>
      </Card>
      {alert.type === 'possible_removal' ? (
        <AppText variant="small" color={colors.textMuted}>
          SAMPLE alert type — not in the shared backend contract yet (needs team approval).
        </AppText>
      ) : null}

      {/* Only emergencies climb the ladder; device warnings go to the primary caregiver only. */}
      {ESCALATING.includes(alert.type) ? (
        <>
          <SectionTitle right={<AppText variant="smallBold" color={colors.primary} onPress={() => router.push('/escalation')}>Settings</AppText>}>
            Escalation
          </SectionTitle>
          <Card style={styles.gap}>
            <EscalationLadder alert={alert} />
            {canEscalate ? (
              <Button
                label="Escalate now"
                icon="arrow-up-circle"
                tone="secondary"
                loading={busy === 'escalate'}
                onPress={() => run('escalate')}
                accessibilityHint="Alerts the next person on the ladder straight away"
              />
            ) : null}
          </Card>
        </>
      ) : null}

      <SectionTitle>Timeline</SectionTitle>
      <Card>
        {timeline.length === 0 ? (
          <AppText color={colors.textMuted}>Nothing recorded yet.</AppText>
        ) : (
          timeline.map((e, i) => (
            <View key={`${e.at}-${i}`} style={[styles.tlRow, i > 0 && styles.tlDivider]}>
              <AppText variant="smallBold" style={styles.tlTime}>
                {clock(e.at)}
              </AppText>
              <Ionicons name={TL_ICON[e.kind]} size={16} color={e.kind === 'ack' || e.kind === 'resolve' ? statusStyles.Resolved.bg : colors.primary} />
              <AppText variant="small" style={styles.flex}>
                {e.text}
              </AppText>
            </View>
          ))
        )}
      </Card>

      {/* Privacy (D10): location shown only for this incident, and history only as "last known". */}
      <LocationCard alert={alert} title={alert.status === 'Resolved' ? 'Last known location (closed)' : 'Location'} mapHeight={240} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: radius.lg, borderWidth: 2, padding: space.lg, gap: space.sm, marginTop: space.sm },
  bannerTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ackRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  actions: { gap: space.sm },
  resolved: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  advice: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  flex: { flex: 1 },
  gap: { gap: space.md },
  tlRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.sm },
  tlDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  tlTime: { width: 70 },
});

/** Icon per timeline entry kind. */
const TL_ICON: Record<TimelineEntry['kind'], IconName> = {
  start: 'flag',
  level: 'arrow-up-circle',
  ack: 'hand-left',
  resolve: 'checkmark-circle',
  manual: 'person',
  tracking: 'radio',
  info: 'information-circle',
};
