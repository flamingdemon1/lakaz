/**
 * HelpAlertTakeover.tsx — full-screen alert when a NEW unacknowledged help request arrives.
 * Owner: Person 3/4 (Zuhayr).
 *
 * How it works: polls every 5 s while the app is open (usePolling). If it finds a help event with
 * acknowledged_at = null that the carer hasn't dismissed, it takes over the screen with sound + vibration.
 * "I've got it" closes it ONLY after acknowledgeAlert() succeeds (team rule: no optimistic success).
 * Mounted once in app/(tabs)/_layout.tsx so it appears on any caregiver screen.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, View } from 'react-native';

import { SlideToConfirm } from '@/components/motion';
import { Glow } from '@/components/Glow';
import { AppText, Button, SimulatedTag } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { acknowledgeAlert, fetchHelpEvents, HelpEvent, IS_SAMPLE, onHelpEventsChanged } from '@/data/helpAlert';
import { fill } from '@/i18n';
import { clock, timeAgo } from '@/lib/format';
import { useAlertFeedback } from '@/lib/useAlertFeedback';
import { useNow } from '@/lib/useNow';
import { usePolling } from '@/lib/usePolling';
import { colors, MAX_WIDTH, radius, space, statusStyles } from '@/theme';

/** Polls for help events and shows the newest unhandled one. */
export function HelpAlertTakeover() {
  const [current, setCurrent] = useState<HelpEvent | null>(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // event_ids the carer closed with "Later" — they stay in the list but don't pop up again.
  const dismissed = useRef(new Set<string>());
  // event_id currently on screen — used to decide when to play the sound.
  const shownId = useRef<string | null>(null);
  const { play } = useAlertFeedback();
  const now = useNow();
  const { t } = useAuth(); // the takeover speaks the carer's chosen language
  const pulse = useRef(new Animated.Value(1)).current;

  /** One poll: pick the newest unacknowledged, not-dismissed event. */
  const check = useCallback(async () => {
    try {
      const list = await fetchHelpEvents();
      const waiting = list.filter((e) => !e.acknowledged_at);
      setWaitingCount(waiting.length);
      const next = waiting.find((e) => !dismissed.current.has(e.event_id)) ?? null;
      // Sound only when a DIFFERENT event appears — not on every poll.
      if (next && next.event_id !== shownId.current) play();
      shownId.current = next?.event_id ?? null;
      setCurrent(next);
    } catch {
      // A failed poll keeps the last state; the list screen shows the error. Next poll retries.
    }
  }, [play]);

  usePolling(check, 5000);
  useEffect(() => onHelpEventsChanged(check), [check]);

  // Gentle pulse while open: motion means "needs attention".
  useEffect(() => {
    if (!current) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [current, pulse]);

  if (!current) return null;

  /** Acknowledge; close only when the server confirms. */
  const onAck = async () => {
    setBusy(true);
    setErr(null);
    try {
      await acknowledgeAlert(current.device_id, current.event_id);
      setCurrent(null);
      check(); // another one may be waiting
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** Close without acknowledging (it stays "Awaiting" in the list). */
  const onLater = () => {
    dismissed.current.add(current.event_id);
    shownId.current = null;
    setErr(null);
    setCurrent(null);
  };

  /** Go to the full list. */
  const onSeeAll = () => {
    onLater();
    router.push('/help-alert');
  };

  const tone = statusStyles.Critical;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onLater}>
      {/* Night glow: black screen with a red glow rising from the bottom — red still means emergency only. */}
      <View style={styles.backdrop}>
        <Glow color={tone.bg} />
        <View style={styles.sheet} accessibilityViewIsModal accessibilityLiveRegion="assertive">
          {IS_SAMPLE ? <SimulatedTag text="SAMPLE DATA" /> : null}
          <Animated.View style={[styles.iconWrap, { backgroundColor: tone.soft, transform: [{ scale: pulse }] }]}>
            <Ionicons name="megaphone" size={44} color={tone.bg} />
          </Animated.View>
          <AppText variant="label" color={tone.bg}>
            {t('awaitingAck')}{waitingCount > 1 ? ` · ${fill(t('nWaitingCaps'), { n: waitingCount })}` : ''}
          </AppText>
          <AppText variant="display" style={styles.center}>
            {t('helpRequested')}
          </AppText>
          <AppText color={colors.textMuted} style={styles.center}>
            {fill(t('helpPressedOnBand'), { id: current.device_id.slice(-4) })}
          </AppText>
          <AppText variant="bodyBold" style={styles.center}>
            {fill(t('receivedAt'), { time: clock(current.received_at), ago: timeAgo(current.received_at, now) })}
          </AppText>
          {err ? (
            <AppText variant="small" color={tone.bg} style={styles.center}>
              {fill(t('notAcked'), { err })}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            {/* Slide, not tap — same as the wandering takeover, so a pocket tap can't acknowledge. */}
            <SlideToConfirm
              label={err ? t('slideRetry') : t('slideGotIt')}
              color={tone.bg}
              loading={busy}
              onConfirm={onAck}
              accessibilityHint="Tells the other carers you are handling this help request"
            />
            <Button label={t('seeAllHelp')} icon="list" tone="secondary" onPress={onSeeAll} />
            <Button label={t('later')} tone="ghost" onPress={onLater} accessibilityHint="Closes this without acknowledging" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg, backgroundColor: colors.background },
  sheet: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    backgroundColor: 'transparent', // content sits straight on the black screen (glow design)
    borderRadius: radius.xl,
    padding: space.xl,
    alignItems: 'center',
    gap: space.md,
  },
  iconWrap: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.sm },
});
