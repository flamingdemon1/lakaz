/**
 * NotificationBanner.tsx — the single in-app banner for ALL notification categories (src/data/notify.tsx).
 * Owner: Person 3/4 (Zuhayr). Mounted once in app/_layout.tsx, drawn above every screen.
 *
 * Behaviour by tone:
 *  - critical (SOS, unexpected exit): red, STAYS until tapped/dismissed.
 *  - warning (battery, disconnected, possible removal): amber, stays 10 s.
 *  - good / info (safe return, arrivals, departures): green / teal, stays 6 s.
 * Sound and vibration follow the caregiver's settings (critical ones always on).
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FadeIn } from '@/components/motion';
import { AppText, IconName, SimulatedTag } from '@/components/ui';
import { CATEGORY_INFO, Tone, useNotify } from '@/data/notify';
import { clock } from '@/lib/format';
import { useAlertFeedback } from '@/lib/useAlertFeedback';
import { colors, MAX_WIDTH, radius, space, statusStyles } from '@/theme';

const TONE: Record<Tone, { bg: string; ms: number | null }> = {
  critical: { bg: statusStyles.Critical.bg, ms: null }, // null = sticky
  warning: { bg: statusStyles.Active.bg, ms: 10_000 },
  good: { bg: statusStyles.Resolved.bg, ms: 6_000 },
  info: { bg: colors.primary, ms: 6_000 },
};

/** Shows the oldest pending notice. */
export function NotificationBanner() {
  const { notices, dismiss, prefs } = useNotify();
  const { play } = useAlertFeedback();
  const insets = useSafeAreaInsets();
  const n = notices[0];

  // Sound / vibration + auto-hide, once per notice.
  useEffect(() => {
    if (!n) return;
    const info = CATEGORY_INFO[n.category];
    const p = prefs[n.category];
    const sound = info.locked || p.sound;
    const vibrate = info.locked || p.vibrate;
    if (sound || vibrate) play({ sound, vibrate });
    const ms = TONE[info.tone].ms;
    if (ms === null) return;
    const t = setTimeout(() => dismiss(n.id), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n?.id]);

  if (!n) return null;
  const info = CATEGORY_INFO[n.category];
  const tone = TONE[info.tone];
  const urgent = info.tone === 'critical';

  /** Tap: go where the notice points (e.g. the person's zones or the alert) and close it. */
  const open = () => {
    dismiss(n.id);
    if (n.href) router.push(n.href as never);
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + space.sm }]}>
      {/* Drops in from the top; key = notice id so every new notice animates in again. */}
      <FadeIn key={n.id} from={-24} style={styles.full}>
      <Pressable
        onPress={open}
        accessibilityRole="alert"
        accessibilityLiveRegion={urgent ? 'assertive' : 'polite'}
        accessibilityLabel={`${info.label}. ${n.title}. ${n.body ?? ''}${n.href ? ' Tap to open.' : ''}`}
        style={[styles.toast, { backgroundColor: tone.bg }]}>
        <Ionicons name={info.icon as IconName} size={26} color={colors.white} />
        <View style={styles.flex}>
          <AppText variant="label" color="rgba(255,255,255,0.9)">
            {info.label.toUpperCase()}
          </AppText>
          <AppText variant="bodyBold" color={colors.white}>
            {n.title}
          </AppText>
          <AppText variant="small" color="rgba(255,255,255,0.92)">
            {clock(n.at)}
            {n.body ? ` · ${n.body}` : ''}
            {notices.length > 1 ? ` · +${notices.length - 1} more` : ''}
          </AppText>
          {n.sample ? (
            <View style={styles.tagRow}>
              <SimulatedTag text="SAMPLE" />
            </View>
          ) : null}
        </View>
        <Pressable onPress={() => dismiss(n.id)} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={10} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.white} />
        </Pressable>
      </Pressable>
      </FadeIn>
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
  full: { width: '100%', alignItems: 'center' },
  tagRow: { flexDirection: 'row', marginTop: 2 },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
