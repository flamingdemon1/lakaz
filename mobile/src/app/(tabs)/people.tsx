/**
 * app/(tabs)/people.tsx — PEOPLE I CARE FOR: everyone registered under this account.
 * Owner: Person 3/4 (Fahim, Zuhayr). SAMPLE data (src/data/people.tsx).
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, ProfileChip } from '@/components/person';
import { AppText, Button, EmptyState, Screen, SimulatedTag } from '@/components/ui';
import { USE_MOCK } from '@/config';
import { useAuth } from '@/data/auth';
import { Band, fetchBands } from '@/data/bands';
import { usePeople } from '@/data/people';
import { usePolling } from '@/lib/usePolling';
import { isOnline } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors, radius, shadow, space, statusStyles, TOUCH } from '@/theme';

/** People tab: one card per person, plus "Add a person". Live mode shows the real people (band wearers). */
export default function People() {
  if (!USE_MOCK) return <LivePeople />;
  return <SamplePeople />;
}

/**
 * LIVE: a person = the wearer of a band linked to this carer (public.devices, RLS: linked bands only).
 * Tapping opens Home, which shows that person's live status and alerts.
 */
function LivePeople() {
  const { t } = useAuth();
  const [bands, setBands] = useState<Band[] | null>(null);
  // Re-read every 5 s so a person added on another phone (or just now) appears without a reload.
  usePolling(() => {
    fetchBands()
      .then((rows) => setBands(rows))
      .catch(() => setBands((b) => b ?? []));
  }, 5000);
  const people = (bands ?? []).filter((b) => b.wearer_name);

  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header" style={styles.title}>
        {t('peopleTitle')}
      </AppText>
      {bands === null ? null : people.length === 0 ? (
        <EmptyState icon="people" title={t('noPeopleTitle')} body={t('noPeopleBody')} />
      ) : (
        people.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => router.push('/')}
            accessibilityRole="button"
            accessibilityLabel={`${b.wearer_name}${b.wearer_age != null ? `, ${b.wearer_age}` : ''}. ${b.label ?? ''}`}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <Avatar name={b.wearer_name as string} color={colors.primary} />
            <View style={[styles.flex, styles.gap]}>
              <AppText variant="heading">
                {b.wearer_name}
                {b.wearer_age != null ? `, ${b.wearer_age}` : ''}
              </AppText>
              {b.wearer_area ? (
                <AppText variant="small" color={colors.textMuted}>
                  {b.wearer_area}
                </AppText>
              ) : null}
              <View style={styles.devRow}>
                <Ionicons name="watch" size={14} color={colors.link} />
                <AppText variant="small" color={colors.textMuted}>
                  {b.label ?? t('bandTitle')} · …{b.id.slice(-4)}
                </AppText>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
          </Pressable>
        ))
      )}
      <Button label={t('addPerson')} icon="person-add" size="lg" onPress={() => router.push('/person/new')} />
    </Screen>
  );
}

/** SAMPLE mode (no Supabase configured): the in-memory sample people, clearly tagged. */
function SamplePeople() {
  const { people, deviceOf } = usePeople();
  const now = useNow(5000);

  return (
    <Screen>
      {/* Sample stores stay sample even when Supabase authentication is live. */}
      <SimulatedTag text="SAMPLE DATA" />
      <AppText variant="small" color={colors.textMuted}>Sample screen: not connected to the band yet.</AppText>
      <View style={styles.title}>
        <AppText variant="title" accessibilityRole="header" style={styles.flex}>
          People I care for
        </AppText>
        <SimulatedTag text="SAMPLE" />
      </View>

      {people.length === 0 ? (
        <EmptyState icon="people" title="No one added yet" body="Add the person you look after to start." />
      ) : (
        people.map((p) => {
          const d = deviceOf(p);
          const online = d ? isOnline({ device_id: d.device_id, battery_pct: d.battery_pct, last_seen: d.last_seen, gps_fix: null }, now) : false;
          return (
            <Pressable
              key={p.id}
              onPress={() => router.push({ pathname: '/person/[id]', params: { id: p.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${p.name}, ${p.age}. ${d ? (online ? 'Band online' : 'Band offline') : 'No band'}. Open`}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <Avatar name={p.name} color={p.avatarColor} />
              <View style={[styles.flex, styles.gap]}>
                <AppText variant="heading">
                  {p.name}, {p.age}
                </AppText>
                <ProfileChip profile={p.profile} />
                <View style={styles.devRow}>
                  <View style={[styles.dot, { backgroundColor: d ? (online ? colors.primary : colors.offline) : colors.border }]} />
                  <AppText variant="small" color={colors.textMuted}>
                    {d ? `${d.device_id} · ${online ? 'online' : 'offline'}` : 'No band assigned'}
                  </AppText>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
            </Pressable>
          );
        })
      )}

      <Button label="Add a person" icon="person-add" size="lg" onPress={() => router.push('/person/new')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm },
  flex: { flex: 1 },
  gap: { gap: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    minHeight: TOUCH + 40,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    ...shadow,
  },
  pressed: { opacity: 0.85 },
  devRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
