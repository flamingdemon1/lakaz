/**
 * AckReceipt.tsx — "Acknowledgement receipt": a small panel proving an acknowledgement was SAVED.
 * Owner: Person 3 (Zuhayr). Surprise card "Prove It Works" (13 Nov).
 *
 * What it shows — only data Lakaz already saves in Supabase public.alerts (no backend change):
 *  - "Acknowledgement saved"
 *  - the alert reference (event_id) and the band (device_id)
 *  - the saved date + time (acknowledged_at, set by the SERVER — not this phone's clock)
 *  - when the help request was received (received_at)
 * Why it proves something: the row is re-read from Supabase on every refresh, so reopening the receipt after
 * a refresh shows the SAME saved timestamp — it can't come from the phone's memory.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { PopIn } from '@/components/motion';
import { AppText, Button, SimulatedTag } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { HelpEvent, myCarerId } from '@/data/helpAlert';
import { fill } from '@/i18n';
import { colors, MAX_WIDTH, radius, space } from '@/theme';

/**
 * Full date + time with seconds, e.g. "13 Nov 2026, 20:41:07".
 * Why seconds: on stage, "same timestamp after refresh" is only convincing down to the second.
 */
export const fullStamp = (iso: string) =>
  new Date(iso).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

/**
 * Inputs: the acknowledged event (or null = closed), when this copy was loaded from the server,
 * whether it is sample data, and onClose. Shows nothing for an event that isn't acknowledged.
 */
export function AckReceipt({
  event,
  loadedAt,
  sample,
  bandName,
  onClose,
}: {
  event: HelpEvent | null;
  loadedAt: number | null;
  sample: boolean;
  /** The band's friendly name (devices.label), if Supabase has one. */
  bandName?: string;
  onClose: () => void;
}) {
  const open = !!event?.acknowledged_at;
  const { t } = useAuth(); // follows the language chosen in Profile
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      {/* Tap outside to close; the sheet itself swallows taps. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close receipt">
        {open && event ? (
          <Pressable style={styles.sheet} onPress={() => {}} accessibilityViewIsModal accessibilityLiveRegion="polite">
            {sample ? <SimulatedTag text="SAMPLE DATA" /> : null}
            {/* Brand gradient tick (glow design): the receipt is a record, not a live status. */}
            <PopIn>
              <View style={styles.check}>
                <Ionicons name="checkmark" size={40} color={colors.white} />
              </View>
            </PopIn>
            <AppText variant="hero" style={styles.center} accessibilityRole="header">
              {t('ackSaved')}
            </AppText>
            <AppText color={colors.textMuted} style={styles.center}>
              {sample ? t('savedInSample') : t('savedInLakaz')}
            </AppText>

            <View style={styles.rows}>
              <Row label={t('rcRef')} value={event.event_id} mono />
              <Row label={t('bandTitle')} value={bandName ? `${bandName} · …${event.device_id.slice(-4)}` : `…${event.device_id.slice(-4)}`} />
              <Row label={t('rcRequested')} value={fullStamp(event.received_at)} />
              <Row label={t('rcAckAt')} value={fullStamp(event.acknowledged_at!)} strong />
              {/* Who acknowledged — recorded by the server (auth.uid()), shown once the migration is applied. */}
              {event.acknowledged_by ? (
                <Row label={t('rcAckBy')} value={event.acknowledged_by === myCarerId() ? t('whoYou') : t('whoOther')} />
              ) : null}
            </View>

            {loadedAt ? (
              <View style={styles.proof}>
                <Ionicons name="cloud-done" size={16} color={colors.textMuted} />
                {/* Honest: says when we last READ this from the server, so a refresh visibly changes this line
                    while the saved time above stays the same. */}
                <AppText variant="small" color={colors.textMuted} style={styles.flex}>
                  {fill(t('rcReadFrom'), { src: sample ? t('rcSampleDb') : 'Supabase', time: fullStamp(new Date(loadedAt).toISOString()) })}
                </AppText>
              </View>
            ) : null}

            <Button label={t('close')} tone="secondary" onPress={onClose} />
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}

/** One label/value line. `mono` keeps the long UUID readable; `strong` highlights the saved time. */
function Row({ label, value, mono = false, strong = false }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <View style={styles.row} accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="small" color={colors.textMuted}>
        {label}
      </AppText>
      <AppText
        variant={strong ? 'bodyBold' : 'body'}
        color={strong ? colors.link : colors.text}
        style={mono ? styles.mono : undefined}
        selectable>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  sheet: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    // Deep-blue frosted panel (like the reference's "Statistics" card); solid colour is the fallback.
    backgroundColor: '#1B1F7A',
    backgroundImage: 'linear-gradient(160deg, #23289A 0%, #15185E 100%)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.xl,
    padding: space.xl,
    gap: space.md,
    alignItems: 'stretch',
  },
  check: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    backgroundImage: 'linear-gradient(135deg, #3D63FF 0%, #8B5CF6 100%)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  rows: { borderRadius: radius.lg, backgroundColor: 'rgba(0,0,0,0.28)', padding: space.md, gap: space.sm },
  row: { gap: 2 },
  mono: { fontFamily: 'monospace', fontSize: 15 },
  proof: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  flex: { flex: 1 },
});
