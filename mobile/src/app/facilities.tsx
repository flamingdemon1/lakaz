/**
 * app/facilities.tsx — FIND A HEALTH FACILITY: pick a district, see the real public/private health
 * facilities in it (from public.facilities in Supabase, Open Data Mauritius dataset).
 * Owner: Person 3 (Zuhayr). Opened from the Help alerts screen. Read-only.
 *
 * States: not connected / not signed in → explain; loading → spinner; error → message + Try again;
 * no results → empty message; otherwise → "N facilities in <district>" + list + dataset source link.
 * Deliberately NOT here (team scope): maps, opening hours, contacting or notifying hospitals.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { FadeIn } from '@/components/motion';
import { AppText, Button, Card, EmptyState, IconName, Screen, SectionTitle } from '@/components/ui';
import {
  DATASET_CREDIT,
  District,
  DISTRICTS,
  Facility,
  FACILITIES_NOT_CONNECTED,
  FACILITIES_NOT_SIGNED_IN,
  fetchFacilities,
} from '@/data/facilities';
import { resetTo } from '@/lib/nav';
import { colors, motion, radius, space, TOUCH } from '@/theme';

/** Icon per facility type (values from the dataset). Anything unknown gets a generic medical icon. */
function typeIcon(type: string): IconName {
  if (/hospital/i.test(type)) return 'business';
  if (/clinic/i.test(type)) return 'medkit';
  return 'medical';
}

/** Screen. Default district = Plaines Wilhems (the sample person's district). */
export default function FacilitiesScreen() {
  const [district, setDistrict] = useState<District>('Plaines Wilhems');
  const [rows, setRows] = useState<Facility[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Why a request counter: if the carer taps Moka then Flacq quickly, a slow Moka reply must not
  // overwrite the Flacq list. Only the newest request may update the screen.
  const reqId = useRef(0);

  /** Loads one district; ignores replies that arrive after a newer request. */
  const load = useCallback(async (d: District) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchFacilities(d);
      if (id === reqId.current) setRows(list);
    } catch (e) {
      if (id === reqId.current) {
        setRows(null);
        setError((e as Error).message);
      }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(district);
  }, [district, load]);

  const source = rows?.[0]?.source_url;

  return (
    <Screen edges={['bottom']}>
      <View style={styles.intro}>
        <AppText variant="title" accessibilityRole="header">
          Find a health facility
        </AppText>
        <AppText color={colors.textMuted}>
          Hospitals, clinics and health centres in Mauritius, from the official open dataset. Choose a district.
        </AppText>
      </View>

      <SectionTitle>District</SectionTitle>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="District">
        {DISTRICTS.map((d) => {
          const on = d === district;
          return (
            <Pressable
              key={d}
              onPress={() => setDistrict(d)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              aria-checked={on}
              accessibilityLabel={d}
              style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}>
              <AppText variant="smallBold" color={on ? colors.onPrimary : colors.text}>
                {d}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {error === FACILITIES_NOT_SIGNED_IN ? (
        <EmptyState
          icon="log-in"
          title="Sign in to look up facilities"
          body="The facility list is only available to signed-in carers."
          action={<Button label="Go to log in" icon="log-in" onPress={() => resetTo('/login')} />}
        />
      ) : error === FACILITIES_NOT_CONNECTED ? (
        <EmptyState icon="cloud-offline" title="Not connected" body="This app build has no Supabase connection, so the real facility list can't load." />
      ) : error ? (
        <EmptyState
          icon="cloud-offline"
          title="Couldn't load facilities"
          body={error}
          action={<Button label="Try again" icon="refresh" onPress={() => load(district)} />}
        />
      ) : loading && !rows ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.link} />
          <AppText color={colors.textMuted}>Loading facilities in {district}…</AppText>
        </View>
      ) : rows && rows.length === 0 ? (
        <EmptyState icon="search" title={`No facilities listed in ${district}`} body="The dataset has no records for this district." />
      ) : rows ? (
        <>
          <View style={styles.countRow}>
            <AppText variant="heading" style={styles.flex} accessibilityLiveRegion="polite">
              {rows.length} {rows.length === 1 ? 'facility' : 'facilities'} in {district}
            </AppText>
            {/* Keeps the old list visible while the next district loads — no jumpy blank screen. */}
            {loading ? <ActivityIndicator color={colors.link} /> : null}
          </View>
          <Card style={styles.list}>
            {rows.map((f, i) => (
              <FadeIn key={f.id} delay={Math.min(i, 8) * (motion.stagger / 2)}>
                <View style={[styles.row, i > 0 && styles.divider]} accessibilityLabel={`${f.name}, ${f.type}`}>
                  <View style={styles.icon}>
                    <Ionicons name={typeIcon(f.type)} size={20} color={colors.link} />
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="bodyBold">{f.name}</AppText>
                    <AppText variant="small" color={colors.textMuted}>
                      {f.type}
                    </AppText>
                  </View>
                </View>
              </FadeIn>
            ))}
          </Card>
        </>
      ) : null}

      {/* Source + licence: required by CC BY-SA, and judges can check the data is real. */}
      <View style={styles.source}>
        <AppText variant="small" color={colors.textMuted}>
          Source: {DATASET_CREDIT}. Lists names and types only — check services and hours before you go.
        </AppText>
        {source ? (
          <Pressable
            onPress={() => Linking.openURL(source)}
            accessibilityRole="link"
            accessibilityLabel="Open the dataset source on data.govmu.org"
            hitSlop={8}
            style={styles.link}>
            <Ionicons name="open-outline" size={16} color={colors.link} />
            <AppText variant="smallBold" color={colors.link}>
              View dataset on data.govmu.org
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: space.xs, marginTop: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: TOUCH, // 48 px: older hands
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.85 },
  center: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  list: { paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  source: { gap: space.sm },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: TOUCH, alignSelf: 'flex-start' },
});
