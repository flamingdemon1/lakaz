/**
 * store.tsx — the app's single source of data (alerts, device status, connection mode).
 * Owner: Person 3 (Fahim, Zuhayr).
 *
 * Two modes:
 *  - MOCK (USE_MOCK=true): SIMULATED data + a fake demo-mode escalation ladder. No backend needed.
 *  - LIVE (Supabase configured): real help alerts from Supabase public.alerts, re-read every 5 s while signed in
 *    (data/alertsLive.ts). The old plan — a Node REST + Socket.IO server — was replaced by Supabase and never
 *    built, so that code is gone. Only the band's help button exists for real; exits / SOS / offline / GPS
 *    stay SIMULATED in sample mode.
 * Screens only call useLakaz(); they never know which mode is running, except to show the label.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { POLL_MS, USE_MOCK } from '@/config';
import { acknowledgeLive, fetchCarerNames, fetchHomeState, fetchLiveAlerts, HomeState, resolveLive } from '@/data/alertsLive';
import { NOT_SIGNED_IN, onHelpEventsChanged } from '@/data/helpAlert';
import { fill, STRINGS } from '@/i18n';
import { getCurrentLang } from '@/i18n-auto';
import * as supa from '@/data/supabase';
import {
  ME,
  mockDevice,
  mockHistory,
  mockLevelFor,
  mockNewAlert,
  mockStatusHome,
  mockWalk,
} from '@/data/mock';
import { communityBlockedReason, useEscalation } from '@/data/escalation';
import { useNotify } from '@/data/notify';
import type { Alert, ConnectionMode, Device, DeviceStatus } from '@/types';

interface LakazState {
  alerts: Alert[];
  status: DeviceStatus | null;
  device: Device | null;
  mode: ConnectionMode;
  loading: boolean;
  error: string | null;
  /** The alert that should pop up over every screen right now (new or escalated). */
  incoming: Alert | null;
  /** Caregiver using this phone (demo login, or the signed-in Supabase carer in live mode). */
  me: { id: string; name: string } | null;
  /** LIVE: names of the carers linked to the band, { carer_id: "Sarah" } — for "Acknowledged by Sarah". */
  carerNames: Record<string, string>;
}

interface LakazActions {
  acknowledge: (id: string) => Promise<void>;
  resolve: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  dismissIncoming: () => void;
  login: () => void;
  logout: () => void;
  /** Push an open incident one level up now (SAMPLE mode only). */
  escalateNow: (id: string) => Promise<void>;
  /** SIMULATED buttons — only work in mock mode (the real band/simulator page drives live mode). */
  sim: {
    leaveHome: () => void;
    sos: () => void;
    backHome: () => void;
    reset: () => void;
    deviceOffline: () => void;
  };
}

/** Alerts that take over the whole screen (emergencies). Everything else is a banner. */
export const isTakeover = (a: Alert) => a.type === 'unexpected_exit' || a.type === 'sos';

const Ctx = createContext<(LakazState & LakazActions) | null>(null);

/**
 * LIVE Home status from the real alerts + where the band says she is (the anchor, Kavish's firmware).
 * Priority — the most urgent thing wins:
 *  NEEDS_HELP  = a help press nobody has acknowledged          (red,   since = when it was pressed)
 *  LEFT HOME   = she left home and nobody has acknowledged it    (amber, since = when she left)
 *  HELP_COMING = something is acknowledged but not closed yet     (blue,  since = when it was acknowledged)
 *  LEFT HOME   = the band still says "away" (all handled)          (amber, since = when she left)
 *  HOME        = the band says "home"                              (green, since = when she came back)
 *  ALL_CLEAR   = nothing open and the band hasn't reported home/away (migration not applied yet)
 */
function liveStatus(list: Alert[], home: HomeState | null): DeviceStatus {
  // The band's real wearer (set when a carer adds the person); '' if unknown — screens then omit the name.
  const name = home?.wearer ?? '';
  const waiting = list.filter((a) => a.status === 'Critical');
  const away = list.filter((a) => a.type === 'unexpected_exit' && a.status === 'Active');
  const handling = list.filter((a) => a.status === 'Acknowledged');
  const lastClosed = list.find((a) => a.status === 'Resolved');
  if (waiting.length) return { status: 'NEEDS_HELP', person_name: name, since: waiting[waiting.length - 1].created_at, level: 1 };
  // level null: the real backend has no escalation ladder, so the card mustn't say "step 1".
  if (away.length) return { status: 'LEFT HOME', person_name: name, since: away[away.length - 1].created_at, level: null };
  if (handling.length)
    return { status: 'HELP_COMING', person_name: name, since: handling[0].acknowledged_at ?? handling[0].created_at, level: 1 };
  if (home?.state === 'away') return { status: 'LEFT HOME', person_name: name, since: home.since ?? new Date().toISOString(), level: null };
  if (home?.state === 'home') return { status: 'HOME', person_name: name, since: home.since ?? new Date().toISOString(), level: null };
  return {
    status: 'ALL_CLEAR',
    person_name: name,
    since: lastClosed?.resolved_at ?? lastClosed?.acknowledged_at ?? new Date().toISOString(),
    level: null,
  };
}

