/**
 * alertsLive.ts — the REAL alert list for Home, Recent alerts and the Incident screen (Supabase public.alerts).
 * Owner: Person 3 (Zuhayr). Backend: migration 20261114020000 (status, resolve_alert, linked_carer_names).
 *
 * Why this file: the store's old "live mode" expected a Node REST + Socket.IO server that was never built
 * (the team chose Supabase). This turns Supabase rows into the app's Alert shape so every screen that reads
 * useLakaz() shows real data. Two kinds are real:
 *  - 'help_requested' — the band's help button (double click)            → app type 'help_requested' (red)
 *  - 'left_home'      — the band lost the home anchor's signal (Kavish)    → app type 'unexpected_exit' (amber);
 *                       closed by the band itself when it hears the anchor again ('back_home', resolved_by = null).
 * SOS long-press, offline alerts, GPS and the ladder stay SIMULATED (sample mode only).
 *
 * Safe rollout: each newer column is optional. If Supabase doesn't have it yet, we drop it from the query and
 * work out the status from the timestamps instead, so the app never breaks before Shihad applies a migration.
 */
import { DEMO_DEVICE_ID } from '@/config';
import * as supa from '@/data/supabase';
import { acknowledgeAlert, NOT_SIGNED_IN } from '@/data/helpAlert';
import type { Alert } from '@/types';

/** One row of public.alerts. The last four fields only exist once the migrations are applied. */
interface AlertRow {
  device_id: string;
  event_id: string;
  kind: string;
  received_at: string;
  acknowledged_at: string | null;
  acknowledged_by?: string | null;
  status?: 'open' | 'acknowledged' | 'resolved';
  resolved_at?: string | null;
  resolved_by?: string | null;
}

// Columns we try, newest first. A column is dropped for good once Supabase says it doesn't exist.
const BASE = ['device_id', 'event_id', 'kind', 'received_at', 'acknowledged_at'];
let optional = ['acknowledged_by', 'status', 'resolved_at', 'resolved_by'];

/**
 * Supabase row → app Alert. alert_id = the event's UUID (unique per event), so /alert/[id] links work.
 * Status: resolved → Resolved, acknowledged → Acknowledged, otherwise Critical (red: someone pressed for help).
 */
export function toAlert(r: AlertRow): Alert {
  const resolved = r.status === 'resolved' || !!r.resolved_at;
  const exit = r.kind === 'left_home';
  return {
    alert_id: r.event_id,
    person_id: 'p-01', // one wearer in the demo; the wearer's real details come from devices (Fahim's migration)
    device_id: r.device_id || DEMO_DEVICE_ID,
    type: exit ? 'unexpected_exit' : 'help_requested',
    level: 1, // the real backend has no ladder yet: every linked carer sees the alert at once
    // Colour code: a help press is an emergency (red); leaving home needs attention soon (amber).
    status: resolved ? 'Resolved' : r.acknowledged_at ? 'Acknowledged' : exit ? 'Active' : 'Critical',
    live: true,
    created_at: r.received_at,
    acknowledged_by: r.acknowledged_by ?? null,
    acknowledged_at: r.acknowledged_at,
    resolved_at: r.resolved_at ?? null,
    resolved_by: r.resolved_by ?? null,
    last_location: null, // the band has no GPS
    location_fresh: false,
  };
}

/**
 * Loads the signed-in carer's alerts, newest first (RLS returns only bands linked to this carer).
 * Throws NOT_SIGNED_IN when nobody is signed in.
 */
export async function fetchLiveAlerts(): Promise<Alert[]> {
  if (!supa.isSignedIn()) throw new Error(NOT_SIGNED_IN);
  // Retry with fewer columns while Supabase reports a missing one (at most once per optional column).
  for (;;) {
    const cols = [...BASE, ...optional].join(',');
    try {
      const rows = await supa.select<AlertRow[]>(`alerts?select=${cols}&order=received_at.desc&limit=50`);
      return rows.map(toAlert);
    } catch (e) {
      const msg = (e as Error).message;
      const missing = optional.find((c) => msg.includes(c));
      if (!missing) throw e;
      optional = optional.filter((c) => c !== missing);
    }
  }
}

/** Where the band says she is right now (devices.home_state / home_since, from the band's anchor). */
export interface HomeState {
  state: 'home' | 'away';
  since: string | null;
}

let hasHomeState = true;

/**
 * Reads the band's home/away state. Never throws: returns null until migration 20261114030000 is applied
 * (Shihad) or when the band hasn't reported yet — Home then falls back to the alert-only states.
 */
export async function fetchHomeState(deviceId?: string): Promise<HomeState | null> {
  if (!hasHomeState || !supa.isSignedIn()) return null;
  try {
    const rows = await supa.select<{ id: string; home_state: 'home' | 'away' | null; home_since: string | null }[]>(
      'devices?select=id,home_state,home_since',
    );
    const row = (deviceId ? rows.find((r) => r.id === deviceId) : undefined) ?? rows.find((r) => r.home_state) ?? null;
    return row?.home_state ? { state: row.home_state, since: row.home_since } : null;
  } catch (e) {
    // Missing columns = migration not applied yet: stop asking (one failed request, not one every 5 s).
    if (/home_state|home_since/i.test((e as Error).message)) hasHomeState = false;
    return null;
  }
}

/** Splits our alert_id (event UUID) back into the RPC's arguments using the alert itself. */
const args = (a: Alert) => ({ p_device_id: a.device_id, p_event_id: a.alert_id });

/** "I've got it" — same RPC as Help alerts (and it tells the help-alert screens to refresh). */
export async function acknowledgeLive(a: Alert): Promise<Alert> {
  const row = await acknowledgeAlert(a.device_id, a.alert_id);
  return toAlert({ ...(row as AlertRow) });
}

/** "She is safe — close alert" — RPC resolve_alert. Only resolves after the server confirms. */
export async function resolveLive(a: Alert): Promise<Alert> {
  if (!supa.isSignedIn()) throw new Error(NOT_SIGNED_IN);
  const row = await supa.rpc<AlertRow>('resolve_alert', args(a));
  return toAlert(row);
}

/**
 * Names of the carers linked to a band: { carer_id: "Sarah" }. RPC linked_carer_names.
 * Never throws: returns {} until the migration is applied, and the screens say "another carer" instead.
 */
export async function fetchCarerNames(deviceId: string): Promise<Record<string, string>> {
  if (!supa.isSignedIn()) return {};
  try {
    const rows = await supa.rpc<{ carer_id: string; name: string | null }[]>('linked_carer_names', { p_device_id: deviceId });
    return Object.fromEntries(rows.filter((r) => r.name).map((r) => [r.carer_id, r.name as string]));
  } catch {
    return {};
  }
}
