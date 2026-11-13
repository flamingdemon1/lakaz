/**
 * PersonHero.tsx — the big status card at the top of Home: who, where (home / left home), since when.
 * Owner: Person 3/4 (Zuhayr).
 * Calm teal when at home, amber/red when not — the caregiver should understand it in one glance.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { MOCK_PERSON } from '@/data/mock';
import { homeStatusWords, timeAgo } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors, radius, space, statusStyles } from '@/theme';
import type { DeviceStatus } from '@/types';

/** Input: device status from GET /api/devices/:id/status or `status:update`. */
export function PersonHero({ status }: { status: DeviceStatus | null }) {
  const now = useNow();
  const words = homeStatusWords(status?.status);
  const bg =
    words.tone === 'calm'
      ? colors.primary
      : words.tone === 'alert'
        ? status?.level === 3
          ? statusStyles.Critical.bg
          : statusStyles.Active.bg
        : colors.offline;

  return (
    <View style={[styles.hero, { backgroundColor: bg }]} accessibilityLabel={`${MOCK_PERSON.name} is ${words.title}`}>
      <View style={styles.top}>
        {/* Initials avatar — we never use a real photo in the demo (fictional person). */}
        <View style={styles.avatar}>
          <AppText variant="title" color={bg}>
            MC
          </AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="title" color={colors.white}>
            {status?.person_name ?? MOCK_PERSON.name}
          </AppText>
          <AppText color="rgba(255,255,255,0.9)">
            {MOCK_PERSON.age} · {MOCK_PERSON.area} · {MOCK_PERSON.profile}
          </AppText>
        </View>
      </View>
      <View style={styles.statusRow}>
        <Ionicons name={words.tone === 'calm' ? 'home' : 'walk'} size={30} color={colors.white} />
        <View style={styles.flex}>
          <AppText variant="hero" color={colors.white}>
            {words.title}
          </AppText>
          <AppText color="rgba(255,255,255,0.9)">
            {status ? `since ${timeAgo(status.since, now).replace(' ago', '')}` : 'Waiting for status…'}
            {status?.level != null && words.tone !== 'calm' ? ` · escalation level ${status.level}` : ''}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: space.xl, gap: space.xl },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
});
