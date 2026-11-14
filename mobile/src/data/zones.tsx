/**
 * zones.tsx — SAFE ZONES & GEOFENCING (section D): zones per person, the geofence engine that turns
 * positions into arrival / departure / unexpected-exit notifications, and a SAMPLE walk to demo it.
 * Owner: Person 3/4 (Zuhayr). Real version later: the band's GPS fixes go to the backend, which runs
 * the same rules server-side (Persons 1 & 2). Everything here is fictional and in memory.
 *
 * Rules:
 *  - Inside a zone when distance ≤ radius. Outside only when distance > radius + 10 m.
 *    Why the 10 m buffer: GPS wobbles by ~5–10 m; without it a person standing at the edge would
 *    trigger leave/arrive/leave… every few seconds (same idea as the BLE −80/−70 dBm hysteresis).
 *  - Leaving a zone = UNEXPECTED EXIT if the zone has "alert on unexpected exit" on AND
 *    (there is no allowed departure window, OR the time is outside it). Otherwise = normal DEPARTURE.
 *  - Entering a zone = ARRIVAL (if arrival notifications are on).
 *
 * NOT built (TBD in team file section 4): "other authorised locations", missed-arrival alerts,
 * history of past arrivals/departures. Expected arrival time is stored and shown only.
 */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { MOCK_HOME } from '@/data/mock';
import { useNotify } from '@/data/notify';
import { usePeople } from '@/data/people';
import { distanceM, inWindow, LatLng, lerp, minutesOf } from '@/lib/geo';

export type ZoneType = 'home' | 'school' | 'grandparents' | 'other';

export const ZONE_TYPES: Record<ZoneType, { label: string; icon: 'home' | 'school' | 'heart' | 'location'; tbd?: boolean; simulated?: boolean }> = {
  home: { label: 'Home', icon: 'home' },
  school: { label: 'School', icon: 'school', simulated: true }, // child mode = simulation (D1)
  grandparents: { label: "Grandparents' house", icon: 'heart' },
  other: { label: 'Other authorised place', icon: 'location', tbd: true }, // TBD in team file
};

export interface SafeZone {
  id: string;
  personId: string;
  type: ZoneType;
  name: string;
  center: LatLng;
  /** metres */
  radius: number;
  notifyArrival: boolean;
  notifyDeparture: boolean;
  /** Raise an ALERT (not just a notification) when they leave outside the allowed window. */
  unexpectedExit: boolean;
  /** Allowed departure window "HH:MM"–"HH:MM", or null = any departure counts as unexpected (if the alert is on). */
  allowedDeparture: { from: string; to: string } | null;
  /** Shown only — the missed-arrival alert is TBD. */
  expectedArrival: string | null;
}

export type ZoneEventKind = 'arrival' | 'departure' | 'unexpected_exit';

export interface ZoneEvent {
  id: string;
  personId: string;
  zoneId: string;
  zoneName: string;
  kind: ZoneEventKind;
  at: string;
  /** Extra line, e.g. "outside the allowed time 15:00–15:45". */
  note?: string;
}

/** SAMPLE place presets (fictional points near the sample home — move them on the map). */
export const PLACE_PRESETS: Record<Exclude<ZoneType, 'other'>, LatLng> = {
  home: MOCK_HOME,
  school: { lat: -20.2442, lng: 57.4736 },
  grandparents: { lat: -20.2318, lng: 57.4641 },
};

/** Exit buffer in metres (see rules above). */
export const EXIT_BUFFER_M = 10;

