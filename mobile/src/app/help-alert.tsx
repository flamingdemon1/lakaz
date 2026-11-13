/**
 * app/help-alert.tsx — HELP ALERT + ACKNOWLEDGE screen (checkpoint agreed with Shihad, 13 Nov).
 * Owner: Person 3 (Zuhayr).
 *
 * Shows each help_requested event as "Awaiting acknowledgement" (acknowledged_at is null)
 * or "Acknowledged" (acknowledged_at has a timestamp). "I've got it" calls acknowledgeAlert(device_id, event_id)
 * and the card only turns "Acknowledged" AFTER that call succeeds — never optimistically.
 * Data is a labelled SAMPLE until Supabase is ready (see src/data/helpAlert.ts).
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, EmptyState, Screen, SimulatedTag } from '@/components/ui';
import {
  acknowledgeAlert,
  addSampleHelpEvent,
  fetchHelpEvents,
  HelpEvent,
  IS_SAMPLE,
  resetSampleHelpEvents,
} from '@/data/helpAlert';
import { clock, timeAgo } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors, radius, space, statusStyles, TOUCH } from '@/theme';

/** Screen: loads events, shows loading / error / empty / list states. */
export default function HelpAlertScreen() {
  const [events, setEvents] = useState<HelpEvent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [failNext, setFailNext] = useState(false); // sample-only switch to test the error state

  /** (Re)loads from the "server". Used on open and by Refresh, to prove the acknowledgement was saved. */
  const load = useCallback(async () => {
    setRefreshing(true);
    setLoadError(null);
    try {
      setEvents(await fetchHelpEvents());
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Replaces one row with the server's updated copy. */
  const onUpdated = (row: HelpEvent) =>
    setEvents((list) => (list ?? []).map((e) => (e.event_id === row.event_id ? row : e)));

  const waiting = (events ?? []).filter((e) => !e.acknowledged_at).length;

  return (
    <Screen edges={[]}>
      <View style={styles.topRow}>
        {IS_SAMPLE ? <SimulatedTag text="SAMPLE DATA" /> : null}
        <AppText variant="small" color={colors.textMuted} style={styles.flex}>
          {/* Honest wording: polling isn't built yet, so we don't claim automatic updates. */}
          {IS_SAMPLE ? 'Supabase not connected yet. Tap refresh to reload.' : 'Updates while the app is open.'}
        </AppText>
        <Pressable
          onPress={load}
          disabled={refreshing}
          accessibilityRole="button"
          accessibilityLabel="Refresh alerts"
          hitSlop={8}
          style={styles.refresh}>
          {refreshing ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="refresh" size={22} color={colors.primary} />}
        </Pressable>
      </View>

      {events === null && !loadError ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText color={colors.textMuted}>Loading alerts…</AppText>
        </View>
      ) : loadError ? (
        <EmptyState
          icon="cloud-offline"
          title="Couldn't load alerts"
          body={loadError}
          action={<Button label="Try again" icon="refresh" onPress={load} />}
        />
      ) : events && events.length === 0 ? (
        <EmptyState icon="shield-checkmark" title="No help requests" body="You'll see an alert here when the band's help button is pressed." />
      ) : (
        <>
          <AppText variant="title" accessibilityRole="header">
            {waiting > 0 ? `${waiting} waiting for you` : 'All acknowledged'}
          </AppText>
          {events!.map((e) => (
            <HelpAlertCard key={e.event_id} event={e} failNext={failNext} onUpdated={onUpdated} onFailUsed={() => setFailNext(false)} />
          ))}
        </>
      )}

      {IS_SAMPLE ? (
        <Card style={styles.tools}>
          <SimulatedTag text="SAMPLE TOOLS" />
          <AppText variant="small" color={colors.textMuted}>
            For building and rehearsing only. Hidden once Supabase is connected.
          </AppText>
          <Button label="Add a help request" icon="add-circle" tone="secondary" onPress={() => { addSampleHelpEvent(); load(); }} />
          <Button
            label={failNext ? 'Next acknowledge will FAIL (on)' : 'Make next acknowledge fail'}
            icon="bug"
            tone="secondary"
            onPress={() => setFailNext((v) => !v)}
          />
          <Button label="Reset sample" icon="refresh" tone="ghost" onPress={() => { resetSampleHelpEvents(); load(); }} />
        </Card>
      ) : null}
    </Screen>
  );
}

/**
 * One help alert. Inputs: the event, plus callbacks.
 * States: awaiting → (tap) sending → acknowledged, or → error with "Try again".
 */
function HelpAlertCard({
  event,
  failNext,
  onUpdated,
  onFailUsed,
}: {
  event: HelpEvent;
  failNext: boolean;
  onUpdated: (row: HelpEvent) => void;
  onFailUsed: () => void;
}) {
  const now = useNow();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const acked = !!event.acknowledged_at;
  const tone = acked ? statusStyles.Acknowledged : statusStyles.Critical;

  /** Calls the acknowledge operation; the card changes only when the server returns the updated row. */
  const onAck = async () => {
    setSending(true);
    setError(null);
    try {
      const updated = await acknowledgeAlert(event.device_id, event.event_id, failNext);
      onUpdated(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (failNext) onFailUsed();
      setSending(false);
    }
  };

  return (
    <View style={[styles.card, { borderColor: tone.bg }]} accessibilityLabel={`Help requested. ${acked ? 'Acknowledged' : 'Awaiting acknowledgement'}`}>
      <View style={[styles.band, { backgroundColor: tone.bg }]}>
        <Ionicons name={acked ? 'checkmark-circle' : 'alert-circle'} size={22} color={colors.white} />
        <AppText variant="bodyBold" color={colors.white}>
          {acked ? 'Acknowledged' : 'Awaiting acknowledgement'}
        </AppText>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={[styles.icon, { backgroundColor: tone.soft }]}>
            <Ionicons name="megaphone" size={26} color={tone.bg} />
          </View>
          <View style={styles.flex}>
            <AppText variant="title">Help requested</AppText>
            {/* Only device_id is in the agreed shape — we don't invent a person name here. */}
            <AppText variant="small" color={colors.textMuted}>
              From band …{event.device_id.slice(-4)}
            </AppText>
          </View>
        </View>

        <View style={styles.meta}>
          <Ionicons name="time" size={18} color={colors.textMuted} />
          <AppText color={colors.textMuted}>
            Received {clock(event.received_at)} · {timeAgo(event.received_at, now)}
          </AppText>
        </View>
        {acked ? (
          <View style={styles.meta}>
            <Ionicons name="person-circle" size={18} color={statusStyles.Acknowledged.bg} />
            <AppText variant="bodyBold" color={statusStyles.Acknowledged.bg}>
              Acknowledged at {clock(event.acknowledged_at!)} · {timeAgo(event.acknowledged_at, now)}
            </AppText>
          </View>
        ) : null}

        {error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Ionicons name="warning" size={18} color={statusStyles.Critical.bg} />
            <AppText variant="small" color={colors.text} style={styles.flex}>
              Not acknowledged. {error}
            </AppText>
          </View>
        ) : null}

        {!acked ? (
          <Button
            label={error ? 'Try again' : "I've got it — acknowledge"}
            icon="hand-left"
            tone="danger"
            size="lg"
            loading={sending}
            onPress={onAck}
            accessibilityHint="Tells the other carers you are handling this help request"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  refresh: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  center: { alignItems: 'center', gap: space.md, paddingVertical: space.xxxl },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 2, overflow: 'hidden' },
  band: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  body: { padding: space.lg, gap: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: statusStyles.Critical.soft,
  },
  tools: { gap: space.sm, borderWidth: 2, borderColor: colors.simulated, borderStyle: 'dashed' },
});