/** Puts an alert into the list, replacing the old copy with the same alert_id. Newest first. */
function upsert(list: Alert[], a: Alert): Alert[] {
  const rest = list.filter((x) => x.alert_id !== a.alert_id);
  return [a, ...rest].sort((x, y) => y.created_at.localeCompare(x.created_at));
}

/** Provider that wraps the whole app (see app/_layout.tsx). */
export function LakazProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [mode, setMode] = useState<ConnectionMode>(USE_MOCK ? 'mock' : 'connecting');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<Alert | null>(null);
  const [me, setMe] = useState<LakazState['me']>(null);
  const [carerNames, setCarerNames] = useState<Record<string, string>>({});
  // Latest alerts for the async actions (acknowledge / resolve need the device id of the alert).
  const alertsRef = useRef<Alert[]>([]);
  alertsRef.current = alerts;
  // LIVE: the band's last reported home/away state (for the Home card after acknowledge / resolve).
  const homeRef = useRef<HomeState | null>(null);
  // Latest Home status (for the wearer's name in banners, without re-creating callbacks).
  const statusRef = useRef<DeviceStatus | null>(null);
  statusRef.current = status;
  // LIVE: exit alerts already shown as a takeover, and exits that were open on the previous refresh.
  // null = first load (open exits are shown once, older closed ones are never announced).
  const announcedRef = useRef<Set<string> | null>(null);
  const openExitsRef = useRef<Set<string>>(new Set());
  // SAMPLE: when true the fake heartbeat stops, so the band really looks disconnected (20 s rule).
  const heartbeatPaused = useRef(false);

  // Why a ref: the socket listener is created once, but must always call the newest push().
  const { push } = useNotify();
  // Escalation settings (timers, community rules), read inside the 1 s tick through a ref.
  const esc = useEscalation();
  const escRef = useRef(esc);
  escRef.current = esc;
  const pushRef = useRef(push);
  pushRef.current = push;

  /**
   * Routes a new alert to the right kind of notification:
   * SOS / unexpected exit → full-screen takeover (IncomingAlert); everything else → banner.
   * Why: a disconnected band is important but not an emergency — it must not take over the screen.
   */
  const announce = useCallback((a: Alert, sample: boolean) => {
    if (isTakeover(a)) {
      setIncoming(a);
      return;
    }
    const href = { pathname: '/alert/[id]', params: { id: a.alert_id } };
    const name = statusRef.current?.person_name || '';
    if (a.type === 'device_offline') {
      pushRef.current({ category: 'device_offline', title: `${name}'s band is disconnected`, body: 'No signal for 20 s — check it is charged and in range', href, sample });
    }
  }, []);

  /**
   * LIVE: reacts to what changed since the last refresh.
   *  - A NEW left-home alert nobody has acknowledged → the full-screen wandering takeover (IncomingAlert),
   *    once per alert. (Help presses already have their own takeover: HelpAlertTakeover.)
   *  - An exit that was open and is now closed BY THE BAND (resolved_by null = it heard the anchor again)
   *    → a calm "back home" banner.
   */
  const announceLive = useCallback((list: Alert[]) => {
    const exits = list.filter((a) => a.live && a.type === 'unexpected_exit');
    const first = announcedRef.current === null;
    const seen = announcedRef.current ?? new Set<string>();
    for (const a of exits) {
      if (seen.has(a.alert_id)) continue;
      seen.add(a.alert_id);
      if (a.status === 'Active') setIncoming(a);
    }
    announcedRef.current = seen;
    if (!first) {
      for (const a of exits) {
        if (openExitsRef.current.has(a.alert_id) && a.status === 'Resolved' && !a.resolved_by) {
          pushRef.current({
            category: 'safe_return',
            // Translated here (the store has no hook): "<name> is back home" in the carer's language.
            title: fill(STRINGS[getCurrentLang()].backHomeTitle, { name: homeRef.current?.wearer || STRINGS[getCurrentLang()].heroThem }),
            body: STRINGS[getCurrentLang()].backHomeBody,
            href: { pathname: '/alert/[id]', params: { id: a.alert_id } },
            sample: false,
          });
        }
      }
    }
    openExitsRef.current = new Set(exits.filter((a) => a.status !== 'Resolved').map((a) => a.alert_id));
  }, []);

  /**
   * LIVE: re-reads the carer's alerts from Supabase and works out the Home status from them.
   * Why polling (every 5 s) and not realtime: agreed with Shihad — simpler, works on a hotspot, and the
   * help-alert screens already poll at the same rate.
   */
  const refresh = useCallback(async () => {
    if (USE_MOCK) return;
    try {
      const list = await fetchLiveAlerts();
      const home = await fetchHomeState(list[0]?.device_id);
      homeRef.current = home;
      announceLive(list);
      setAlerts(list);
      setStatus(liveStatus(list, home));
      const user = supa.currentUser();
      setMe(user ? { id: user.id, name: user.user_metadata?.name ?? user.email ?? 'You' } : null);
      // Names only change when someone links/renames, so one band lookup per refresh is plenty.
      if (list[0]) setCarerNames(await fetchCarerNames(list[0].device_id));
      setMode('live');
      setError(null);
    } catch (e) {
      const msg = (e as Error).message;
      // Not signed in is a normal state (login screen), not a connection problem.
      if (msg === NOT_SIGNED_IN) {
        setAlerts([]);
        setStatus(null);
        setMode('live');
      } else {
        setMode('disconnected');
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [announceLive]);

  // ---------- LIVE mode: Supabase, every 5 s + instantly when this phone acknowledges ----------
  useEffect(() => {
    if (USE_MOCK) return;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    const off = onHelpEventsChanged(() => void refresh());
    return () => {
      clearInterval(id);
      off();
    };
  }, [refresh]);

  // ---------- MOCK mode: SIMULATED data + fake ladder ----------
  useEffect(() => {
    if (!USE_MOCK) return;
    setAlerts(mockHistory());
    setStatus(mockStatusHome());
    setDevice(mockDevice());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!USE_MOCK) return;
    let tick = 0;
    const id = setInterval(() => {
      tick += 1;
      // Fake heartbeat every 5 s, like the real band (section 6, Person 1) — unless "disconnected" is simulated.
      if (tick % 5 === 0 && !heartbeatPaused.current) setDevice((d) => (d ? { ...d, last_seen: new Date().toISOString() } : d));
      setAlerts((list) =>
        list.map((a) => {
          if (a.status === 'Resolved') return a;
          const secs = (Date.now() - new Date(a.created_at).getTime()) / 1000;
          // Timers + community rules come from the caregiver's escalation settings (section F).
          const esc = escRef.current;
          const next = mockLevelFor(a, secs, esc.timers, communityBlockedReason(a, esc.settings) === null);
          let updated = a;
          if (next.level !== a.level || next.status !== a.status) {
            updated = { ...a, ...next };
            if (next.level > a.level) setIncoming(updated);
            setStatus((s) => (s ? { ...s, level: next.level } : s));
          }
          // Fake GPS fix every 5 s while the incident is open.
          if (tick % 5 === 0) updated = mockWalk(updated);
          return updated;
        }),
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  /** Marks an alert Acknowledged. LIVE: waits for the server before changing the screen. */
  const acknowledge = useCallback(async (id: string) => {
    if (USE_MOCK) {
      setAlerts((l) =>
        l.map((a) => (a.alert_id === id ? { ...a, status: 'Acknowledged', acknowledged_by: ME.id } : a)),
      );
      return;
    }
    // Why we don't update the UI first: the handoff says "only show success after the server confirms it".
    const current = alertsRef.current.find((a) => a.alert_id === id);
    if (!current) throw new Error('That alert no longer exists.');
    const a = await acknowledgeLive(current);
    setAlerts((l) => {
      const next = upsert(l, a);
      setStatus(liveStatus(next, homeRef.current));
      return next;
    });
  }, []);

  /** Marks an alert Resolved (person is safe). */
  const resolve = useCallback(async (id: string) => {
    if (USE_MOCK) {
      setAlerts((l) => l.map((a) => (a.alert_id === id ? { ...a, status: 'Resolved' } : a)));
      setStatus(mockStatusHome());
      return;
    }
    const current = alertsRef.current.find((a) => a.alert_id === id);
    if (!current) throw new Error('That alert no longer exists.');
    const a = await resolveLive(current);
    setAlerts((l) => {
      const next = upsert(l, a);
      setStatus(liveStatus(next, homeRef.current));
      return next;
    });
  }, []);

  /** SIMULATED: band leaves home → new level-0 alert. */
  const leaveHome = useCallback(() => {
    const a = mockNewAlert('unexpected_exit');
    setAlerts((l) => upsert(l, a));
    setStatus({ status: 'LEFT HOME', person_name: 'Marie-Claire', since: a.created_at, level: 0 });
    setDevice((d) => (d ? { ...d, gps_fix: true } : d));
    setIncoming(a);
  }, []);

  /** SIMULATED: long press on the band = SOS → Critical straight away. */
  const sos = useCallback(() => {
    const a = mockNewAlert('sos');
    setAlerts((l) => upsert(l, a));
    setStatus((s) => (s ? { ...s, level: 3 } : s));
    setIncoming(a);
  }, []);

  /**
   * SIMULATED: band hears the anchor again → open exit/SOS alerts Resolved + SAFE RETURN notification
   * (section 9: "any --back_home--> Resolved + safe-return notification").
   */
  const backHome = useCallback(() => {
    setAlerts((l) => {
      const wasAway = l.some((a) => a.status !== 'Resolved' && isTakeover(a));
      if (wasAway) {
        pushRef.current({ category: 'safe_return', title: 'Marie-Claire is back home', body: 'The alert was closed automatically', href: { pathname: '/' }, sample: true });
      }
      return l.map((a) => (a.status === 'Resolved' || !isTakeover(a) ? a : { ...a, status: 'Resolved' }));
    });
    setStatus(mockStatusHome());
    setDevice((d) => (d ? { ...d, gps_fix: false } : d));
    setIncoming(null);
  }, []);

  /** SIMULATED: heartbeat stops → device_offline alert; the band shows "Offline" after 20 s. */
  const deviceOffline = useCallback(() => {
    heartbeatPaused.current = true;
    const a = mockNewAlert('device_offline');
    setAlerts((l) => upsert(l, a));
    announce(a, true);
  }, [announce]);

  /** SIMULATED: start the demo again from a calm state. */
  /**
   * "Escalate now": a caregiver who can't handle it pushes the incident one level up immediately.
   * SAMPLE only — on the real backend the server owns the ladder (no endpoint for this in section 7.3 yet).
   * Level 3 still obeys the community rules.
   */
  const escalateNow = useCallback(async (id: string) => {
    if (!USE_MOCK) throw new Error('Not available yet: the server controls escalation (needs a backend endpoint).');
    setAlerts((l) =>
      l.map((a) => {
        if (a.alert_id !== id || a.status === 'Resolved' || a.status === 'Acknowledged' || a.level >= 3) return a;
        const allowed = communityBlockedReason(a, escRef.current.settings) === null;
        const level = Math.min(a.level + 1, allowed ? 3 : 2) as Alert['level'];
        if (level === a.level) return a;
        const up = { ...a, level, status: level === 3 ? 'Critical' : a.status } as Alert;
        setIncoming(up);
        return up;
      }),
    );
  }, []);

  const reset = useCallback(() => {
    heartbeatPaused.current = false;
    setAlerts(mockHistory());
    setStatus(mockStatusHome());
    setDevice(mockDevice());
    setIncoming(null);
  }, []);

  const value = useMemo(
    () => ({
      alerts,
      status,
      device,
      mode,
      loading,
      error,
      incoming,
      me,
      carerNames,
      acknowledge,
      resolve,
      refresh,
      dismissIncoming: () => setIncoming(null),
      // Sample login only: in live mode `me` is the signed-in Supabase carer (set by refresh()).
      // LIVE: set `me` NOW from the Supabase session, then load data. Why: the tab layout redirects to /login
      // while `me` is empty, so waiting for refresh() made every first login bounce back ("log in twice" bug).
      login: () => {
        if (USE_MOCK) return setMe({ id: ME.id, name: ME.name });
        const user = supa.currentUser();
        if (user) setMe({ id: user.id, name: user.user_metadata?.name ?? user.email ?? 'You' });
        void refresh();
      },
      logout: () => {
        setMe(null);
        if (!USE_MOCK) {
          setAlerts([]);
          setStatus(null);
        }
      },
      escalateNow,
      sim: { leaveHome, sos, backHome, reset, deviceOffline },
    }),
    [alerts, status, device, mode, loading, error, incoming, me, carerNames, acknowledge, resolve, refresh, escalateNow, leaveHome, sos, backHome, reset, deviceOffline],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Hook used by every screen. Throws if used outside <LakazProvider>. */
export function useLakaz() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLakaz must be used inside <LakazProvider>');
  return v;
}

/** Open = anything not Resolved. Used for the home screen and badge counts. */
export const isOpen = (a: Alert) => a.status !== 'Resolved';
