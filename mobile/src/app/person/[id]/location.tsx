/**
 * app/person/[id]/location.tsx — LOCATION: live tracking (when authorised and on) or last known location,
 * update time, GPS status, band connectivity, start/stop, who can see it, and the access log.
 * Owner: Person 3/4 (Zuhayr). SAMPLE data (src/data/tracking.tsx). Privacy rules are listed in that file.
 *
 * Honesty rules on this screen: "LIVE" only when tracking is on, this user is allowed, AND the fix is < 60 s old.
 * Otherwise it says "Last known" with the time. Old data is never called live.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FormError } from '@/components/forms';
import { LocationMap } from '@/components/LocationMap';
import { AppText, Button, Card, EmptyState, IconName, Screen, SectionTitle, SimulatedTag } from '@/components/ui';
import { FRESH_MS } from '@/config';
import { useAuth } from '@/data/auth';
import { MOCK_HOME } from '@/data/mock';
import { isSimulatedOffline, simulateDeviceOffline, usePeople } from '@/data/people';
import { TrackReason, usingPhoneGps, useTracking } from '@/data/tracking';
import { ageMs, clock, isOnline, timeAgo } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors, radius, space, statusStyles, TOUCH } from '@/theme';

/** Location screen for one person. */
export default function PersonLocation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { get: getPerson, deviceOf } = usePeople();
  const tracking = useTracking();
  const { user } = useAuth();
  const now = useNow();
  const p = getPerson(id);
  // Who I am for the tracking rules (who started it, who may see it). Phone number when the account has one,
  // otherwise the account id. Why not `phone ?? …`: accounts without a phone have phone '' (not null), so every
  // signed-in carer without a phone got the SAME empty identity and was told to "ask" themselves.
  const me = {
    name: user?.name || user?.email || 'Demo Caregiver',
    phone: user?.phone || (user?.id ? `id:${user.id}` : '+23057000001'),
  };

  const t = tracking.get(id);
  const s = t.session;
  const allowed = tracking.canViewLive(id, me.phone);
  const fix = t.lastFix;
  const fresh = !!fix && ageMs(fix.at, now) < FRESH_MS;
  const live = !!s && allowed && fresh;

  // Rule 5: log one "viewed" entry each time an allowed guardian opens the screen during tracking.
  const logged = useRef(false);
  useEffect(() => {
    if (s && allowed && !logged.current) {
      tracking.logView(id, me);
      logged.current = true;
    }
    if (!s) logged.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.startedAt, allowed]);

  if (!p) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon="help-circle" title="Person not found" />
      </Screen>
    );
  }
  // Demo: any signed-in carer may start tracking (the sample guardian list holds fictional phone numbers).
  const isGuardian = !!user || p.guardians.some((g) => g.phone === me.phone);
  const device = deviceOf(p);
  const online = device
    ? isOnline({ device_id: device.device_id, battery_pct: device.battery_pct, last_seen: device.last_seen, gps_fix: null }, now)
    : false;
  // While tracking is on but this user isn't allowed, hide the live position completely (show nothing newer).
  const showMap = !!fix && (!s || allowed);

  return (
    <Screen edges={['bottom']}>
      <View style={styles.top}>
        <AppText variant="title" style={styles.flex}>
          {p.name}
        </AppText>
        <SimulatedTag text={usingPhoneGps() ? 'PHONE GPS (stand-in)' : 'SAMPLE GPS'} />
      </View>

      <StatusBanner
        tone={live ? 'live' : s ? (allowed ? 'stale' : 'blocked') : 'off'}
        title={
          live
            ? 'LIVE · tracking on'
            : s
              ? allowed
                ? 'Tracking on · waiting for a GPS fix'
                : 'Tracking on · you are not on the list'
              : 'Tracking off'
        }
        body={
          s
            ? `Started by ${s.startedBy.name} at ${clock(s.startedAt)} · stops automatically in ${countdown(s.endsAt, now)}`
            : 'Showing the last known location only. GPS sleeps to save battery.'
        }
      />

      <Card style={styles.gap}>
        {showMap ? (
          <>
            <LocationMap lat={fix!.lat} lng={fix!.lng} fresh={live} height={240} home={p.id === 'p-01' ? MOCK_HOME : undefined} />
            <View style={styles.row}>
              <View style={[styles.dot, { backgroundColor: live ? colors.primary : colors.offline }]} />
              <AppText variant="bodyBold" style={styles.flex}>
                {live ? 'Live position' : 'Last known location — not live'}
              </AppText>
            </View>
            <AppText color={colors.textMuted}>
              Updated {clock(fix!.at)} · {timeAgo(fix!.at, now)}
            </AppText>
          </>
        ) : s && !allowed ? (
          <View style={styles.empty}>
            <Ionicons name="eye-off" size={28} color={colors.textMuted} />
            <AppText variant="bodyBold">Live location is private</AppText>
            <AppText color={colors.textMuted} style={styles.center}>
              Ask {s.startedBy.name} to add you if you need to help.
            </AppText>
          </View>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="locate" size={28} color={colors.textMuted} />
            <AppText variant="bodyBold">No location yet</AppText>
            <AppText color={colors.textMuted} style={styles.center}>
              The band only records a position after it leaves home or tracking starts.
            </AppText>
          </View>
        )}
      </Card>

      <View style={styles.statusRow}>
        <StatusTile
          icon="navigate"
          title="GPS"
          value={t.gps === 'fix' ? 'Fix' : t.gps === 'searching' ? 'Searching…' : 'Idle'}
          sub={t.gps === 'idle' ? 'Off to save battery' : t.gps === 'searching' ? 'Needs open sky' : 'Getting positions'}
          color={t.gps === 'fix' ? colors.link : t.gps === 'searching' ? statusStyles.Active.bg : colors.textMuted}
        />
        <StatusTile
          icon={online ? 'wifi' : 'cloud-offline'}
          title="Band connection"
          value={device ? (online ? 'Online' : 'Offline') : 'No band'}
          sub={device ? device.device_id : 'Assign one first'}
          color={online ? colors.link : colors.offline}
        />
      </View>

      {isGuardian ? (
        s ? (
          <ActiveControls personId={p.id} guardians={p.guardians} me={me} />
        ) : (
          <StartForm personId={p.id} guardians={p.guardians} me={me} hasDevice={!!device} />
        )
      ) : (
        <Card>
          <AppText color={colors.textMuted}>Only {p.name}'s guardians can start tracking.</AppText>
        </Card>
      )}

      <Card style={styles.privacy}>
        <Ionicons name="shield-checkmark" size={20} color={colors.link} />
        <AppText variant="small" style={styles.flex}>
          Tracking is off by default. Only the people chosen can see it, it stops by itself, and every view is logged.
        </AppText>
      </Card>

      <SectionTitle>Access log</SectionTitle>
      <Card>
        {t.log.length === 0 ? (
          <AppText color={colors.textMuted}>No tracking yet.</AppText>
        ) : (
          t.log.slice(0, 8).map((e, i) => (
            <View key={`${e.at}-${i}`} style={[styles.logRow, i > 0 && styles.divider]}>
              <AppText variant="smallBold" style={styles.logTime}>
                {clock(e.at)}
              </AppText>
              <AppText variant="small" style={styles.flex}>
                <AppText variant="smallBold">{e.who}</AppText> · {e.what}
              </AppText>
            </View>
          ))
        )}
      </Card>

      {device ? <SampleTools personId={p.id} deviceId={device.device_id} /> : null}
    </Screen>
  );
}

