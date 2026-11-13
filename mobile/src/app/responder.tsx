/**
 * app/responder.tsx — COMMUNITY RESPONDER page, opened from a QR code on the web (no install, no login).
 * Owner: Person 4 (Zuhayr). Demo moment at 2:10: "every phone on the responder page sounds at once".
 *
 * Privacy (D10): responders see photo + LAST KNOWN location, never live tracking.
 * So we freeze the location at the moment the community alert reached this page.
 * iOS can't vibrate from a web page (section 10, pitfall 10) — we use sound, which needs one tap first.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { LocationMap } from '@/components/LocationMap';
import { AppText, Button, Card, Screen, SimulatedTag } from '@/components/ui';
import { USE_MOCK } from '@/config';
import { MOCK_PERSON } from '@/data/mock';
import { useLakaz } from '@/data/store';
import { clock, timeAgo } from '@/lib/format';
import { useAlertFeedback } from '@/lib/useAlertFeedback';
import { useNow } from '@/lib/useNow';
import { colors, radius, space, statusStyles } from '@/theme';
import type { LastLocation } from '@/types';

/** Responder page. Shows only alerts that reached level 3 (community) and are not closed. */
export default function Responder() {
  const { alerts, sim } = useLakaz();
  const { play, needsTap, unlock } = useAlertFeedback();
  const now = useNow();

  const community = alerts.find((a) => a.level === 3 && (a.status === 'Critical' || a.status === 'Active'));
  const frozen = useRef<{ id: string; loc: LastLocation | null } | null>(null);

  // Freeze the location the first time we see this community alert (no live tracking for responders).
  if (community && frozen.current?.id !== community.alert_id) {
    frozen.current = { id: community.alert_id, loc: community.last_location };
  }
  if (!community) frozen.current = null;
  const loc = frozen.current?.loc ?? null;

  // Sound once when a new community alert appears.
  const communityId = community?.alert_id;
  useEffect(() => {
    if (communityId) play();
  }, [communityId, play]);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.logo}>
          <Ionicons name="people" size={22} color={colors.white} />
        </View>
        <View style={styles.flex}>
          <AppText variant="heading">LAKAZ community alert</AppText>
          <AppText variant="small" color={colors.textMuted}>
            Verified volunteers near Rose-Hill
          </AppText>
        </View>
        {USE_MOCK ? <SimulatedTag /> : null}
      </View>

      {needsTap ? (
        <Button label="Tap to turn on alert sound" icon="volume-high" size="lg" onPress={unlock} />
      ) : (
        <View style={styles.soundOn}>
          <Ionicons name="volume-high" size={18} color={colors.link} />
          <AppText variant="smallBold" color={colors.link}>
            Sound on — keep this page open
          </AppText>
        </View>
      )}

      {community ? (
        <>
          <View style={styles.alarm}>
            <AppText variant="label" color={colors.white}>
              PLEASE HELP · {clock(community.created_at)}
            </AppText>
            <AppText variant="hero" color={colors.white}>
              Have you seen Marie-Claire?
            </AppText>
          </View>

          <Card style={styles.person}>
            {/* Photo placeholder: fictional person, so no real photo is ever shown. */}
            <View style={styles.photo} accessibilityLabel="Photo placeholder">
              <AppText variant="hero" color={colors.link}>
                MC
              </AppText>
              <AppText variant="label" color={colors.textMuted}>
                PHOTO
              </AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="title">{MOCK_PERSON.name}</AppText>
              <AppText>{MOCK_PERSON.age} years old</AppText>
              <AppText variant="small" color={colors.textMuted}>
                May be confused. Speak calmly, in Kreol.
              </AppText>
            </View>
          </Card>

          <Card style={styles.gap}>
            <AppText variant="bodyBold">Last known location</AppText>
            {loc ? (
              <>
                <LocationMap lat={loc.lat} lng={loc.lng} fresh={false} height={220} />
                <AppText variant="small" color={colors.textMuted}>
                  Recorded {clock(loc.at)} ({timeAgo(loc.at, now)}). This is not live tracking.
                </AppText>
              </>
            ) : (
              <AppText color={colors.textMuted}>No location available.</AppText>
            )}
          </Card>

          <Card style={styles.gap}>
            <AppText variant="bodyBold">If you see her</AppText>
            <AppText>1. Stay with her and keep her calm.</AppText>
            <AppText>2. Call the police on 999.</AppText>
            <AppText>3. Do not try to move her by force.</AppText>
          </Card>
        </>
      ) : (
        <Card style={styles.waiting}>
          <Ionicons name="shield-checkmark" size={40} color={statusStyles.Resolved.bg} />
          <AppText variant="heading">No one needs help right now</AppText>
          <AppText color={colors.textMuted} style={styles.center}>
            Keep this page open. It will sound if someone near you goes missing.
          </AppText>
          {USE_MOCK ? (
            <Button label="Simulate a community alert (SOS)" icon="flask" tone="secondary" onPress={sim.sos} />
          ) : null}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  logo: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  soundOn: { flexDirection: 'row', alignItems: 'center', gap: space.sm, justifyContent: 'center' },
  alarm: { backgroundColor: statusStyles.Critical.bg, borderRadius: radius.xl, padding: space.xl, gap: space.sm },
  person: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
  photo: {
    width: 96,
    height: 112,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gap: { gap: space.sm },
  waiting: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  center: { textAlign: 'center' },
});
