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
import type { HelpEvent } from '@/data/helpAlert';
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
  onClose,
}: {
  event: HelpEvent | null;
  loadedAt: number | null;
  sample: boolean;
  onClose: () => void;
}) {
  const open = !!event?.acknowledged_at;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      {/* Tap outside to close; the sheet itself swallows taps. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close receipt">
        {open && event ? (
          <Pressable style={styles.sheet} onPress={() => {}} accessibilityViewIsModal accessibilityLiveRegion="polite">
            {sample ? <SimulatedTag text="SAMPLE DATA" /> : null}
            {/* Navy (brand primary) by team request: the receipt is a record, not a live status. */}
            <PopIn>
              <View style={styles.check}>
                <Ionicons name="checkmark" size={40} color={colors.white} />
              </View>
            </PopIn>
            <AppText variant="title" style={styles.center} accessibilityRole="header">
              Acknowledgement saved
            </AppText>
            <AppText color={colors.textMuted} style={styles.center}>
              {sample ? 'Saved in the sample database on this device.' : 'Saved in Lakaz (Supabase). Other carers see it as handled.'}
            </AppText>

            <View style={styles.rows}>
              <Row label="Alert reference" value={event.event_id} mono />
              <Row label="Band" value={`…${event.device_id.slice(-4)}`} />
              <Row label="Help requested" value={fullStamp(event.received_at)} />
              <Row label="Acknowledged at" value={fullStamp(event.acknowledged_at!)} strong />
            </View>

            {loadedAt ? (
              <View style={styles.proof}>
                <Ionicons name="cloud-done" size={16} color={colors.textMuted} />
                {/* Honest: says when we last READ this from the server, so a refresh visibly changes this line
                    while the saved time above stays the same. */}
                <AppText variant="small" color={colors.textMuted} style={styles.flex}>
                  Read from {sample ? 'the sample database' : 'Supabase'} at {fullStamp(new Date(loadedAt).toISOString())}. The
                  acknowledged time is the server's.
                </AppText>
              </View>
            ) : null}

            <Button label="Close" tone="primary" onPress={onClose} />
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
        color={strong ? colors.primary : colors.text}
        style={mono ? styles.mono : undefined}
        selectable>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(42,36,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  sheet: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    backgroundColor: colors.card,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  rows: { borderRadius: radius.md, backgroundColor: colors.muted, padding: space.md, gap: space.sm },
  row: { gap: 2 },
  mono: { fontFamily: 'monospace', fontSize: 15 },
  proof: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  flex: { flex: 1 },
});
