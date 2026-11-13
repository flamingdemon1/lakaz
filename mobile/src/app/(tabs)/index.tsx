/**
 * app/(tabs)/index.tsx — HOME: the one screen a caregiver checks. "Is she OK right now?"
 * Owner: Person 3/4 (Fahim, Zuhayr). "Night glow" design (13 Nov).
 * Order: connection strip → person status (huge "At home") → 3 round shortcuts → open alert → location
 * (only during an incident) → recent alerts (stacked cards) → band → demo buttons.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AlertCard } from '@/components/AlertCard';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { DemoControls } from '@/components/DemoControls';
import { LocationCard } from '@/components/LocationCard';
import { FadeIn } from '@/components/motion';
import { PersonHero } from '@/components/PersonHero';
import { AppText, Card, IconName, Screen, SectionTitle } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { isOpen, useLakaz } from '@/data/store';
import { ALERT_KEY, fill, STATUS_KEY } from '@/i18n';
import { clock, isOnline } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors, motion, radius, space, statusStyles } from '@/theme';
import type { Alert } from '@/types';

/** Home screen. Sections fade up one after another (FadeIn + motion.stagger) on first open. */
export default function Home() {
  const { status, alerts, device, loading } = useLakaz();
  const { t } = useAuth(); // every label follows the language chosen in Profile
  const now = useNow();
  const open = alerts.filter(isOpen);
  const main = open[0];
  const online = isOnline(device, now);
  // Newest first; the stack shows at most 4 so Home stays a glance, not a log.
  const recent = [...alerts].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 4);

  return (
    <Screen>
      <ConnectionBanner />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.link} size="large" />
          <AppText color={colors.textMuted}>{t('loadingStatus')}</AppText>
        </View>
      ) : (
        <>
          <FadeIn>
            <PersonHero status={status} />
          </FadeIn>

          {/* Three round shortcuts (white circles on black, like the reference). Each opens a real screen. */}
          <FadeIn delay={motion.stagger} style={styles.actions}>
            <RoundAction icon="megaphone-outline" label={t('actHelpAlerts')} onPress={() => router.push('/help-alert')} />
            <RoundAction icon="location-outline" label={t('actLocation')} onPress={() => router.push('/person/p-01/location')} />
            <RoundAction icon="shield-outline" label={t('actZones')} onPress={() => router.push('/person/p-01/zones')} />
          </FadeIn>

          {main ? (
            <>
              <SectionTitle>{open.length > 1 ? fill(t('openAlerts'), { n: open.length }) : t('openAlert')}</SectionTitle>
              {open.map((a, i) => (
                <FadeIn key={a.alert_id} delay={i * motion.stagger}>
                  <AlertCard alert={a} />
                </FadeIn>
              ))}
              <LocationCard alert={main} />
            </>
          ) : null}

          {recent.length > 0 ? (
            <FadeIn delay={motion.stagger * 2} style={styles.group}>
              <View style={styles.rowBetween}>
                <AppText variant="heading" accessibilityRole="header">
                  {t('recentAlerts')}
                </AppText>
                <AppText variant="smallBold" color={colors.text} onPress={() => router.push('/alerts')} accessibilityRole="link">
                  {t('seeAll')}
                </AppText>
              </View>
              {/* Stacked cards: each one a shade lighter and tucked under the one above (deck look). */}
              <View>
                {recent.map((a, i) => (
                  <RecentAlert key={a.alert_id} alert={a} index={i} />
                ))}
              </View>
            </FadeIn>
          ) : (
            <FadeIn delay={motion.stagger * 2}>
              <Card style={styles.calm}>
                <Ionicons name="shield-checkmark" size={28} color={statusStyles.Resolved.bg} />
                <View style={styles.flex}>
                  <AppText variant="bodyBold">{t('allCalm')}</AppText>
                  {/* Privacy promise (D10): location is only visible during an incident. */}
                  <AppText variant="small" color={colors.textMuted}>
                    {t('allCalmBody')}
                  </AppText>
                </View>
              </Card>
            </FadeIn>
          )}

          <FadeIn delay={motion.stagger * 3} style={styles.group}>
            <SectionTitle>{t('bandTitle')}</SectionTitle>
            <Card style={styles.bandRow}>
              <Ionicons name="watch" size={26} color={online ? colors.link : colors.offline} />
              <View style={styles.flex}>
                <AppText variant="bodyBold">{online ? t('bandOnline') : t('bandOffline')}</AppText>
              </View>
              <AppText variant="smallBold" color={colors.link} onPress={() => router.push('/device')}>
                {t('details')}
              </AppText>
            </Card>
          </FadeIn>

          <DemoControls />
        </>
      )}
    </Screen>
  );
}

/** A white round button with a label under it. 64 px circle — easy for older hands. */
function RoundAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.action}>
      {({ pressed }) => (
        <>
          <View style={[styles.circle, pressed && styles.circlePressed]}>
            <Ionicons name={icon} size={26} color={colors.ink} />
          </View>
          <AppText variant="smallBold" color={colors.textMuted}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

/** Deck shades, darkest on top. White text on every shade is ≥ 4:1. */
const DECK = ['#1E1F6E', '#2A2C94', '#3A3DB8', '#5257D2'];

/** One card in the "Recent alerts" stack. Status colour is on the icon AND in words (never colour alone). */
function RecentAlert({ alert, index }: { alert: Alert; index: number }) {
  const { t } = useAuth();
  const s = statusStyles[alert.status];
  const title = t(ALERT_KEY[alert.type].title);
  // A left-home alert that closed because the band came back shows WHEN she returned.
  const label = alert.resolved_at ? fill(t('backHomeAt'), { time: clock(alert.resolved_at) }) : t(STATUS_KEY[alert.status]);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/alert/[id]', params: { id: alert.alert_id } })}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${label}, ${clock(alert.created_at)}`}
      style={[styles.deckCard, { backgroundColor: DECK[index % DECK.length], zIndex: 10 - index }, index > 0 && styles.tucked]}>
      <View style={styles.deckIcon}>
        <Ionicons name={s.icon as IconName} size={20} color={s.bg === colors.info ? colors.link : s.bg} />
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyBold" color={colors.white} numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="small" color="rgba(255,255,255,0.8)">
          {label}
        </AppText>
      </View>
      <View style={styles.timePill}>
        <AppText variant="smallBold" color={colors.white}>
          {clock(alert.created_at)}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.lg },
  loading: { alignItems: 'center', gap: space.md, paddingVertical: space.xxxl },
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: space.sm },
  action: { alignItems: 'center', gap: space.sm, minWidth: 88 },
  circle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  circlePressed: { transform: [{ scale: 0.94 }], opacity: 0.9 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.xl,
    minHeight: 76,
  },
  // Each card slides 14 px under the one above so they read as one stack.
  tucked: { marginTop: -14, paddingTop: space.lg + 14 },
  deckIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  timePill: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.75)', borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4 },
  calm: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  bandRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
});
