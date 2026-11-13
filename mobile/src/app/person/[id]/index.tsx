/**
 * app/person/[id]/index.tsx — PERSON PAGE: profile, device connection, location link, emergency contact,
 * medical & safety notes, guardians, edit / remove.
 * Owner: Person 3/4 (Zuhayr). SAMPLE data.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FormError } from '@/components/forms';
import { Avatar, DeviceConnection, ProfileChip } from '@/components/person';
import { AppText, Button, Card, EmptyState, InfoRow, Screen, SectionTitle } from '@/components/ui';
import { usePeople } from '@/data/people';
import { useTracking } from '@/data/tracking';
import { useZones } from '@/data/zones';
import { colors, space, TOUCH } from '@/theme';

/** Person detail screen. */
export default function PersonPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { get, removePerson } = usePeople();
  const tracking = useTracking();
  const p = get(id);
  const trackingOn = !!tracking.get(id).session;
  const zones = useZones();
  const [showMedical, setShowMedical] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!p) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon="help-circle" title="Person not found" body="They may have been removed." />
      </Screen>
    );
  }

  const hasMedical = Object.values(p.medical).some((v) => v.trim());
  const primary = p.guardians.find((g) => g.role === 'primary');

  /** Two-step remove: first tap asks, second tap removes. Why: removing someone stops their alerts. */
  const onRemove = async () => {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await removePerson(p.id);
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <View style={styles.head}>
        <Avatar name={p.name} color={p.avatarColor} size={72} />
        <View style={[styles.flex, styles.gapSm]}>
          <AppText variant="title">{p.name}</AppText>
          <AppText color={colors.textMuted}>{p.age} years old</AppText>
          <ProfileChip profile={p.profile} />
        </View>
      </View>
      <Button label="Edit details" icon="create" tone="secondary" onPress={() => router.push({ pathname: '/person/[id]/edit', params: { id: p.id } })} />

      <SectionTitle>Device connection</SectionTitle>
      <DeviceConnection person={p} />

      {/* Section C: live tracking / last known location (privacy rules in src/data/tracking.tsx). */}
      <SectionTitle>Location</SectionTitle>
      <Button
        label={trackingOn ? 'Live tracking is ON — open' : 'Location & live tracking'}
        icon={trackingOn ? 'radio' : 'location'}
        tone={trackingOn ? 'primary' : 'secondary'}
        onPress={() => router.push({ pathname: '/person/[id]/location', params: { id: p.id } })}
      />
      {/* Section D: safe zones & geofencing. */}
      <Button
        label={`Safe zones (${zones.zonesOf(p.id).length})`}
        icon="map"
        tone="secondary"
        onPress={() => router.push({ pathname: '/person/[id]/zones', params: { id: p.id } })}
      />

      <SectionTitle>Emergency contact</SectionTitle>
      <Card>
        <InfoRow icon="person" label="Name" value={p.emergency.name || '—'} />
        <InfoRow icon="call" label="Phone" value={p.emergency.phone || '—'} />
        <InfoRow icon="heart" label="Relationship" value={p.emergency.relationship || '—'} last />
      </Card>

      <SectionTitle>Medical & safety notes</SectionTitle>
      <Card style={styles.gapSm}>
        {!hasMedical ? (
          <AppText color={colors.textMuted}>Nothing added.</AppText>
        ) : showMedical ? (
          <>
            <InfoRow icon="medkit" label="Conditions" value={p.medical.conditions || '—'} />
            <InfoRow icon="alert-circle" label="Allergies" value={p.medical.allergies || '—'} />
            <InfoRow icon="bandage" label="Medication" value={p.medical.medications || '—'} />
            <InfoRow icon="chatbubbles" label="How to help" value={p.medical.notes || '—'} last />
            <Button label="Hide" icon="eye-off" tone="ghost" onPress={() => setShowMedical(false)} />
          </>
        ) : (
          // Hidden by default so it isn't on screen when the phone is shown to someone else.
          <Button label="Show medical notes" icon="eye" tone="secondary" onPress={() => setShowMedical(true)} />
        )}
        <View style={styles.lockRow}>
          <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
          <AppText variant="small" color={colors.textMuted}>
            Guardians only · never shown to responders
          </AppText>
        </View>
      </Card>

      <SectionTitle>Guardians & caregivers</SectionTitle>
      <Pressable
        onPress={() => router.push({ pathname: '/person/[id]/guardians', params: { id: p.id } })}
        accessibilityRole="button"
        style={({ pressed }) => [styles.guardRow, pressed && styles.pressed]}>
        <Ionicons name="people" size={24} color={colors.link} />
        <View style={styles.flex}>
          <AppText variant="bodyBold">
            {p.guardians.length} {p.guardians.length === 1 ? 'person' : 'people'}
          </AppText>
          <AppText variant="small" color={colors.textMuted}>
            Primary: {primary ? `${primary.name} (${primary.relationship})` : 'none — set one!'}
          </AppText>
        </View>
        <AppText variant="smallBold" color={colors.link}>
          Manage
        </AppText>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Pressable>

      <FormError message={error} />
      <Button
        label={confirm ? `Yes, remove ${p.name}` : 'Remove this person'}
        icon="trash"
        tone={confirm ? 'danger' : 'ghost'}
        loading={busy}
        onPress={onRemove}
        accessibilityHint="They will stop getting LAKAZ protection on this account"
      />
      {confirm ? <Button label="Cancel" tone="ghost" onPress={() => setConfirm(false)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.sm },
  flex: { flex: 1 },
  gapSm: { gap: space.sm },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  guardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    minHeight: TOUCH + 16,
    backgroundColor: colors.card,
    borderRadius: 16,
  },
  pressed: { opacity: 0.8 },
});
