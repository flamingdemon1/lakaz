/**
 * app/person/[id]/zone-edit.tsx — CREATE / EDIT A SAFE ZONE: type, name, centre (tap the map or use a
 * preset), radius, which notifications, allowed departure time, expected arrival time. Delete.
 * Owner: Person 3/4 (Zuhayr). Params: ?type=home|school|grandparents (new) or ?zoneId=… (edit).
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { FormError, TextField } from '@/components/forms';
import { ZoneMap } from '@/components/ZoneMap';
import { AppText, Button, Card, EmptyState, Screen, SectionTitle, SimulatedTag } from '@/components/ui';
import { usePeople } from '@/data/people';
import { useTracking } from '@/data/tracking';
import { defaultZone, PLACE_PRESETS, SafeZone, useZones, ZONE_TYPES, ZoneType } from '@/data/zones';
import { parseHHMM } from '@/lib/geo';
import { checkName } from '@/lib/validate';
import { colors, radius, space, statusStyles, TOUCH } from '@/theme';

const RADIUS_CHOICES = [50, 100, 200, 500];
/** Why 30–1000 m: under 30 m GPS wobble causes false alerts; over 1 km the zone stops meaning "safe place". */
const MIN_R = 30;
const MAX_R = 1000;

/** Zone editor screen. */
export default function ZoneEdit() {
  const params = useLocalSearchParams<{ id: string; zoneId?: string; type?: ZoneType }>();
  const { get: getPerson } = usePeople();
  const { get, save, remove } = useZones();
  const tracking = useTracking();
  const p = getPerson(params.id);
  const existing = params.zoneId ? get(params.zoneId) : undefined;
  const startType: ZoneType = existing?.type ?? (params.type && params.type in ZONE_TYPES ? params.type : 'home');

  const [z, setZ] = useState<Omit<SafeZone, 'id'>>(
    existing ?? defaultZone(params.id, startType, p?.profile === 'child'),
  );
  const [windowOn, setWindowOn] = useState(!!z.allowedDeparture);
  const [from, setFrom] = useState(z.allowedDeparture?.from ?? '15:00');
  const [to, setTo] = useState(z.allowedDeparture?.to ?? '15:45');
  const [arrival, setArrival] = useState(z.expectedArrival ?? '');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!p || (params.zoneId && !existing)) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon="help-circle" title="Not found" />
      </Screen>
    );
  }

  const set = <K extends keyof typeof z>(k: K, v: (typeof z)[K]) => setZ((s) => ({ ...s, [k]: v }));
  const errs = {
    name: checkName(z.name),
    from: windowOn && parseHHMM(from) === null ? 'Use 24 h time, e.g. 15:00' : null,
    to: windowOn && parseHHMM(to) === null ? 'Use 24 h time, e.g. 15:45' : null,
    arrival: arrival.trim() && parseHHMM(arrival) === null ? 'Use 24 h time, e.g. 08:00' : null,
    nothing: !z.notifyArrival && !z.notifyDeparture && !z.unexpectedExit ? 'Turn on at least one notification, or this zone does nothing.' : null,
  };
  const lastFix = tracking.get(p.id).lastFix;
  const info = ZONE_TYPES[z.type];

  /** Validates and saves, then goes back to the list. */
  const onSave = async () => {
    setTried(true);
    if (Object.values(errs).some(Boolean)) {
      setError('Some fields need fixing — see the red messages.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await save({
        ...z,
        id: existing?.id,
        allowedDeparture: windowOn ? { from: from.trim(), to: to.trim() } : null,
        expectedArrival: arrival.trim() || null,
      });
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  /** Two-step delete. Why: deleting Home silently would switch off the core alert. */
  const onDelete = async () => {
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    await remove(existing!.id);
    router.back();
  };

  return (
    <Screen edges={['bottom']}>
      <View style={styles.top}>
        <Ionicons name={info.icon} size={26} color={colors.link} />
        <AppText variant="title" style={styles.flex}>
          {existing ? 'Edit zone' : `New ${info.label.toLowerCase()} zone`}
        </AppText>
        {info.simulated ? <SimulatedTag text="SIMULATION" /> : null}
      </View>

      <Card style={styles.gap}>
        <TextField label="Zone name" value={z.name} onChangeText={(v) => set('name', v)} error={tried ? errs.name : null} />
        <AppText variant="smallBold">Type</AppText>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {(Object.keys(ZONE_TYPES) as ZoneType[]).map((t) => {
            const on = t === z.type;
            const dis = !!ZONE_TYPES[t].tbd;
            return (
              <Pressable
                key={t}
                disabled={dis}
                onPress={() => set('type', t)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled: dis }}
                aria-checked={on}
                style={[styles.chip, on && styles.chipOn, dis && styles.disabled]}>
                <AppText variant="smallBold" color={on ? colors.white : colors.text}>
                  {ZONE_TYPES[t].label}
                  {dis ? ' (TBD)' : ''}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <SectionTitle>Where</SectionTitle>
      <ZoneMap
        zones={[{ id: 'edit', center: z.center, radius: z.radius, label: z.name || 'New zone', selected: true }]}
        focus={z.center}
        onPress={(pt) => set('center', pt)}
        height={260}
        span={Math.max(0.006, (z.radius / 111_000) * 6)}
      />
      <AppText variant="small" color={colors.textMuted}>
        Tap the map to move the centre. Locations below are fictional SAMPLE points.
      </AppText>
      <View style={styles.chips}>
        {z.type !== 'other' ? (
          <Button label={`Sample ${ZONE_TYPES[z.type].label.toLowerCase()} point`} icon="pin" tone="secondary" onPress={() => set('center', PLACE_PRESETS[z.type as Exclude<ZoneType, 'other'>])} />
        ) : null}
        {lastFix ? <Button label="Use last known position" icon="locate" tone="secondary" onPress={() => set('center', { lat: lastFix.lat, lng: lastFix.lng })} /> : null}
      </View>

      <SectionTitle>Radius</SectionTitle>
      <Card style={styles.gap}>
        <View style={styles.radiusRow}>
          <RoundBtn icon="remove" label="Smaller by 10 metres" onPress={() => set('radius', Math.max(MIN_R, z.radius - 10))} />
          <AppText variant="hero" style={styles.radiusText} accessibilityLiveRegion="polite">
            {z.radius} m
          </AppText>
          <RoundBtn icon="add" label="Bigger by 10 metres" onPress={() => set('radius', Math.min(MAX_R, z.radius + 10))} />
        </View>
        <View style={styles.chips}>
          {RADIUS_CHOICES.map((r) => {
            const on = r === z.radius;
            return (
              <Pressable key={r} onPress={() => set('radius', r)} accessibilityRole="radio" aria-checked={on} accessibilityState={{ checked: on }} style={[styles.chip, styles.flex, on && styles.chipOn]}>
                <AppText variant="smallBold" color={on ? colors.white : colors.text} style={styles.center}>
                  {r} m
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText variant="small" color={colors.textMuted}>
          Tip: home 50 m, school 100–200 m. Exits only count 10 m past the edge, so GPS wobble doesn't spam you.
        </AppText>
      </Card>

      <SectionTitle>Notify me when</SectionTitle>
      <Card>
        <Toggle icon="enter" label="They arrive" sub="Arrival notification" value={z.notifyArrival} onChange={(v) => set('notifyArrival', v)} />
        <Toggle icon="exit" label="They leave (expected)" sub="Departure notification" value={z.notifyDeparture} onChange={(v) => set('notifyDeparture', v)} />
        <Toggle
          icon="alert-circle"
          label="They leave unexpectedly"
          sub="Full alert + escalation"
          value={z.unexpectedExit}
          onChange={(v) => set('unexpectedExit', v)}
          danger
          last
        />
        {tried && errs.nothing ? <FormError message={errs.nothing} /> : null}
      </Card>

      <SectionTitle>Times</SectionTitle>
      <Card style={styles.gap}>
        <Toggle
          icon="time"
          label="Only allow leaving at set times"
          sub={windowOn ? 'Leaving outside this window = unexpected exit' : 'Off: any exit counts as unexpected (if the alert is on)'}
          value={windowOn}
          onChange={setWindowOn}
          last
        />
        {windowOn ? (
          <View style={styles.timeRow}>
            <View style={styles.flex}>
              <TextField label="From" value={from} onChangeText={setFrom} placeholder="15:00" keyboardType="numbers-and-punctuation" maxLength={5} error={tried ? errs.from : null} />
            </View>
            <View style={styles.flex}>
              <TextField label="To" value={to} onChangeText={setTo} placeholder="15:45" keyboardType="numbers-and-punctuation" maxLength={5} error={tried ? errs.to : null} />
            </View>
          </View>
        ) : null}
        <TextField
          label="Expected arrival time (optional)"
          value={arrival}
          onChangeText={setArrival}
          placeholder="08:00"
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          error={tried ? errs.arrival : null}
          helper="Shown on arrival notifications. A 'missed arrival' alert is not built yet (needs team approval)."
        />
      </Card>

      <FormError message={error} />
      <Button label={existing ? 'Save zone' : 'Create zone'} icon="checkmark" size="lg" loading={busy} onPress={onSave} />
      {existing ? (
        <>
          <Button label={confirmDelete ? `Yes, delete ${existing.name}` : 'Delete zone'} icon="trash" tone={confirmDelete ? 'danger' : 'ghost'} onPress={onDelete} />
          {confirmDelete ? <Button label="Cancel" tone="ghost" onPress={() => setConfirmDelete(false)} /> : null}
        </>
      ) : null}
    </Screen>
  );
}

/** Row with an icon, two lines of text and a switch. Whole row is tappable. */
function Toggle({
  icon,
  label,
  sub,
  value,
  onChange,
  danger,
  last,
}: {
  icon: 'enter' | 'exit' | 'alert-circle' | 'time';
  label: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
  last?: boolean;
}) {
  const tint = danger ? statusStyles.Critical.bg : colors.primary;
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      aria-checked={value}
      accessibilityLabel={label}
      style={[styles.toggle, !last && styles.divider]}>
      <Ionicons name={icon} size={22} color={value ? tint : colors.textMuted} />
      <View style={styles.flex}>
        <AppText variant="bodyBold">{label}</AppText>
        <AppText variant="small" color={colors.textMuted}>
          {sub}
        </AppText>
      </View>
      {/* Switch is display-only: the whole row toggles. pointerEvents="none" stops a double toggle on web
          (switch click + row click), and it's hidden from screen readers because the row already announces it. */}
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden aria-hidden>
        <Switch value={value} trackColor={{ true: tint, false: colors.border }} />
      </View>
    </Pressable>
  );
}

/** Big round − / + button. */
function RoundBtn({ icon, label, onPress }: { icon: 'add' | 'remove'; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={({ pressed }) => [styles.round, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={28} color={colors.link} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  gap: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: TOUCH - 4, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  disabled: { opacity: 0.5 },
  radiusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  radiusText: { textAlign: 'center', flex: 1 },
  round: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH + 12, paddingVertical: space.sm },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  timeRow: { flexDirection: 'row', gap: space.md },
});
