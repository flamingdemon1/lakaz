/**
 * tracking.tsx — SAMPLE live-location tracking with privacy rules (section C).
 * Owner: Person 3/4 (Zuhayr). Real data later = band GPS → backend (Persons 1 & 2).
 *
 * Privacy rules built in (team rule D10 + "tracking must not mean everyone watches all the time"):
 *  1. Tracking is OFF by default. Off = guardians only see the LAST KNOWN location, clearly marked "not live".
 *  2. Only a guardian of the person can START it, and must give a reason (incident, or an agreed check-in).
 *  3. The starter chooses WHO can see it (default: only themselves). Others must be added explicitly.
 *  4. It STOPS automatically after the chosen time, and can be stopped any time.
 *  5. Every start / stop / view / access change is written to an ACCESS LOG the guardians can read.
 *
 * NOT built (TBD in team file section 4): movement direction, travel history, location history.
 * Everything is fictional and in memory. "SWAP FOR SUPABASE" marks what changes with the real backend.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { API_URL } from '@/config';
import { accessToken } from '@/data/supabase';
import { MOCK_HOME } from '@/data/mock';

export type GpsStatus = 'idle' | 'searching' | 'fix';
export type TrackReason = 'incident' | 'checkin';

export interface LocationFix {
  lat: number;
  lng: number;
  /** ISO time the fix was taken (backend received_at in real life). */
  at: string;
}

export interface TrackSession {
  reason: TrackReason;
  startedAt: string;
  /** Auto-stop time (ISO). */
  endsAt: string;
  startedBy: { name: string; phone: string };
  /** Phones of the guardians allowed to see the live position (starter always included). */
  viewers: string[];
}

export interface LogEntry {
  at: string;
  who: string;
  what: string;
}

export interface PersonTracking {
  session: TrackSession | null;
  lastFix: LocationFix | null;
  gps: GpsStatus;
  log: LogEntry[];
}

type Actor = { name: string; phone: string };

// ---------------- SAMPLE state ----------------
const state = new Map<string, PersonTracking>();
/** SAMPLE tool: people whose band "can't get a GPS fix" (e.g. indoors, section 10 pitfall 5). */
const noFix = new Set<string>();

/** Returns (and creates if needed) the tracking record for a person. */
function rec(personId: string): PersonTracking {
  let r = state.get(personId);
  if (!r) {
    // Seed: Marie-Claire has an old fix from earlier today, so "last known location" has something to show.
    const old = new Date(Date.now() - 42 * 60_000).toISOString();
    r = {
      session: null,
      lastFix: personId === 'p-01' ? { lat: MOCK_HOME.lat + 0.0011, lng: MOCK_HOME.lng + 0.0008, at: old } : null,
      gps: 'idle',
      log: [],
    };
    state.set(personId, r);
  }
  return r;
}

/** Adds a log line (newest first, keeps the last 30). */
function log(r: PersonTracking, who: string, what: string) {
  r.log = [{ at: new Date().toISOString(), who, what }, ...r.log].slice(0, 30);
}

const wait = (ms = 500) => new Promise((res) => setTimeout(res, ms));

interface TrackingCtx {
  get: (personId: string) => PersonTracking;
  /** Can this phone see the LIVE position right now? */
  canViewLive: (personId: string, phone: string | undefined) => boolean;
  start: (personId: string, opts: { reason: TrackReason; minutes: number; shareWith: string[] }, me: Actor) => Promise<void>;
  stop: (personId: string, me: Actor) => Promise<void>;
  setViewer: (personId: string, phone: string, name: string, allowed: boolean, me: Actor) => Promise<void>;
  logView: (personId: string, me: Actor) => void;
  simulateNoFix: (personId: string, on: boolean) => void;
  isNoFix: (personId: string) => boolean;
}

const Ctx = createContext<TrackingCtx | null>(null);

