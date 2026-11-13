/**
 * PersonHero.tsx — the top of Home: who, where (home / left home), since when. "Night glow" design.
 * Owner: Person 3/4 (Zuhayr).
 *
 * A status card (Zuhayr asked to keep the "rectangle" from the earlier design): avatar tile, status label,
 * age · area, then ONE huge word for where she is ("At home" / "Left home") with a pill for how long.
 * The card is tinted and outlined in the status colour, so the answer is readable from across a room.
 * Colour code (theme.ts): GREEN = safe at home, AMBER = left home (ladder climbing), RED = critical
 * (step 3), GREY = unknown. Motion: the avatar "breathes" while she is safe; rings pulse while she is out.
 * All words come from i18n.ts, so the card follows the language chosen in Profile.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Breathe, PulseRings } from '@/components/motion';
import { AppText, IconName } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { MOCK_PERSON } from '@/data/mock';
import { fill } from '@/i18n';
import { homeStatusWords, timeAgo } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors, radius, space, TOUCH } from '@/theme';
import type { DeviceStatus } from '@/types';

/** Input: device status from GET /api/devices/:id/status or `status:update`. */
export function PersonHero({ status }: { status: DeviceStatus | null }) {
  const now = useNow();
  const { t } = useAuth();
  const words = homeStatusWords(status?.status);
  const name = status?.person_name ?? MOCK_PERSON.name;
  const first = name.split(' ')[0];

  // Same rule as the alert itself (statusStyles): Active = amber while the ladder climbs,
  // Critical = red at step 3 (community). Keeps Home and the takeover in agreement.
  const since = status ? timeAgo(status.since, now).replace(' ago', '') : '';
  const out = words.tone === 'alert';
  const critical = out && (status?.level ?? 0) >= 3;
  const tone =
    words.tone === 'calm'
      ? { fg: colors.safe, soft: colors.safeSoft, label: t('heroLabelSafe'), big: t('heroAtHome'), pill: fill(t('heroSafeFor'), { t: since }), icon: 'home' as IconName }
      : out
        ? {
            fg: critical ? colors.danger : colors.warning,
            soft: critical ? colors.dangerSoft : colors.warningSoft,
            label: t(critical ? 'heroLabelCritical' : 'heroLabelOut'),
            big: t('heroLeftHome'),
            pill: fill(t('heroOutFor'), { t: since }),
            icon: 'walk' as IconName,
          }
        : { fg: colors.offline, soft: colors.muted, label: t('heroLabelUnknown'), big: t('heroWaiting'), pill: t('heroNoStatus'), icon: 'help-circle' as IconName };

  const sub =
    words.tone === 'calm'
      ? t('heroSubSafe')
      : out
        ? `${status?.level != null ? fill(t('heroStep'), { n: status.level }) + ' ' : ''}${t('heroSubOut')}`
        : fill(t('heroSubWaiting'), { name: first });

  return (
    <View style={styles.wrap}>
      {/* Brand line + two shortcuts above the card. */}
      <View style={styles.top}>
        <AppText variant="heading" color={colors.text}>
          LAKAZ
        </AppText>
        <View style={styles.icons}>
          <IconLink icon="notifications-outline" label="Notification settings" to="/notifications" />
          <IconLink icon="grid-outline" label="People" to="/people" />
        </View>
      </View>

      <View
        style={[styles.card, { backgroundColor: tone.soft, borderColor: tone.fg }]}
        accessibilityLabel={`${name}: ${tone.big}. ${tone.pill}. ${sub}`}
        accessibilityLiveRegion="polite">
        <View style={styles.cardTop}>
          {/* Initials avatar tile — never a real photo in the demo (fictional person). */}
          <View style={styles.avatarWrap}>
            {out ? <PulseRings color={tone.fg} size={56} /> : null}
            <Breathe active={words.tone === 'calm'}>
              <View style={styles.avatar}>
                <AppText variant="heading" color={colors.white}>
                  MC
                </AppText>
              </View>
            </Breathe>
          </View>
          <View style={styles.flex}>
            <View style={styles.labelRow}>
              <Ionicons name={tone.icon} size={16} color={tone.fg} />
              <AppText variant="label" color={tone.fg === colors.offline ? colors.textMuted : colors.text}>
                {tone.label}
              </AppText>
            </View>
            <AppText variant="small" color={colors.textMuted}>
              {name}, {MOCK_PERSON.age} · {MOCK_PERSON.area}
            </AppText>
          </View>
        </View>

        <View style={styles.bigRow}>
          {/* No truncation: in French/Kreol the word is longer, so the pill wraps under it instead. */}
          <AppText variant="display" style={styles.bigWord}>
            {tone.big}
          </AppText>
          <View style={[styles.pill, { backgroundColor: tone.fg }]}>
            <Ionicons name={words.tone === 'calm' ? 'checkmark' : tone.icon} size={14} color={colors.white} />
            <AppText variant="smallBold" color={colors.white}>
              {tone.pill}
            </AppText>
          </View>
        </View>
        <AppText variant="small" color={colors.textMuted}>
          {sub}
        </AppText>
      </View>
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
  wrap: { gap: space.sm },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  icons: { flexDirection: 'row', gap: space.xs },
  iconBtn: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radius.xl, borderWidth: 1.5, padding: space.xl, gap: space.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginBottom: space.sm },
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
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  bigRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.md, rowGap: space.xs },
  bigWord: { flexShrink: 1 },
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
