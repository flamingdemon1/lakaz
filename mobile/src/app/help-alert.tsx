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
import { router, Stack } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AckReceipt } from '@/components/AckReceipt';
import { AppText, Button, Card, EmptyState, Screen, SimulatedTag } from '@/components/ui';
import {
  acknowledgeAlert,
  addSampleHelpEvent,
  fetchHelpEvents,
  HelpEvent,
  IS_SAMPLE,
  NOT_SIGNED_IN,
  onHelpEventsChanged,
  resetSampleHelpEvents,
} from '@/data/helpAlert';
import { useAuth } from '@/data/auth';
import { fill } from '@/i18n';
import { resetTo } from '@/lib/nav';
import { usePolling } from '@/lib/usePolling';
import { clock, timeAgo } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors, radius, space, statusStyles, TOUCH } from '@/theme';

/** Screen: loads events, shows loading / error / empty / list states. */
export default function HelpAlertScreen() {
  const [events, setEvents] = useState<HelpEvent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [failNext, setFailNext] = useState(false); // sample-only switch to test the error state
  // Receipt (surprise card "Prove It Works"): which event's receipt is open, and when the list was last
  // read from the server. We store the event_id, not the row, so the receipt always shows the NEWEST
  // server copy — after a refresh it re-reads acknowledged_at from Supabase.
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const { t } = useAuth(); // follows the language chosen in Profile
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  /** (Re)loads from the "server". Used on open and by Refresh, to prove the acknowledgement was saved. */
  const load = useCallback(async (silent = false) => {
    // Why `silent`: background polls shouldn't flash the spinner every 5 s.
    if (!silent) setRefreshing(true);
    try {
      setEvents(await fetchHelpEvents());
      setLoadedAt(Date.now());
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  // Auto-refresh every 5 s while this screen is open (first run is immediate, with spinner).
  const first = useRef(true);
  usePolling(() => {
    load(!first.current);
    first.current = false;
  }, 5000);
  // Instant update when this phone acknowledges / adds / resets.
  useEffect(() => onHelpEventsChanged(() => load(true)), [load]);

  /** Replaces one row with the server's updated copy. */
  const onUpdated = (row: HelpEvent) =>
    setEvents((list) => (list ?? []).map((e) => (e.event_id === row.event_id ? row : e)));

  const waiting = (events ?? []).filter((e) => !e.acknowledged_at).length;
  const receiptEvent = (events ?? []).find((e) => e.event_id === receiptId) ?? null;

  // Why: with no screen behind this one (opened by direct link, or the web page was reloaded here) the header
  // has no back arrow and the carer is stuck. Then we show our own arrow that goes to Home instead.
  const canGoBack = router.canGoBack();

  return (
    <Screen edges={[]}>
      <Stack.Screen
        options={{
          title: t('actHelpAlerts'), // header title follows the chosen language too
          headerLeft: canGoBack
            ? undefined // normal case: the standard back arrow
            : () => (
                <Pressable
                  onPress={() => router.replace('/')}
                  accessibilityRole="button"
                  accessibilityLabel="Back to Home"
                  hitSlop={8}
                  style={styles.back}>
                  <Ionicons name="arrow-back" size={24} color={colors.link} />
                </Pressable>
              ),
        }}
      />
      <View style={styles.topRow}>
        {IS_SAMPLE ? <SimulatedTag text="SAMPLE DATA" /> : null}
        <AppText variant="small" color={colors.textMuted} style={styles.flex}>
          {/* Honest wording: we poll every 5 s while open — no background notifications. */}
          {IS_SAMPLE ? t('sampleRefresh') : t('liveRefresh')}
        </AppText>
        <Pressable
          onPress={() => load()}
          disabled={refreshing}
          accessibilityRole="button"
          accessibilityLabel="Refresh alerts"
          hitSlop={8}
          style={styles.refresh}>
          {refreshing ? <ActivityIndicator color={colors.link} /> : <Ionicons name="refresh" size={22} color={colors.link} />}
        </Pressable>
      </View>

      {/* Mauritian dataset feature: read-only, separate screen, so it can never break the alert flow below. */}
      <Button label={t('findFacility')} icon="medkit" tone="secondary" onPress={() => router.push('/facilities')} />

      {events === null && !loadError ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.link} />
          <AppText color={colors.textMuted}>{t('loadingAlerts')}</AppText>
        </View>
      ) : loadError === NOT_SIGNED_IN ? (
        // Supabase is on but nobody is signed in: RLS would return nothing, so ask for the carer account.
        <EmptyState
          icon="log-in"
          title={t('signInForAlerts')}
          body={t('signInForAlertsBody')}
          action={<Button label={t('goToLogin')} icon="log-in" onPress={() => resetTo('/login')} />}
        />
      ) : loadError ? (
        <EmptyState
          icon="cloud-offline"
          title={t('couldntLoad')}
          body={loadError}
          action={<Button label={t('tryAgain')} icon="refresh" onPress={() => load()} />}
        />
      ) : events && events.length === 0 ? (
        <EmptyState icon="shield-checkmark" title={t('noHelpRequests')} body={t('noHelpRequestsBody')} />
      ) : (
        <>
          <AppText variant="title" accessibilityRole="header">
            {waiting > 0 ? fill(t('nWaitingForYou'), { n: waiting }) : t('allAcknowledged')}
          </AppText>
          {events!.map((e) => (
            <HelpAlertCard
              key={e.event_id}
              event={e}
              failNext={failNext}
              onUpdated={onUpdated}
              onFailUsed={() => setFailNext(false)}
              onViewReceipt={() => setReceiptId(e.event_id)}
            />
          ))}
        </>
      )}

      {IS_SAMPLE ? (
        <Card style={styles.tools}>
          <SimulatedTag text="SAMPLE TOOLS" />
          <AppText variant="small" color={colors.textMuted}>
            For building and rehearsing only. Hidden once Supabase is connected.
          </AppText>
          <Button label="Add a help request" icon="add-circle" tone="secondary" onPress={addSampleHelpEvent} />
          <Button
            label={failNext ? 'Next acknowledge will FAIL (on)' : 'Make next acknowledge fail'}
            icon="bug"
            tone="secondary"
            onPress={() => setFailNext((v) => !v)}
          />
          <Button label="Reset sample" icon="refresh" tone="ghost" onPress={resetSampleHelpEvents} />
        </Card>
      ) : null}
      <AckReceipt event={receiptEvent} loadedAt={loadedAt} sample={IS_SAMPLE} onClose={() => setReceiptId(null)} />
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
  onViewReceipt,
}: {
  event: HelpEvent;
  failNext: boolean;
  onUpdated: (row: HelpEvent) => void;
  onFailUsed: () => void;
  /** Opens the acknowledgement receipt for this event (only offered once it is acknowledged). */
  onViewReceipt: () => void;
}) {
  const now = useNow();
  const { t } = useAuth();
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
          {acked ? t('stAcknowledged') : t('awaitingAckShort')}
        </AppText>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={[styles.icon, { backgroundColor: tone.soft }]}>
            <Ionicons name="megaphone" size={26} color={tone.bg} />
          </View>
          <View style={styles.flex}>
            <AppText variant="title">{t('helpRequested')}</AppText>
            {/* Only device_id is in the agreed shape — we don't invent a person name here. */}
            <AppText variant="small" color={colors.textMuted}>
              {fill(t('fromBand'), { id: event.device_id.slice(-4) })}
            </AppText>
          </View>
        </View>

        <View style={styles.meta}>
          <Ionicons name="time" size={18} color={colors.textMuted} />
          <AppText color={colors.textMuted}>
            {fill(t('receivedAt'), { time: clock(event.received_at), ago: timeAgo(event.received_at, now) })}
          </AppText>
        </View>
        {acked ? (
          <View style={styles.meta}>
            <Ionicons name="person-circle" size={18} color={statusStyles.Acknowledged.bg} />
            <AppText variant="bodyBold" color={statusStyles.Acknowledged.bg}>
              {fill(t('ackedAt'), { time: clock(event.acknowledged_at!), ago: timeAgo(event.acknowledged_at, now) })}
            </AppText>
          </View>
        ) : null}

        {error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Ionicons name="warning" size={18} color={statusStyles.Critical.bg} />
            <AppText variant="small" color={colors.text} style={styles.flex}>
              {fill(t('notAcked'), { err: error })}
            </AppText>
          </View>
        ) : null}

        {!acked ? (
          <Button
            label={error ? t('tryAgain') : t('iveGotItAck')}
            icon="hand-left"
            tone="danger"
            size="lg"
            loading={sending}
            onPress={onAck}
            accessibilityHint="Tells the other carers you are handling this help request"
          />
        ) : (
          // Surprise card "Prove It Works": reopenable any time, including after a refresh.
          <Button
            label={t('viewReceipt')}
            icon="receipt"
            tone="primary"
            onPress={onViewReceipt}
            accessibilityHint="Shows the alert reference and the saved date and time"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  refresh: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  back: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
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
