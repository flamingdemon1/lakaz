/**
 * ZoneToast.tsx — in-app notification banner for safe-zone events (arrival / departure / unexpected exit).
 * Owner: Person 3/4 (Zuhayr). Mounted once in app/_layout.tsx so it shows on top of every screen.
 *
 * Why in-app and not push: remote push doesn't work in Expo Go (team decision). WhatsApp is the real
 * "phone in pocket" channel; this banner is what the caregiver sees while the app is open.
 *  - Arrival / departure: calm banner, light vibration, disappears after 6 s.
 *  - Unexpected exit: red, sound + strong vibration, STAYS until the caregiver taps it.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, SimulatedTag } from '@/components/ui';
import { usePeople } from '@/data/people';
import { useZones, ZoneEventKind } from '@/data/zones';
import { clock } from '@/lib/format';
import { useAlertFeedback } from '@/lib/useAlertFeedback';
import { colors, MAX_WIDTH, radius, space, statusStyles } from '@/theme';

const LOOK: Record<ZoneEventKind, { bg: string; icon: 'enter' | 'exit' | 'warning'; verb: string }> = {
  arrival: { bg: statusStyles.Resolved.bg, icon: 'enter', verb: 'arrived at' },
  departure: { bg: colors.primary, icon: 'exit', verb: 'left' },
  unexpected_exit: { bg: statusStyles.Critical.bg, icon: 'warning', verb: 'left unexpectedly:' },
};

/** Shows the oldest pending zone notification. */
export function ZoneToast() {
  const { notifications, dismiss } = useZones();
  const { get } = usePeople();
  const { play } = useAlertFeedback();
  const insets = useSafeAreaInsets();
  const ev = notifications[0];

  // Feedback + auto-dismiss, once per event.
  useEffect(() => {
    if (!ev) return;
    if (ev.kind === 'unexpected_exit') {
      play();
      return; // stays until tapped
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const t = setTimeout(() => dismiss(ev.id), 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev?.id]);

  if (!ev) return null;
  const look = LOOK[ev.kind];
  const name = get(ev.personId)?.name ?? 'Someone';
  const urgent = ev.kind === 'unexpected_exit';

  /** Tap: open that person's zones and close this banner. */
  const open = () => {
    dismiss(ev.id);
    router.push({ pathname: '/person/[id]/zones', params: { id: ev.personId } });
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + space.sm }]}>
      <Pressable
        onPress={open}
        accessibilityRole="alert"
        accessibilityLiveRegion={urgent ? 'assertive' : 'polite'}
        accessibilityLabel={`${name} ${look.verb} ${ev.zoneName}. ${ev.note ?? ''} Tap to open safe zones.`}
        style={[styles.toast, { backgroundColor: look.bg }]}>
        <Ionicons name={look.icon} size={26} color={colors.white} />
        <View style={styles.flex}>
          <AppText variant="bodyBold" color={colors.white}>
            {name} {look.verb} {ev.zoneName}
          </AppText>
          <AppText variant="small" color="rgba(255,255,255,0.92)">
            {clock(ev.at)}
            {ev.note ? ` · ${ev.note}` : ''}
            {notifications.length > 1 ? ` · +${notifications.length - 1} more` : ''}
          </AppText>
          <View style={styles.tagRow}>
            <SimulatedTag text="SAMPLE" />
          </View>
        </View>
        <Pressable onPress={() => dismiss(ev.id)} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={10} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.white} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: space.md, zIndex: 1000, elevation: 20 },
  toast: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  flex: { flex: 1, gap: 2 },
  tagRow: { flexDirection: 'row', marginTop: 2 },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
