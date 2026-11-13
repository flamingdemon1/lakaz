/**
 * IncomingAlert.tsx — full-screen takeover when a new alert arrives or the ladder climbs.
 * Owner: Person 3/4 (Zuhayr).
 * This replaces push notifications (they don't work in Expo Go): sound + vibration + a big red card
 * with one obvious action, "I've got it".
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, View } from 'react-native';

import { AppText, Button, SimulatedTag } from '@/components/ui';
import { USE_MOCK } from '@/config';
import { useLakaz } from '@/data/store';
import { alertExplainer, alertTitle, ladderSteps } from '@/lib/format';
import { useAlertFeedback } from '@/lib/useAlertFeedback';
import { colors, MAX_WIDTH, radius, space, statusStyles } from '@/theme';

/** Mounted once in the root layout; shows itself whenever store.incoming is set. */
export function IncomingAlert() {
  const { incoming, dismissIncoming, acknowledge, alerts } = useLakaz();
  const { play } = useAlertFeedback();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  // Use the newest copy from the list (status may have changed since it popped up).
  const alert = incoming ? alerts.find((a) => a.alert_id === incoming.alert_id) ?? incoming : null;
  const visible = !!alert && alert.status !== 'Acknowledged' && alert.status !== 'Resolved';

  // Sound + vibrate each time a new alert or a new level arrives.
  useEffect(() => {
    if (incoming) play();
  }, [incoming, play]);

  // Gentle pulse on the icon. Motion = "needs attention", so it only runs while the takeover is open.
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulse]);

  if (!alert) return null;
  const critical = alert.status === 'Critical';
  const tone = critical ? statusStyles.Critical : statusStyles.Active;
  const step = ladderSteps[alert.level];

  /** "I've got it" → acknowledge on the server, then close. Shows the error if the server says no. */
  const onAck = async () => {
    setBusy(true);
    setErr(null);
    try {
      await acknowledge(alert.alert_id);
      dismissIncoming();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** Close the takeover and open the full alert screen (map + ladder). */
  const onDetails = () => {
    dismissIncoming();
    router.push({ pathname: '/alert/[id]', params: { id: alert.alert_id } });
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={dismissIncoming}>
      <View style={[styles.backdrop, { backgroundColor: tone.bg }]}>
        <View style={styles.sheet} accessibilityViewIsModal accessibilityLiveRegion="assertive">
          {USE_MOCK ? <SimulatedTag /> : null}
          <Animated.View style={[styles.iconWrap, { backgroundColor: tone.soft, transform: [{ scale: pulse }] }]}>
            <Ionicons name={alert.type === 'sos' ? 'megaphone' : 'walk'} size={44} color={tone.bg} />
          </Animated.View>
          <AppText variant="label" color={tone.bg}>
            {critical ? 'CRITICAL ALERT' : 'ALERT'} · LEVEL {alert.level}
          </AppText>
          <AppText variant="hero" style={styles.center}>
            Marie-Claire · {alertTitle[alert.type]}
          </AppText>
          <AppText color={colors.textMuted} style={styles.center}>
            {alertExplainer[alert.type]}
          </AppText>
          <View style={[styles.stepBox, { backgroundColor: tone.soft }]}>
            <AppText variant="smallBold" color={tone.bg}>
              Now: {step.title} — {step.detail}
            </AppText>
          </View>
          {err ? (
            <AppText variant="small" color={statusStyles.Critical.bg} style={styles.center}>
              Could not acknowledge: {err}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <Button
              label="I've got it"
              icon="hand-left"
              tone="danger"
              size="lg"
              loading={busy}
              onPress={onAck}
              accessibilityHint="Tells the other caregivers you are handling this and stops escalation"
            />
            <Button label="See location & details" icon="map" tone="secondary" onPress={onDetails} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  sheet: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: space.xl,
    alignItems: 'center',
    gap: space.md,
  },
  iconWrap: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  stepBox: { borderRadius: radius.md, paddingVertical: space.sm, paddingHorizontal: space.md },
  actions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.sm },
});
