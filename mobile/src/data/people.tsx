/**
 * people.tsx — SAMPLE store for the people a caregiver looks after (section B: person management):
 * basic details, safety profile, emergency contact, optional medical/safety notes,
 * assigned wearable, authorised guardians, and device connection.
 * Owner: Person 3/4 (Zuhayr). Real data = Supabase (Person 2) later.
 *
 * NOTHING HERE IS REAL: in memory only (resets on reload), FICTIONAL people only (section 7.5).
 * Medical notes are the most sensitive data in the app: guardians only, never on the responder page (D10).
 * Functions marked "SWAP FOR SUPABASE" are the only ones that change when the backend is ready.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { USE_MOCK } from '@/config';
import { useBand } from '@/data/bands';
import { MOCK_PERSON } from '@/data/mock';
import { normalisePhone } from '@/lib/validate';

/** The three safety profiles. Only Elderly is the real hardware demo (D1); the others are simulation. */
export type SafetyProfile = 'elderly' | 'child' | 'personal';

export const PROFILE_INFO: Record<
  SafetyProfile,
  { title: string; body: string; icon: 'home' | 'school' | 'shield-checkmark'; simulated: boolean }
> = {
  elderly: {
    title: 'Elderly / Dementia',
    body: 'Alert when they leave home. GPS only wakes up outside the safe zone.',
    icon: 'home',
    simulated: false,
  },
  child: {
    title: 'Child safety',
    body: 'Home and school zones. Alert if they leave a zone at the wrong time.',
    icon: 'school',
    simulated: true, // D1: child mode is a software simulation only
  },
  personal: {
    title: 'Personal safety',
    body: 'SOS button and "I\'m OK" check-ins for adults travelling alone.',
    icon: 'shield-checkmark',
    simulated: true,
  },
};

export interface Guardian {
  id: string;
  name: string;
  phone: string; // +230XXXXXXXX
  relationship: string;
  /** Exactly one primary per person: gets the first alert (level 1). Secondary = level 2. */
  role: 'primary' | 'secondary';
}

export interface CaredPerson {
  id: string;
  name: string;
  age: number;
  profile: SafetyProfile;
  /** Avatar colour (photo upload needs expo-image-picker, not approved yet). */
  avatarColor: string;
  emergency: { name: string; phone: string; relationship: string };
  /** Optional. Guardians only. Keep it short and practical (what a helper needs to know). */
  medical: { conditions: string; allergies: string; medications: string; notes: string };
  device_id: string | null;
  guardians: Guardian[];
}

export interface WearableDevice {
  device_id: string;
  label: string;
  battery_pct: number | null;
  /** ISO time of the last heartbeat. Offline after 20 s (section 7.2). */
  last_seen: string | null;
}

/** Avatar colours (all pass 4.5:1 with white initials). Earthy only: red/amber/green/blue mean status. */
export const AVATAR_COLORS = ['#23394B', '#6D4C7D', '#8A5A3B', '#3E5F6B', '#7A4E62', '#55557A'];

// ---------------- SAMPLE data (fictional) ----------------
const now = () => new Date().toISOString();

let devices: WearableDevice[] = [
  { device_id: 'band-01', label: 'LAKAZ band (prototype)', battery_pct: 81, last_seen: now() },
  { device_id: 'band-02', label: 'Spare band', battery_pct: 100, last_seen: null },
];

let people: CaredPerson[] = [
  {
    id: 'p-01',
    name: MOCK_PERSON.name, // the one fictional sample person, defined in data/mock.ts
    age: MOCK_PERSON.age,
    profile: 'elderly',
    avatarColor: AVATAR_COLORS[0],
    emergency: { name: 'Demo Caregiver', phone: '+23057000001', relationship: 'Daughter' },
    medical: {
      conditions: 'Early-stage dementia (fictional)',
      allergies: 'None known',
      medications: 'Taken at home, morning and evening',
      notes: 'Speaks Kreol. Calms down with a familiar voice.',
    },
    device_id: 'band-01',
    guardians: [
      { id: 'g-1', name: 'Demo Caregiver', phone: '+23057000001', relationship: 'Daughter', role: 'primary' },
      { id: 'g-2', name: 'Demo Neighbour', phone: '+23057000002', relationship: 'Neighbour', role: 'secondary' },
    ],
  },
];

