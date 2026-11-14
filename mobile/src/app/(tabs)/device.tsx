/**
 * app/(tabs)/device.tsx — band status: online/offline and GPS state.
 * Owner: Person 3 (Fahim, Zuhayr).
 * Bluetooth + cellular status are TBD in scope (section 4), so they are NOT shown.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, InfoRow, Screen, SectionTitle, SimulatedTag } from '@/components/ui';
import { USE_MOCK } from '@/config';
import { useBand } from '@/data/bands';
import { MOCK_PERSON } from '@/data/mock';
import { isOpen, useLakaz } from '@/data/store';
import { homeStatusWords, isOnline } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors, space, statusStyles } from '@/theme';

/** Band tab. */
export default function DeviceScreen() {
  // Live: the band and wearer from the backend; sample: the mock person.
  const { band } = useBand();
  const { device, status, alerts } = useLakaz();
  const now = useNow();
  const online = isOnline(device, now);
  const atHome = homeStatusWords(status?.status).tone === 'calm';
  const incident = alerts.some(isOpen);

  // GPS wording follows the core idea: GPS sleeps at home, wakes only when she leaves.
  const gps = atHome && !incident ? 'Idle (at home)' : device?.gps_fix ? 'Fix' : 'Searching…';

  return (
    <Screen>
      <View style={styles.titleRow}>
        <AppText variant="title" accessibilityRole="header" style={styles.flex}>
          Band
        </AppText>
        {USE_MOCK ? <SimulatedTag /> : null}
      </View>

      <Card style={styles.hero}>
        <View style={[styles.ring, { borderColor: online ? colors.primary : colors.offline }]}>
          <Ionicons name="watch" size={40} color={online ? colors.link : colors.offline} />
        </View>
        <AppText variant="heading">{online ? 'Online' : 'Offline'}</AppText>
        <AppText color={colors.textMuted}>{band ? `…${band.id.slice(-4)} · ${band.wearer_name ?? ''}` : USE_MOCK ? `band-01 · ${MOCK_PERSON.name}` : ''}</AppText>
      </Card>

      <SectionTitle>Details</SectionTitle>
      <Card>
        <InfoRow icon="navigate" label="GPS" value={gps} />
        <InfoRow icon="home" label="Home zone" value={homeStatusWords(status?.status).title} last />
      </Card>

    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm },
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  ring: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
});