/** Sensible defaults for a new zone of each type (the user can change them all). */
export function defaultZone(personId: string, type: ZoneType, isChild: boolean): Omit<SafeZone, 'id'> {
  const center = type === 'other' ? MOCK_HOME : PLACE_PRESETS[type];
  if (type === 'school') {
    return { personId, type, name: 'School', center, radius: 150, notifyArrival: true, notifyDeparture: true, unexpectedExit: true, allowedDeparture: { from: '15:00', to: '15:45' }, expectedArrival: '08:00' };
  }
  if (type === 'grandparents') {
    return { personId, type, name: "Grandparents' house", center, radius: 100, notifyArrival: true, notifyDeparture: true, unexpectedExit: false, allowedDeparture: null, expectedArrival: null };
  }
  // Home: for an older person with dementia ANY exit is unexpected (the core LAKAZ story);
  // for a child, leaving for school in the morning is normal.
  return {
    personId,
    type,
    name: 'Home',
    center,
    radius: 50, // team file 7.5: home zone radius 50 m
    notifyArrival: true,
    notifyDeparture: true,
    unexpectedExit: true,
    allowedDeparture: isChild ? { from: '07:00', to: '07:45' } : null,
    expectedArrival: null,
  };
}

// ---------------- SAMPLE state ----------------
let zones: SafeZone[] = [{ id: 'z-home', ...defaultZone('p-01', 'home', false) }];

interface Engine {
  /** Last known position used by the geofence (SAMPLE walk). */
  pos: LatLng | null;
  /** Zone ids the person is currently inside. */
  inside: Set<string>;
}
const engines = new Map<string, Engine>();
const engineOf = (personId: string) => {
  let e = engines.get(personId);
  if (!e) {
    e = { pos: null, inside: new Set() };
    engines.set(personId, e);
  }
  return e;
};

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms));

interface ZonesCtx {
  zonesOf: (personId: string) => SafeZone[];
  get: (zoneId: string) => SafeZone | undefined;
  save: (z: Omit<SafeZone, 'id'> & { id?: string }) => Promise<string>;
  remove: (zoneId: string) => Promise<void>;
  /** Where the SAMPLE engine thinks the person is, and which zones they're inside. */
  status: (personId: string) => { pos: LatLng | null; inside: SafeZone[] };
  /** SAMPLE: walk from one zone towards another (or out to nowhere). `atTime` "HH:MM" pretends the clock says so. */
  simulateTrip: (personId: string, fromZoneId: string, toZoneId: string | null, atTime?: string) => void;
  tripRunning: boolean;
}

const Ctx = createContext<ZonesCtx | null>(null);

