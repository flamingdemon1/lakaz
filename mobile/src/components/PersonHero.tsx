/**
 * PersonHero.tsx — the big status card at the top of Home: who, where (home / left home), since when.
 * Owner: Person 3/4 (Zuhayr).
 *
 * Reads like a sentence ("Marie-Claire is at home.") instead of a dashboard label, so a stressed or
 * older caregiver understands it in one glance. Colour code (theme.ts): GREEN = safe at home,
 * AMBER = left home (ladder climbing), RED = critical (step 3), GREY = unknown.
 * Motion: the avatar "breathes" slowly while she is safe; radar rings (amber/red) pulse while she is out;
 * the card colour blends from green to red instead of jumping.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Breathe, PulseRings, useColorTransition } from '@/components/motion';
import { AppText } from '@/components/ui';
import { MOCK_PERSON } from '@/data/mock';
import { homeStatusWords, timeAgo } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors, radius, space } from '@/theme';
import type { DeviceStatus } from '@/types';

/** Input: device status from GET /api/devices/:id/status or `status:update`. */
export function PersonHero({ status }: { status: DeviceStatus | null }) {
  const now = useNow();
  const words = homeStatusWords(status?.status);
  const name = status?.person_name ?? MOCK_PERSON.name;
  const first = name.split(' ')[0];

  // Same rule as the alert itself (statusStyles): Active = amber while the ladder climbs,
  // Critical = red at step 3 (community). Keeps Home, the takeover and the admin page in agreement.
  const tone =
    words.tone === 'calm'
      ? { fg: colors.safe, soft: colors.safeSoft, label: 'SAFE AT HOME', icon: 'home' as const }
      : words.tone === 'alert'
        ? (status?.level ?? 0) >= 3
          ? { fg: colors.danger, soft: colors.dangerSoft, label: 'LEFT HOME · CRITICAL', icon: 'walk' as const }
          : { fg: colors.warning, soft: colors.warningSoft, label: 'LEFT HOME', icon: 'walk' as const }
        : { fg: colors.offline, soft: colors.muted, label: 'NO STATUS YET', icon: 'help-circle' as const };

  const bg = useColorTransition(tone.soft);
  const border = useColorTransition(tone.fg);

  const since = status ? timeAgo(status.since, now).replace(' ago', '') : null;
  const sentence =
    words.tone === 'calm' ? `${first} is at home.` : words.tone === 'alert' ? `${first} has left home.` : `Waiting to hear from ${first}'s band.`;
  const sub =
    words.tone === 'calm'
      ? `Safe for ${since ?? '—'}. Nothing needs you right now.`
      : words.tone === 'alert'
        ? `Out for ${since ?? '—'}${status?.level != null ? ` · escalation step ${status.level}` : ''}. Open the alert below.`
        : 'Status will appear as soon as the band checks in.';

  return (
    <Animated.View
      style={[styles.hero, { backgroundColor: bg, borderColor: border }]}
      accessibilityLabel={`${sentence} ${sub}`}
      accessibilityLiveRegion="polite">
      <View style={styles.top}>
        {/* Initials avatar — we never use a real photo in the demo (fictional person). */}
        <View style={styles.avatarWrap}>
          {words.tone === 'alert' ? <PulseRings color={tone.fg} size={64} /> : null}
          <Breathe active={words.tone === 'calm'}>
            <View style={[styles.avatar, { backgroundColor: tone.fg }]}>
              <AppText variant="title" color={colors.white}>
                MC
              </AppText>
            </View>
          </Breathe>
        </View>
        <View style={styles.flex}>
          <View style={styles.labelRow}>
            <Ionicons name={tone.icon} size={16} color={tone.fg} />
            <AppText variant="label" color={tone.fg}>
              {tone.label}
            </AppText>
          </View>
          <AppText variant="small" color={colors.textMuted}>
            {MOCK_PERSON.age} · {MOCK_PERSON.area}
          </AppText>
        </View>
      </View>
      <AppText variant="hero" style={styles.sentence}>
        {sentence}
      </AppText>
      <AppText color={colors.textMuted}>{sub}</AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: space.xl, gap: space.sm, borderWidth: 1.5 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginBottom: space.sm },
  avatarWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  sentence: { fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  flex: { flex: 1 },
});
