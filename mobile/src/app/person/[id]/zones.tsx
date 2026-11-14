/**
 * app/person/[id]/zones.tsx — SAFE ZONES for one person: map of all zones, where they are now,
 * each zone's rules, add buttons (home / school / grandparents), and SAMPLE walks to demo the geofence.
 * Owner: Person 3/4 (Fahim, Zuhayr). Data + rules: src/data/zones.tsx.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ZoneMap } from '@/components/ZoneMap';
import { AppText, Button, Card, EmptyState, Screen, SectionTitle, SimulatedTag } from '@/components/ui';
import { MOCK_HOME } from '@/data/mock';
import { usePeople } from '@/data/people';
import { SafeZone, useZones, ZONE_TYPES, ZoneType } from '@/data/zones';
import { colors, radius, shadow, space, statusStyles, TOUCH } from '@/theme';

/** Zones list screen. */
export default function Zones() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { get } = usePeople();
  const { zonesOf, status } = useZones();
  const p = get(id);

  if (!p) {
    return (
      <Screen edges={['bottom']}>
        {/* Sample stores stay sample even when Supabase authentication is live. */}
        <SimulatedTag text="SAMPLE DATA" />
        <AppText variant="small" color={colors.textMuted}>Sample screen: not connected to the band yet.</AppText>
        <EmptyState icon="help-circle" title="Person not found" />
      </Screen>
    );
  }

  const zones = zonesOf(p.id);
  const st = status(p.id);
  const focus = zones[0]?.center ?? MOCK_HOME;
  const hasType = (t: ZoneType) => zones.some((z) => z.type === t);

  /** Opens the editor for a new zone of this type. */
  const add = (type: ZoneType) => router.push({ pathname: '/person/[id]/zone-edit', params: { id: p.id, type } });

  return (
    <Screen edges={['bottom']}>
      {/* Sample stores stay sample even when Supabase authentication is live. */}
      <SimulatedTag text="SAMPLE DATA" />
      <AppText variant="small" color={colors.textMuted}>Sample screen: not connected to the band yet.</AppText>
      <View style={styles.statusCard}>
        <Ionicons
          name={st.inside.length ? 'shield-checkmark' : st.pos ? 'walk' : 'help-circle'}
          size={28}
          color={st.inside.length ? statusStyles.Resolved.bg : st.pos ? statusStyles.Active.bg : colors.textMuted}
        />
        <View style={styles.flex}>
          <AppText variant="bodyBold">
            {st.inside.length ? `Inside: ${st.inside.map((z) => z.name).join(', ')}` : st.pos ? 'Outside all safe zones' : 'Position not known yet'}
          </AppText>
          <AppText variant="small" color={colors.textMuted}>
            {p.name} · {zones.length} safe zone{zones.length === 1 ? '' : 's'}
          </AppText>
        </View>
        <SimulatedTag text="SAMPLE" />
      </View>

      <ZoneMap zones={zones.map((z) => ({ id: z.id, center: z.center, radius: z.radius, label: z.name }))} focus={focus} person={st.pos} height={280} span={0.02} />

      <SectionTitle>Safe zones</SectionTitle>
      {zones.length === 0 ? (
        <EmptyState icon="map" title="No safe zones yet" body="Start with Home. You'll get a notification when they leave or arrive." />
      ) : (
        zones.map((z) => <ZoneCard key={z.id} zone={z} />)
      )}

      <SectionTitle>Add a safe zone</SectionTitle>
      <View style={styles.addGrid}>
        {(Object.keys(ZONE_TYPES) as ZoneType[]).map((t) => {
          const info = ZONE_TYPES[t];
          const disabled = !!info.tbd || (t === 'home' && hasType('home'));
          return (
            <Pressable
              key={t}
              onPress={() => add(t)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled }}
              accessibilityLabel={`Add ${info.label}${info.tbd ? ' (not available yet)' : ''}`}
              style={({ pressed }) => [styles.addBtn, disabled && styles.disabled, pressed && styles.pressed]}>
              <Ionicons name={info.icon} size={24} color={disabled ? colors.textMuted : colors.link} />
              <AppText variant="smallBold" style={styles.center}>
                {info.label}
              </AppText>
              {info.tbd ? (
                <AppText variant="label" color={colors.textMuted}>
                  NEEDS TEAM OK
                </AppText>
              ) : t === 'home' && hasType('home') ? (
                <AppText variant="label" color={colors.textMuted}>
                  ADDED
                </AppText>
              ) : info.simulated ? (
                <SimulatedTag text="SIMULATION" />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

/** One zone card: rules at a glance; tap to edit. */
function ZoneCard({ zone: z }: { zone: SafeZone }) {
  const info = ZONE_TYPES[z.type];
  const rules: { icon: 'enter' | 'exit' | 'alert-circle' | 'time' | 'alarm'; text: string; on: boolean }[] = [
    { icon: 'enter', text: 'Arrival', on: z.notifyArrival },
    { icon: 'exit', text: 'Departure', on: z.notifyDeparture },
    { icon: 'alert-circle', text: 'Exit alert', on: z.unexpectedExit },
  ];
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/person/[id]/zone-edit', params: { id: z.personId, zoneId: z.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${z.name}, radius ${z.radius} metres. Edit`}
      style={({ pressed }) => [styles.zoneCard, pressed && styles.pressed]}>
      <View style={styles.row}>
        <View style={styles.zoneIcon}>
          <Ionicons name={info.icon} size={22} color={colors.link} />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyBold">{z.name}</AppText>
          <AppText variant="small" color={colors.textMuted}>
            {info.label} · radius {z.radius} m
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
      <View style={styles.chips}>
        {rules.map((r) => (
          <View key={r.text} style={[styles.rule, !r.on && styles.ruleOff]}>
            <Ionicons name={r.on ? r.icon : 'close'} size={13} color={r.on ? colors.link : colors.textMuted} />
            <AppText variant="label" color={r.on ? colors.link : colors.textMuted}>
              {r.text.toUpperCase()}
            </AppText>
          </View>
        ))}
      </View>
      {z.allowedDeparture || z.expectedArrival ? (
        <AppText variant="small" color={colors.textMuted}>
          {z.allowedDeparture ? `May leave ${z.allowedDeparture.from}–${z.allowedDeparture.to}` : ''}
          {z.allowedDeparture && z.expectedArrival ? ' · ' : ''}
          {z.expectedArrival ? `Expected by ${z.expectedArrival}` : ''}
        </AppText>
      ) : z.unexpectedExit ? (
        <AppText variant="small" color={colors.textMuted}>
          Any exit raises an alert
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  gapSm: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    marginTop: space.sm,
    ...shadow,
  },
  zoneCard: { gap: space.sm, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.card, ...shadow },
  zoneIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  ruleOff: { backgroundColor: colors.muted },
  addGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  addBtn: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: TOUCH + 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.8 },
  tools: { gap: space.sm, borderWidth: 2, borderColor: colors.simulated, borderStyle: 'dashed' },
  chip: { minHeight: TOUCH - 8, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.simulated, borderColor: colors.simulated },
});
