/**
 * app/(tabs)/device.tsx — band status: online/offline, battery, last heartbeat, GPS state.
 * Owner: Person 3 (Fahim, Zuhayr).
 * Bluetooth + cellular status are TBD in scope (section 4), so they are NOT shown.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, InfoRow, Screen, SectionTitle, SimulatedTag } from '@/components/ui';
import { USE_MOCK } from '@/config';
import { isOpen, useLakaz } from '@/data/store';
import { homeStatusWords, isOnline, timeAgo } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors, space, statusStyles } from '@/theme';

/** Band tab. */
export default function DeviceScreen() {
  const { device, status, alerts } = useLakaz();
  const now = useNow();
  const online = isOnline(device, now);
  const atHome = homeStatusWords(status?.status).tone === 'calm';
  const incident = alerts.some(isOpen);
  const battery = device?.battery_pct;

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
        <View style={[styles.ring, { borderColor: online ? statusStyles.Resolved.bg : colors.offline }]}>
          <Ionicons name="watch" size={40} color={online ? statusStyles.Resolved.bg : colors.offline} />
        </View>
        <AppText variant="heading">{online ? 'Online' : 'Offline'}</AppText>
        <AppText color={colors.textMuted}>band-01 · worn by Marie-Claire</AppText>
      </Card>

      <SectionTitle>Details</SectionTitle>
      <Card>
        <InfoRow
          icon="pulse"
          label="Last heartbeat"
          value={timeAgo(device?.last_seen, now)}
          valueColor={online ? colors.text : statusStyles.Critical.bg}
        />
        <InfoRow
          icon={battery != null && battery < 20 ? 'battery-dead' : 'battery-half'}
          label="Battery"
          value={battery != null ? `${battery}%` : 'Unknown'}
          valueColor={battery != null && battery < 20 ? statusStyles.Critical.bg : colors.text}
        />
        <InfoRow icon="navigate" label="GPS" value={gps} />
        <InfoRow icon="home" label="Home zone" value={homeStatusWords(status?.status).title} last />
      </Card>

      <Card style={styles.note}>
        <Ionicons name="information-circle" size={22} color={colors.primary} />
        <AppText variant="small" color={colors.textMuted} style={styles.flex}>
          The band reports every 5 seconds. If nothing arrives for 20 seconds it is shown as offline.
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm },
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  ring: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
});