/** "12:34" countdown to an ISO time. */
function countdown(endIso: string, now: number) {
  const s = Math.max(0, Math.round((new Date(endIso).getTime() - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Coloured strip at the top saying exactly what the user is looking at. */
function StatusBanner({ tone, title, body }: { tone: 'live' | 'stale' | 'blocked' | 'off'; title: string; body: string }) {
  const bg = { live: colors.primary, stale: statusStyles.Active.bg, blocked: colors.offline, off: colors.primary }[tone];
  const icon: IconName = { live: 'radio', stale: 'time', blocked: 'eye-off', off: 'pause-circle' }[tone] as IconName;
  return (
    <View style={[styles.banner, { backgroundColor: bg }]} accessibilityRole="summary" accessibilityLiveRegion="polite">
      <Ionicons name={icon} size={22} color={colors.white} />
      <View style={styles.flex}>
        <AppText variant="bodyBold" color={colors.white}>
          {title}
        </AppText>
        <AppText variant="small" color="rgba(255,255,255,0.92)">
          {body}
        </AppText>
      </View>
    </View>
  );
}

/** Small status tile (GPS / connectivity). */
function StatusTile({ icon, title, value, sub, color }: { icon: IconName; title: string; value: string; sub: string; color: string }) {
  return (
    <Card style={[styles.tile]}>
      <View style={styles.row}>
        <Ionicons name={icon} size={18} color={color} />
        <AppText variant="label" color={colors.textMuted}>
          {title.toUpperCase()}
        </AppText>
      </View>
      <AppText variant="heading" color={color}>
        {value}
      </AppText>
      <AppText variant="small" color={colors.textMuted}>
        {sub}
      </AppText>
    </Card>
  );
}

type G = { id: string; name: string; phone: string; relationship: string };

/** Form to start tracking: reason, duration, who else can see. */
function StartForm({ personId, guardians, me, hasDevice }: { personId: string; guardians: G[]; me: { name: string; phone: string }; hasDevice: boolean }) {
  const tracking = useTracking();
  const [reason, setReason] = useState<TrackReason>('incident');
  const [minutes, setMinutes] = useState(15);
  const [share, setShare] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const others = guardians.filter((g) => g.phone !== me.phone);

  /** Starts a session with the chosen options. */
  const onStart = async () => {
    setBusy(true);
    setError(null);
    try {
      await tracking.start(personId, { reason, minutes, shareWith: share }, me);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionTitle>Start live tracking</SectionTitle>
      <Card style={styles.gap}>
        <AppText variant="smallBold">Why?</AppText>
        <Choice
          options={[
            { v: 'incident', label: 'They may be lost or in danger' },
            { v: 'checkin', label: 'Agreed check-in (they know)' },
          ]}
          value={reason}
          onChange={(v) => setReason(v as TrackReason)}
        />
        <AppText variant="smallBold">Stop automatically after</AppText>
        <Choice
          options={[15, 30, 60].map((m) => ({ v: String(m), label: `${m} min` }))}
          value={String(minutes)}
          onChange={(v) => setMinutes(Number(v))}
          row
        />
        <AppText variant="smallBold">Who else can see it?</AppText>
        {others.length === 0 ? (
          <AppText variant="small" color={colors.textMuted}>
            Only you. Add guardians on the person's page.
          </AppText>
        ) : (
          others.map((g) => {
            const on = share.includes(g.phone);
            return (
              <Pressable
                key={g.id}
                onPress={() => setShare((s) => (on ? s.filter((x) => x !== g.phone) : [...s, g.phone]))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                aria-checked={on}
                style={styles.checkRow}>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={26} color={on ? colors.link : colors.textMuted} />
                <AppText style={styles.flex}>
                  {g.name} <AppText color={colors.textMuted}>({g.relationship})</AppText>
                </AppText>
              </Pressable>
            );
          })
        )}
        <AppText variant="small" color={colors.textMuted}>
          You will always see it. Nobody else does unless you tick them.
        </AppText>
        {!hasDevice ? <FormError message="Assign a band to this person first." /> : <FormError message={error} />}
        <Button label="Start live tracking" icon="radio" size="lg" loading={busy} disabled={!hasDevice} onPress={onStart} />
      </Card>
    </>
  );
}

/** While tracking is on: who can see it (starter can change) + stop. */
function ActiveControls({ personId, guardians, me }: { personId: string; guardians: G[]; me: { name: string; phone: string } }) {
  const tracking = useTracking();
  const s = tracking.get(personId).session!;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iStarted = s.startedBy.phone === me.phone;

  /** Runs an action and shows its error. */
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <SectionTitle>Who can see the live location</SectionTitle>
      <Card style={styles.gapSm}>
        {guardians.map((g) => {
          const can = s.viewers.includes(g.phone);
          const starter = g.phone === s.startedBy.phone;
          return (
            <View key={g.id} style={styles.viewerRow}>
              <Ionicons name={can ? 'eye' : 'eye-off'} size={20} color={can ? colors.link : colors.textMuted} />
              <AppText style={styles.flex}>
                {g.name}
                {g.phone === me.phone ? ' (You)' : ''}
              </AppText>
              {starter ? (
                <AppText variant="small" color={colors.textMuted}>
                  started it
                </AppText>
              ) : iStarted ? (
                <Button
                  label={can ? 'Remove' : 'Allow'}
                  tone={can ? 'ghost' : 'secondary'}
                  loading={busy === g.id}
                  onPress={() => run(g.id, () => tracking.setViewer(personId, g.phone, g.name, !can, me))}
                />
              ) : (
                <AppText variant="small" color={colors.textMuted}>
                  {can ? 'can see' : 'cannot see'}
                </AppText>
              )}
            </View>
          );
        })}
        <FormError message={error} />
      </Card>
      <Button label="Stop live tracking" icon="stop-circle" tone="danger" size="lg" loading={busy === 'stop'} onPress={() => run('stop', () => tracking.stop(personId, me))} />
    </>
  );
}

/** Simple radio choice list (or row of chips). */
function Choice({
  options,
  value,
  onChange,
  row,
}: {
  options: { v: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  row?: boolean;
}) {
  return (
    <View style={row ? styles.choiceRow : styles.gapSm} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.v === value;
        return (
          <Pressable
            key={o.v}
            onPress={() => onChange(o.v)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            aria-checked={on}
            // Row chips go solid teal (white text); list options get a light highlight (dark text stays readable).
            style={[styles.choice, row ? styles.flex : styles.choiceList, on && (row ? styles.choiceOn : styles.choiceOnSoft)]}>
            {!row ? <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? colors.link : colors.textMuted} /> : null}
            <AppText variant="bodyBold" color={on && row ? colors.white : colors.text}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** SAMPLE tools to show the honest "not live" states during rehearsal. */
function SampleTools({ personId, deviceId }: { personId: string; deviceId: string }) {
  const tracking = useTracking();
  const [offline, setOffline] = useState(isSimulatedOffline(deviceId));
  const noFix = tracking.isNoFix(personId);
  return (
    <Card style={styles.tools}>
      <SimulatedTag text="SAMPLE TOOLS" />
      <Button
        label={noFix ? 'GPS fix: blocked (indoors) — tap to restore' : 'Simulate no GPS fix (indoors)'}
        icon="business"
        tone="secondary"
        onPress={() => tracking.simulateNoFix(personId, !noFix)}
      />
      <Button
        label={offline ? 'Band offline — tap to bring back' : 'Simulate band offline'}
        icon="cloud-offline"
        tone="secondary"
        onPress={() => {
          simulateDeviceOffline(deviceId, !offline);
          setOffline(!offline);
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm },
  flex: { flex: 1 },
  gap: { gap: space.md },
  gapSm: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  center: { textAlign: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
  empty: { alignItems: 'center', gap: space.sm, padding: space.xl, borderRadius: radius.md, backgroundColor: colors.muted },
  statusRow: { flexDirection: 'row', gap: space.md },
  tile: { flex: 1, gap: 2 },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  logRow: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm },
  logTime: { width: 64 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH },
  viewerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH },
  choiceRow: { flexDirection: 'row', gap: space.sm },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: TOUCH,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  choiceOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  choiceList: { justifyContent: 'flex-start' },
  choiceOnSoft: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  tools: { gap: space.sm, borderWidth: 2, borderColor: colors.simulated, borderStyle: 'dashed' },
});
