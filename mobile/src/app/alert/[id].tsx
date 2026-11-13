/**
 * app/alert/[id].tsx — ALERT DETAIL: what happened, how far it escalated, where, and what to do.
 * Owner: Person 3/4 (Fahim, Zuhayr). Priority #2 in the demo order (alert + acknowledge).
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EscalationLadder } from '@/components/EscalationLadder';
import { LocationCard } from '@/components/LocationCard';
import { AppText, Button, Card, EmptyState, Screen, SectionTitle, SimulatedTag, StatusPill } from '@/components/ui';
import { USE_MOCK } from '@/config';
import { MOCK_CAREGIVERS } from '@/data/mock';
import { useLakaz } from '@/data/store';
import { alertExplainer, alertTitle, clock, timeAgo } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors, radius, space, statusStyles } from '@/theme';

/** Detail screen for one alert, chosen by the `id` in the URL. */
export default function AlertDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { alerts, acknowledge, resolve, me } = useLakaz();
  const now = useNow();
  const [busy, setBusy] = useState<'ack' | 'resolve' | null>(null);
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
  const ackName = alert.acknowledged_by
    ? alert.acknowledged_by === me?.id
      ? 'You'
      : MOCK_CAREGIVERS[alert.acknowledged_by as keyof typeof MOCK_CAREGIVERS]?.name ?? alert.acknowledged_by
    : null;

  /** Runs an action and shows a readable error instead of failing silently. */
  const run = async (kind: 'ack' | 'resolve') => {
    setBusy(kind);
    setErr(null);
    try {
      await (kind === 'ack' ? acknowledge(alert.alert_id) : resolve(alert.alert_id));
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

      <SectionTitle>Escalation</SectionTitle>
      <Card>
        <EscalationLadder alert={alert} />
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
});
