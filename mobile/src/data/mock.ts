/**
 * mock.ts — SIMULATED demo data and a fake escalation ladder, used when USE_MOCK is true.
 * Owner: Person 3 (Fahim, Zuhayr).
 *
 * Everything here is FICTIONAL (section 7.5): Marie-Claire, 74, Rose-Hill.
 * The UI shows a purple "SIMULATED" tag whenever this data is in use.
 * Field names match the shared contract exactly so switching to the real backend changes nothing in the screens.
 */
import { DEMO_LADDER_S } from '@/config';
import type { Alert, Device, DeviceStatus, Person } from '@/types';

/** Fictional person p-01 (section 7.5). */
export const MOCK_PERSON: Person = {
  person_id: 'p-01',
  name: 'Marie-Claire',
  age: 74,
  area: 'Rose-Hill',
  profile: 'Elderly',
  device_id: 'band-01',
};

/** Fictional caregivers (section 7.5). */
export const MOCK_CAREGIVERS = {
  'c-01': { id: 'c-01', name: 'Demo caregiver (primary)' },
  'c-02': { id: 'c-02', name: 'Demo caregiver (secondary)' },
} as const;

/** The caregiver "logged in" on this phone in the demo. */
export const ME = MOCK_CAREGIVERS['c-01'];

/** Fake home point — roughly Rose-Hill. Replace with the venue coordinates on the day (section 7.5). */
export const MOCK_HOME = { lat: -20.2397, lng: 57.4686 };

/** Returns the current time as an ISO string. */
const nowIso = () => new Date().toISOString();

/** Initial device row (assumed shape — see types.ts). */
export function mockDevice(): Device {
  return { device_id: 'band-01', battery_pct: 81, last_seen: nowIso(), gps_fix: false };
}

/** Initial status: person is at home, nothing happening. */
export function mockStatusHome(): DeviceStatus {
  return { status: 'HOME', person_name: MOCK_PERSON.name, since: nowIso(), level: null };
}

/** A resolved alert from earlier today, so the history list is not empty. */
export function mockHistory(): Alert[] {
  const t = new Date(Date.now() - 3 * 3600_000);
  return [
    {
      alert_id: 'a-0003',
      person_id: 'p-01',
      device_id: 'band-01',
      type: 'unexpected_exit',
      level: 1,
      status: 'Resolved',
      created_at: t.toISOString(),
      acknowledged_by: 'c-01',
      last_location: { lat: MOCK_HOME.lat + 0.0012, lng: MOCK_HOME.lng + 0.0009, at: t.toISOString() },
      location_fresh: false,
    },
  ];
}

let counter = 7;

/**
 * Creates a new SIMULATED exit alert at level 0 (band buzzing).
 * Input: alert type. Output: a contract-shaped Alert.
 */
export function mockNewAlert(type: Alert['type'] = 'unexpected_exit'): Alert {
  counter += 1;
  return {
    alert_id: `a-${String(counter).padStart(4, '0')}`,
    person_id: 'p-01',
    device_id: 'band-01',
    type,
    // Why SOS jumps straight to Critical: section 9, "any --sos--> Critical, notify everyone now".
    // Exits start at level 0 (band buzzes). Device warnings go straight to the primary caregiver (level 1).
    level: type === 'sos' ? 3 : type === 'unexpected_exit' ? 0 : 1,
    status: type === 'sos' ? 'Critical' : 'Active',
    created_at: nowIso(),
    acknowledged_by: null,
    last_location: { lat: MOCK_HOME.lat, lng: MOCK_HOME.lng, at: nowIso() },
    location_fresh: true,
  };
}

/**
 * Moves the fake person a few metres so the map and "updated X s ago" have something to show.
 * Input: alert. Output: a copy with a new last_location stamped now.
 */
export function mockWalk(a: Alert): Alert {
  const prev = a.last_location ?? { ...MOCK_HOME, at: nowIso() };
  return {
    ...a,
    last_location: { lat: prev.lat + 0.00018, lng: prev.lng + 0.00012, at: nowIso() },
    location_fresh: true,
  };
}

/**
 * Works out which escalation level an alert should be at, given seconds since the exit (section 9).
 * Inputs: the alert, seconds since it started, the timers (demo 10/25/45 s or real 2/7/15 min),
 * and whether the community rules allow level 3. Acknowledged / resolved alerts stop escalating.
 * Never goes DOWN: "Escalate now" can push a level early and the timer must not undo it.
 */
export function mockLevelFor(
  a: Alert,
  secondsSinceExit: number,
  timers: { l1: number; l2: number; l3: number } = DEMO_LADDER_S,
  communityAllowed = true,
): Pick<Alert, 'level' | 'status'> {
  if (a.status === 'Acknowledged' || a.status === 'Resolved') return { level: a.level, status: a.status };
  // SOS = notify everyone now (section 9). Without community permission it stops at level 2, still Critical.
  if (a.type === 'sos') return { level: communityAllowed ? 3 : 2, status: 'Critical' };
  // Why only exits climb the ladder: a low battery or lost signal is a warning for the caregiver,
  // not a reason to wake up neighbours (section 9 ladder is for the person being missing).
  if (a.type !== 'unexpected_exit') return { level: a.level, status: a.status };
  let level: Alert['level'] = 0;
  if (secondsSinceExit >= timers.l1) level = 1;
  if (secondsSinceExit >= timers.l2) level = 2;
  if (secondsSinceExit >= timers.l3) level = communityAllowed ? 3 : 2;
  level = Math.max(level, a.level) as Alert['level'];
  // Critical once it has gone past the secondary caregiver without anyone answering.
  const critical = level === 3 || (level === 2 && secondsSinceExit >= timers.l3);
  return { level, status: critical ? 'Critical' : 'Active' };
}
