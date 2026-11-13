/**
 * store.tsx — the app's single source of data (alerts, device status, connection mode).
 * Owner: Person 3 (Fahim, Zuhayr).
 *
 * Two modes:
 *  - MOCK (USE_MOCK=true): SIMULATED data + a fake demo-mode escalation ladder. No backend needed.
 *  - LIVE: loads from the REST endpoints, then listens to Socket.IO events
 *    `status:update`, `alert:new`, `alert:update` (section 7.4).
 * Screens only call useLakaz(); they never know which mode is running, except to show the label.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import { API_URL, DEMO_DEVICE_ID, USE_MOCK } from '@/config';
import * as api from '@/data/api';
import {
  ME,
  mockDevice,
  mockHistory,
  mockLevelFor,
  mockNewAlert,
  mockStatusHome,
  mockWalk,
} from '@/data/mock';
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
  /** Caregiver using this phone (demo login). */
  me: { id: string; name: string } | null;
}

interface LakazActions {
  acknowledge: (id: string) => Promise<void>;
  resolve: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  dismissIncoming: () => void;
  login: () => void;
  logout: () => void;
  /** SIMULATED buttons — only work in mock mode (the real band/simulator page drives live mode). */
  sim: { leaveHome: () => void; sos: () => void; backHome: () => void; reset: () => void };
}

const Ctx = createContext<(LakazState & LakazActions) | null>(null);

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
  const socketRef = useRef<Socket | null>(null);

  /** Loads everything from the backend once (LIVE mode). */
  const refresh = useCallback(async () => {
    if (USE_MOCK) return;
    try {
      const [a, s, d] = await Promise.all([
        api.fetchAlerts(),
        api.fetchStatus(DEMO_DEVICE_ID),
        api.fetchDevices().catch(() => [] as Device[]),
      ]);
      setAlerts(a.sort((x, y) => y.created_at.localeCompare(x.created_at)));
      setStatus(s);
      setDevice(d.find((x) => x.device_id === DEMO_DEVICE_ID) ?? null);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ---------- LIVE mode: REST + Socket.IO ----------
  useEffect(() => {
    if (USE_MOCK) return;
    refresh();
    // Why both transports: websocket is fastest, polling still works if a hotspot blocks websockets.
    const socket = io(API_URL, { transports: ['websocket', 'polling'], reconnectionDelay: 1000 });
    socketRef.current = socket;
    socket.on('connect', () => {
      setMode('live');
      refresh(); // catch up on anything missed while disconnected
    });
    socket.on('disconnect', () => setMode('disconnected'));
    socket.on('connect_error', (e) => {
      setMode('disconnected');
      setError(`Can't reach ${API_URL} (${e.message}). Same hotspot? Firewall allows port 3000?`);
      setLoading(false);
    });
    socket.on('status:update', (s: DeviceStatus) => setStatus(s));
    socket.on('alert:new', (a: Alert) => {
      setAlerts((l) => upsert(l, a));
      setIncoming(a);
    });
    socket.on('alert:update', (a: Alert) => {
      setAlerts((l) => {
        const old = l.find((x) => x.alert_id === a.alert_id);
        // Pop the banner again only when the ladder climbs — not for every location update.
        if (old && a.level > old.level && a.status !== 'Acknowledged') setIncoming(a);
        return upsert(l, a);
      });
    });
    return () => {
      socket.disconnect();
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
      // Fake heartbeat every 5 s, like the real band (section 6, Person 1).
      if (tick % 5 === 0) setDevice((d) => (d ? { ...d, last_seen: new Date().toISOString() } : d));
      setAlerts((list) =>
        list.map((a) => {
          if (a.status === 'Resolved') return a;
          const secs = (Date.now() - new Date(a.created_at).getTime()) / 1000;
          const next = mockLevelFor(a, secs);
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
    const a = await api.ackAlert(id, me?.id ?? ME.id);
    setAlerts((l) => upsert(l, a));
  }, [me]);

  /** Marks an alert Resolved (person is safe). */
  const resolve = useCallback(async (id: string) => {
    if (USE_MOCK) {
      setAlerts((l) => l.map((a) => (a.alert_id === id ? { ...a, status: 'Resolved' } : a)));
      setStatus(mockStatusHome());
      return;
    }
    const a = await api.resolveAlert(id);
    setAlerts((l) => upsert(l, a));
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

  /** SIMULATED: band hears the anchor again → every open alert Resolved. */
  const backHome = useCallback(() => {
    setAlerts((l) => l.map((a) => (a.status === 'Resolved' ? a : { ...a, status: 'Resolved' })));
    setStatus(mockStatusHome());
    setDevice((d) => (d ? { ...d, gps_fix: false } : d));
    setIncoming(null);
  }, []);

  /** SIMULATED: start the demo again from a calm state. */
  const reset = useCallback(() => {
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
      acknowledge,
      resolve,
      refresh,
      dismissIncoming: () => setIncoming(null),
      login: () => setMe({ id: ME.id, name: ME.name }),
      logout: () => setMe(null),
      sim: { leaveHome, sos, backHome, reset },
    }),
    [alerts, status, device, mode, loading, error, incoming, me, acknowledge, resolve, refresh, leaveHome, sos, backHome, reset],
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