// Demo stand-in (team decision, 14 Nov): the band has no GPS, so a phone carried with it supplies the position.
// That phone runs simulator/phone-gps.js's page; the laptop keeps its latest fix and this app reads it from API_URL.
// If the laptop can't be reached, the SAMPLE walk below is used, labelled as sample.
let phoneFix: LocationFix | null = null;
function startPhoneGps() {
  const token = accessToken();
  if (!token) return; // only a signed-in carer may read the position
  // ngrok's free tunnel shows a warning page to browser requests unless this header is set.
  fetch(`${API_URL}/api/phone-location`, { headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': '1' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (j && typeof j.lat === 'number' && typeof j.lng === 'number') phoneFix = { lat: j.lat, lng: j.lng, at: j.at };
    })
    .catch(() => {}); // laptop unreachable: keep the last fix (it ages to "Last known") or the SAMPLE walk
}
/** true once the phone has given a real position (screen shows "PHONE GPS" instead of "SAMPLE GPS"). */
export const usingPhoneGps = () => phoneFix !== null;
/** Provider. A 5 s tick moves the fake person, flips GPS status and auto-stops expired sessions. */
export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      state.forEach((r, personId) => {
        const s = r.session;
        if (!s) return;
        if (now >= new Date(s.endsAt).getTime()) {
          // Rule 4: stop automatically.
          r.session = null;
          r.gps = 'idle';
          log(r, 'LAKAZ', 'Tracking stopped automatically (time limit reached)');
          return;
        }
        if (noFix.has(personId)) {
          r.gps = 'searching'; // no new fixes → freshness ages → screen says "not live"
          return;
        }
        // Why 4 s: a cold GPS needs a moment after waking; this mimics "searching" → "fix".
        if (r.gps === 'searching' && now - new Date(s.startedAt).getTime() < 4000) return;
        r.gps = 'fix';
        startPhoneGps();
        const prev = r.lastFix ?? { ...MOCK_HOME, at: new Date().toISOString() };
        // Phone position when available; otherwise SAMPLE walk: a few metres each tick.
        r.lastFix = phoneFix ?? { lat: prev.lat + 0.00015, lng: prev.lng + 0.0001, at: new Date().toISOString() };
      });
      bump();
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const value = useMemo<TrackingCtx>(
    () => ({
      get: (personId) => ({ ...rec(personId) }),

      canViewLive: (personId, phone) => {
        const s = rec(personId).session;
        return !!s && !!phone && s.viewers.includes(phone);
      },

      // SWAP FOR SUPABASE: insert a tracking session row (RLS: guardians of this person only) + tell the band to wake GPS
      start: async (personId, { reason, minutes, shareWith }, me) => {
        await wait();
        const r = rec(personId);
        if (r.session) throw new Error('Tracking is already on.');
        const startedAt = new Date();
        r.session = {
          reason,
          startedAt: startedAt.toISOString(),
          endsAt: new Date(startedAt.getTime() + minutes * 60_000).toISOString(),
          startedBy: me,
          viewers: Array.from(new Set([me.phone, ...shareWith])),
        };
        r.gps = 'searching'; // GPS just woke up
        log(
          r,
          me.name,
          `Started live tracking (${reason === 'incident' ? 'incident' : 'agreed check-in'}, ${minutes} min, ${r.session.viewers.length} can see)`,
        );
        bump();
      },

      // SWAP FOR SUPABASE: end the session row + tell the band GPS can sleep again
      stop: async (personId, me) => {
        await wait();
        const r = rec(personId);
        if (!r.session) return;
        r.session = null;
        r.gps = 'idle';
        log(r, me.name, 'Stopped live tracking');
        bump();
      },

      // Rule 3: only the person who started it can change who sees it.
      setViewer: async (personId, phone, name, allowed, me) => {
        await wait(300);
        const r = rec(personId);
        const s = r.session;
        if (!s) throw new Error('Tracking is off.');
        if (s.startedBy.phone !== me.phone) throw new Error(`Only ${s.startedBy.name} (who started tracking) can change this.`);
        if (phone === s.startedBy.phone) throw new Error('The person who started tracking always sees it.');
        s.viewers = allowed ? Array.from(new Set([...s.viewers, phone])) : s.viewers.filter((p) => p !== phone);
        log(r, me.name, `${allowed ? 'Allowed' : 'Removed'} ${name} ${allowed ? 'to see' : 'from'} live location`);
        bump();
      },

      // Rule 5: viewing is logged too.
      logView: (personId, me) => {
        const r = rec(personId);
        if (!r.session) return;
        log(r, me.name, 'Viewed live location');
        bump();
      },

      simulateNoFix: (personId, on) => {
        if (on) noFix.add(personId);
        else noFix.delete(personId);
        bump();
      },
      isNoFix: (personId) => noFix.has(personId),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Hook for the location screen. */
export function useTracking() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTracking must be used inside <TrackingProvider>');
  return v;
}