const wait = (ms = 500) => new Promise((r) => setTimeout(r, ms));
const uid = (p: string) => `${p}-${Date.now().toString(36)}`;

/** SAMPLE tool: devices whose heartbeat we pretend has stopped (to show the offline state). */
const offlineDevices = new Set<string>();

/** SAMPLE ONLY: switch a band's fake heartbeat off/on. */
export function simulateDeviceOffline(deviceId: string, off: boolean) {
  if (off) offlineDevices.add(deviceId);
  else offlineDevices.delete(deviceId);
}
/** SAMPLE ONLY: is the fake heartbeat switched off? */
export const isSimulatedOffline = (deviceId: string) => offlineDevices.has(deviceId);

/** What the add/edit form sends. */
export type PersonInput = Omit<CaredPerson, 'id' | 'guardians'>;

interface PeopleCtx {
  people: CaredPerson[];
  devices: WearableDevice[];
  get: (id: string) => CaredPerson | undefined;
  deviceOf: (p: CaredPerson) => WearableDevice | undefined;
  /** Who a device is assigned to (to show "used by X" in the picker). */
  ownerOf: (deviceId: string) => CaredPerson | undefined;
  addPerson: (p: PersonInput, me: { name: string; phone: string }) => Promise<string>;
  updatePerson: (id: string, p: PersonInput) => Promise<void>;
  removePerson: (id: string) => Promise<void>;
  addDevice: (deviceId: string) => Promise<void>;
  addGuardian: (personId: string, g: Omit<Guardian, 'id' | 'role'>) => Promise<void>;
  removeGuardian: (personId: string, guardianId: string) => Promise<void>;
  makePrimary: (personId: string, guardianId: string) => Promise<void>;
}

const Ctx = createContext<PeopleCtx | null>(null);