/** Provider for zones + the geofence engine. */
export function ZonesProvider({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);
  const [tripRunning, setTripRunning] = useState(false);
  // Refs so the walk timer (created once) always uses the newest notifier and people list.
  const { push } = useNotify();
  const pushRef = useRef(push);
  pushRef.current = push;
  const people = usePeople();
  const peopleRef = useRef(people);
  peopleRef.current = people;
  const tripTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (tripTimer.current) clearInterval(tripTimer.current);
  }, []);

  /**
   * THE GEOFENCE: compare a new position with every zone of the person and emit events.
   * Inputs: personId, position, clock minutes (for the departure window), emit = false to set the
   * starting state silently. Output: the events created.
   */
  const evaluate = (personId: string, pos: LatLng, clockMins: number, emit = true): ZoneEvent[] => {
    const eng = engineOf(personId);
    eng.pos = pos;
    const out: ZoneEvent[] = [];
    for (const z of zones.filter((x) => x.personId === personId)) {
      const d = distanceM(pos, z.center);
      const wasInside = eng.inside.has(z.id);
      if (!wasInside && d <= z.radius) {
        eng.inside.add(z.id);
        if (emit && z.notifyArrival) {
          out.push({
            id: uid('ev'), personId, zoneId: z.id, zoneName: z.name, kind: 'arrival', at: new Date().toISOString(),
            note: z.expectedArrival ? `Expected by ${z.expectedArrival}` : undefined,
          });
        }
      } else if (wasInside && d > z.radius + EXIT_BUFFER_M) {
        eng.inside.delete(z.id);
        if (!emit) continue;
        const w = z.allowedDeparture;
        const allowed = !!w && inWindow(clockMins, w.from, w.to);
        if (z.unexpectedExit && !allowed) {
          out.push({
            id: uid('ev'), personId, zoneId: z.id, zoneName: z.name, kind: 'unexpected_exit', at: new Date().toISOString(),
            note: w ? `Outside the allowed time ${w.from}–${w.to}` : 'Any exit from this zone raises an alert',
          });
        } else if (z.notifyDeparture) {
          out.push({
            id: uid('ev'), personId, zoneId: z.id, zoneName: z.name, kind: 'departure', at: new Date().toISOString(),
            note: w ? `Within the allowed time ${w.from}–${w.to}` : undefined,
          });
        }
      }
    }
    // Hand every event to the shared notifier (one banner for all alert types, settings respected).
    for (const ev of out) {
      const name = peopleRef.current.get(ev.personId)?.name ?? 'Someone';
      const verb = ev.kind === 'arrival' ? 'arrived at' : ev.kind === 'departure' ? 'left' : 'left unexpectedly:';
      pushRef.current({
        category: ev.kind === 'arrival' ? 'zone_arrival' : ev.kind === 'departure' ? 'zone_departure' : 'unexpected_exit',
        title: `${name} ${verb} ${ev.zoneName}`,
        body: ev.note,
        href: { pathname: '/person/[id]/zones', params: { id: ev.personId } },
        sample: true,
      });
    }
    return out;
  };

  const value = useMemo<ZonesCtx>(
    () => ({
      zonesOf: (personId) => zones.filter((z) => z.personId === personId),
      get: (zoneId) => zones.find((z) => z.id === zoneId),

      // SWAP FOR SUPABASE: upsert into a zones table (RLS: guardians of this person)
      save: async (z) => {
        await wait();
        const id = z.id ?? uid('z');
        const row = { ...z, id } as SafeZone;
        zones = z.id ? zones.map((x) => (x.id === z.id ? row : x)) : [...zones, row];
        // A moved/resized zone: forget "inside" so the next position re-evaluates it cleanly.
        engineOf(z.personId).inside.delete(id);
        bump();
        return id;
      },

      remove: async (zoneId) => {
        await wait();
        const z = zones.find((x) => x.id === zoneId);
        zones = zones.filter((x) => x.id !== zoneId);
        if (z) engineOf(z.personId).inside.delete(zoneId);
        bump();
      },

      status: (personId) => {
        const e = engineOf(personId);
        return { pos: e.pos, inside: zones.filter((z) => e.inside.has(z.id)) };
      },

      simulateTrip: (personId, fromZoneId, toZoneId, atTime) => {
        const from = zones.find((z) => z.id === fromZoneId);
        if (!from) return;
        const to = toZoneId ? zones.find((z) => z.id === toZoneId) : undefined;
        // No target zone → walk ~400 m north-east, i.e. away from everything.
        const target = to ? to.center : { lat: from.center.lat + 0.0032, lng: from.center.lng + 0.0022 };
        const [hh, mm] = (atTime ?? '').split(':').map(Number);
        const clockMins = atTime ? hh * 60 + mm : minutesOf(new Date());
        if (tripTimer.current) clearInterval(tripTimer.current);
        // Start silently inside the "from" zone (that's where they are before the walk).
        evaluate(personId, from.center, clockMins, false);
        setTripRunning(true);
        bump();
        let step = 0;
        const STEPS = 14; // ~14 × 1.2 s ≈ 17 s walk: long enough to watch, short enough for a demo
        tripTimer.current = setInterval(() => {
          step += 1;
          evaluate(personId, lerp(from.center, target, step / STEPS), clockMins);
          bump();
          if (step >= STEPS && tripTimer.current) {
            clearInterval(tripTimer.current);
            tripTimer.current = null;
            setTripRunning(false);
          }
        }, 1200);
      },
      tripRunning,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, tripRunning],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Hook for zone screens and the notification toast. */
export function useZones() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useZones must be used inside <ZonesProvider>');
  return v;
}
