/**
 * PersonHero.tsx — the top of Home: who, where (home / left home), since when. "Night glow" design.
 * Owner: Person 3/4 (Zuhayr).
 *
 * Layout (like a banking app's "Balance" block): avatar tile + shortcuts, a small name line, then ONE huge
 * word for where she is ("At home" / "Left home") with a status pill beside it. A stressed or older
 * caregiver gets the answer from the biggest text on the screen.
 * Colour code (theme.ts): GREEN = safe at home, AMBER = left home (ladder climbing), RED = critical
 * (step 3), GREY = unknown. Motion: the avatar "breathes" while she is safe; rings pulse while she is out.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Breathe, PulseRings } from '@/components/motion';
import { AppText, IconName } from '@/components/ui';
import { MOCK_PERSON } from '@/data/mock';
import { homeStatusWords, timeAgo } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors, radius, space, TOUCH } from '@/theme';
import type { DeviceStatus } from '@/types';

/** Input: device status from GET /api/devices/:id/status or `status:update`. */
export function PersonHero({ status }: { status: DeviceStatus | null }) {
  const now = useNow();
  const words = homeStatusWords(status?.status);
  const name = status?.person_name ?? MOCK_PERSON.name;
  const first = name.split(' ')[0];

  // Same rule as the alert itself (statusStyles): Active = amber while the ladder climbs,
  // Critical = red at step 3 (community). Keeps Home and the takeover in agreement.
  const since = status ? timeAgo(status.since, now).replace(' ago', '') : null;
  const tone =
    words.tone === 'calm'
      ? { fg: colors.safe, big: 'At home', pill: `Safe ${since ?? ''}`.trim(), icon: 'checkmark' as IconName }
      : words.tone === 'alert'
        ? (status?.level ?? 0) >= 3
          ? { fg: colors.danger, big: 'Left home', pill: `Out ${since ?? ''}`.trim(), icon: 'alert' as IconName }
          : { fg: colors.warning, big: 'Left home', pill: `Out ${since ?? ''}`.trim(), icon: 'walk' as IconName }
        : { fg: colors.offline, big: 'Waiting…', pill: 'No status', icon: 'help' as IconName };

  const sub =
    words.tone === 'calm'
      ? 'Nothing needs you right now.'
      : words.tone === 'alert'
        ? `${status?.level != null ? `Escalation step ${status.level}. ` : ''}Open the alert below.`
        : `Status appears as soon as ${first}'s band checks in.`;

  return (
    <View style={styles.wrap} accessibilityLabel={`${first}: ${tone.big}. ${tone.pill}. ${sub}`} accessibilityLiveRegion="polite">
      <View style={styles.top}>
        {/* Initials avatar tile — never a real photo in the demo (fictional person). */}
        <View style={styles.avatarWrap}>
          {words.tone === 'alert' ? <PulseRings color={tone.fg} size={56} /> : null}
          <Breathe active={words.tone === 'calm'}>
            <View style={styles.avatar}>
              <AppText variant="heading" color={colors.white}>
                MC
              </AppText>
            </View>
          </Breathe>
        </View>
        <View style={styles.icons}>
          <IconLink icon="notifications-outline" label="Notification settings" to="/notifications" />
          <IconLink icon="grid-outline" label="People" to="/people" />
        </View>
      </View>

      <AppText color={colors.textMuted}>
        {name}, {MOCK_PERSON.age} · {MOCK_PERSON.area}
      </AppText>
      <View style={styles.bigRow}>
        <AppText variant="display" style={styles.flex} numberOfLines={1} adjustsFontSizeToFit>
          {tone.big}
        </AppText>
        <View style={[styles.pill, { backgroundColor: tone.fg }]}>
          <Ionicons name={tone.icon} size={14} color={colors.white} />
          <AppText variant="smallBold" color={colors.white}>
            {tone.pill}
          </AppText>
        </View>
      </View>
      <AppText variant="small" color={colors.textMuted}>
        {sub}
      </AppText>
    </View>
  );
}

/** A plain icon button in the top-right corner (48 px touch target for older hands). */
function IconLink({ icon, label, to }: { icon: IconName; label: string; to: '/notifications' | '/people' }) {
  return (
    <Pressable onPress={() => router.push(to)} accessibilityRole="button" accessibilityLabel={label} hitSlop={4} style={styles.iconBtn}>
      <Ionicons name={icon} size={24} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  avatarWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    // Brand gradient tile (React Native 0.88 draws CSS gradients natively; solid primary is the fallback).
    backgroundImage: 'linear-gradient(135deg, #3D63FF 0%, #8B5CF6 100%)',
  } as object,
  icons: { flexDirection: 'row', gap: space.xs },
  iconBtn: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  bigRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  flex: { flex: 1 },
});