/** Provider for the people/devices store. */
export function PeopleProvider({ children }: { children: React.ReactNode }) {
  // A version number that bumps after every change so screens re-render from the module data.
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);
  // LIVE: the person's name and age come from the backend (devices.wearer_*, set when a carer adds the
  // person with the band code). Applied to the first person, whose screens (Location, Escalation, person
  // page, zones) are reached from Home. Contacts / medical notes stay sample (no backend table yet).
  const { band } = useBand();
  const wearerName = !USE_MOCK ? band?.wearer_name?.trim() || null : null;
  const wearerAge = !USE_MOCK ? band?.wearer_age ?? null : null;

  // SAMPLE heartbeat: band-01 "reports" every 5 s like the real band (section 6, Person 1),
  // unless a sample tool switched it off. Without this the band would look offline after 20 s.
  useEffect(() => {
    const id = setInterval(() => {
      devices = devices.map((d) =>
        d.device_id === 'band-01' && !offlineDevices.has(d.device_id) ? { ...d, last_seen: new Date().toISOString() } : d,
      );
      setVersion((v) => v + 1);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const value = useMemo<PeopleCtx>(() => {
    /** Replaces one person by id. */
    const patch = (id: string, fn: (p: CaredPerson) => CaredPerson) => {
      people = people.map((p) => (p.id === id ? fn(p) : p));
    };
    /**
     * One device per person: assigning a band takes it off whoever had it before.
     * Why: the backend links an alert to a person through the device, so a device can't belong to two people.
     */
    const freeDevice = (deviceId: string | null, exceptId?: string) => {
      if (!deviceId) return;
      people = people.map((p) => (p.device_id === deviceId && p.id !== exceptId ? { ...p, device_id: null } : p));
    };

    /** LIVE: show the backend wearer instead of the sample name (age 0 = unknown, screens hide it). */
    const live = (p: CaredPerson): CaredPerson =>
      wearerName && p.id === people[0]?.id ? { ...p, name: wearerName, age: wearerAge ?? 0 } : p;

    return {
      people: people.map(live),
      devices,
      get: (id) => {
        const p = people.find((x) => x.id === id);
        return p ? live(p) : undefined;
      },
      deviceOf: (p) => devices.find((d) => d.device_id === p.device_id),
      ownerOf: (deviceId) => {
        const p = people.find((x) => x.device_id === deviceId);
        return p ? live(p) : undefined;
      },

      // SWAP FOR SUPABASE: insert person + link the signed-in caregiver as primary guardian
      addPerson: async (input, me) => {
        await wait();
        const id = uid('p');
        freeDevice(input.device_id, id);
        people = [
          ...people,
          {
            ...input,
            id,
            name: input.name.trim(),
            // The person who adds them becomes the primary guardian.
            guardians: [{ id: uid('g'), name: me.name, phone: me.phone, relationship: 'Caregiver', role: 'primary' }],
          },
        ];
        bump();
        return id;
      },

      // SWAP FOR SUPABASE: update person row (RLS: guardians of this person only)
      updatePerson: async (id, input) => {
        await wait();
        freeDevice(input.device_id, id);
        patch(id, (p) => ({ ...p, ...input, name: input.name.trim() }));
        bump();
      },

      removePerson: async (id) => {
        await wait();
        people = people.filter((p) => p.id !== id);
        bump();
      },

      // SWAP FOR SUPABASE: claim a device by its ID (backend checks the device exists and is free)
      addDevice: async (deviceId) => {
        await wait();
        const idClean = deviceId.trim().toLowerCase();
        if (!/^band-\d{2,}$/.test(idClean)) throw new Error('Device IDs look like band-03 (printed on the band).');
        if (devices.some((d) => d.device_id === idClean)) throw new Error('This device is already in your list.');
        devices = [...devices, { device_id: idClean, label: 'LAKAZ band', battery_pct: null, last_seen: null }];
        bump();
      },

      addGuardian: async (personId, g) => {
        await wait(400);
        const p = people.find((x) => x.id === personId);
        const phone = normalisePhone(g.phone)!;
        if (p?.guardians.some((x) => x.phone === phone)) throw new Error('This number is already a guardian.');
        patch(personId, (x) => ({
          ...x,
          guardians: [...x.guardians, { id: uid('g'), name: g.name.trim(), phone, relationship: g.relationship.trim(), role: 'secondary' }],
        }));
        bump();
      },

      removeGuardian: async (personId, guardianId) => {
        await wait(400);
        const g = people.find((x) => x.id === personId)?.guardians.find((x) => x.id === guardianId);
        // Someone must always get the first alert.
        if (g?.role === 'primary') throw new Error('Make someone else primary first.');
        patch(personId, (x) => ({ ...x, guardians: x.guardians.filter((y) => y.id !== guardianId) }));
        bump();
      },

      makePrimary: async (personId, guardianId) => {
        await wait(400);
        patch(personId, (x) => ({
          ...x,
          guardians: x.guardians.map((y) => ({ ...y, role: y.id === guardianId ? 'primary' : 'secondary' })),
        }));
        bump();
      },
    };
    // `version` is the trigger: module-level arrays changed, so rebuild the value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, wearerName, wearerAge]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Hook for the people screens. */
export function usePeople() {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePeople must be used inside <PeopleProvider>');
  return v;
}

/** Empty form values for a new person. */
export function blankPerson(): PersonInput {
  return {
    name: '',
    age: 0,
    profile: 'elderly',
    avatarColor: AVATAR_COLORS[0],
    emergency: { name: '', phone: '', relationship: '' },
    medical: { conditions: '', allergies: '', medications: '', notes: '' },
    device_id: null,
  };
}

/** Two-letter initials for the avatar. */
export const initialsOf = (name: string) =>
  name
    .split(/\s|-/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
