/**
 * app/(tabs)/index.tsx — HOME: the one screen a caregiver checks. "Is she OK right now?"
 * Owner: Person 3/4 (Fahim, Zuhayr).
 * Order: connection strip → person status → open alert → location (only during an incident) → band → demo buttons.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AlertCard } from '@/components/AlertCard';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { DemoControls } from '@/components/DemoControls';
import { LocationCard } from '@/components/LocationCard';
import { PersonHero } from '@/components/PersonHero';
import { AppText, Button, Card, Screen, SectionTitle } from '@/components/ui';
import { isOpen, useLakaz } from '@/data/store';
import { isOnline } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors, space, statusStyles } from '@/theme';

/** Home screen. */
export default function Home() {
  const { status, alerts, device, loading } = useLakaz();
  const now = useNow();
  const open = alerts.filter(isOpen);
  const main = open[0];
  const online = isOnline(device, now);

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title">Good day</AppText>
        <AppText color={colors.textMuted}>Here is how Marie-Claire is doing.</AppText>
      </View>

      <ConnectionBanner />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
          <AppText color={colors.textMuted}>Loading latest status…</AppText>
        </View>
      ) : (
        <>
          <PersonHero status={status} />

          {/* Shortcut to the checkpoint flow agreed with the backend: help alert + acknowledge. */}
          <Button label="Help alerts (sample)" icon="megaphone" tone="secondary" onPress={() => router.push('/help-alert')} />

          {main ? (
            <>
              <SectionTitle>{open.length > 1 ? `Open alerts (${open.length})` : 'Open alert'}</SectionTitle>
              {open.map((a) => (
                <AlertCard key={a.alert_id} alert={a} />
              ))}
              <LocationCard alert={main} />
            </>
          ) : (
            <Card style={styles.calm}>
              <Ionicons name="shield-checkmark" size={28} color={statusStyles.Resolved.bg} />
              <View style={styles.flex}>
                <AppText variant="bodyBold">All calm</AppText>
                {/* Privacy promise (D10): location is only visible during an incident. */}
                <AppText variant="small" color={colors.textMuted}>
                  Location stays private while she is home. GPS is off to save battery.
                </AppText>
              </View>
            </Card>
          )}

          <SectionTitle>Band</SectionTitle>
          <Card style={styles.bandRow}>
            <Ionicons name="watch" size={26} color={online ? statusStyles.Resolved.bg : colors.offline} />
            <View style={styles.flex}>
              <AppText variant="bodyBold">{online ? 'Band online' : 'Band offline'}</AppText>
            </View>
            <AppText variant="smallBold" color={colors.primary} onPress={() => router.push('/device')}>
              Details
            </AppText>
          </Card>

          <DemoControls />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2, marginTop: space.sm },
  loading: { alignItems: 'center', gap: space.md, paddingVertical: space.xxxl },
  calm: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  bandRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
});
