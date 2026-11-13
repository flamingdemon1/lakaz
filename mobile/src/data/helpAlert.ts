/**
 * helpAlert.ts — the help alert + acknowledgement flow agreed with the backend (docs/handoff.md).
 * Owner: Person 3 (Zuhayr). Backend owners: Shihad, Inshiraah.
 *
 * Shape agreed with Shihad (13 Nov): { event_id, device_id, kind, received_at, acknowledged_at }.
 * Acknowledge = Supabase RPC acknowledge_alert(p_device_id, p_event_id). We do NOT send acknowledged_by:
 * Supabase uses the signed-in carer's identity and checks they are linked to the device.
 *
 * Two modes, picked automatically from mobile/.env (see config.ts SUPABASE_ENABLED):
 *  - LIVE: real rows from Supabase table public.alerts + RPC acknowledge_alert (carer must be signed in).
 *  - SAMPLE: fictional rows in this file (when the Supabase key isn't set).
 * The screens are identical in both modes.
 */
import { SUPABASE_ENABLED } from '@/config';
import * as supa from '@/data/supabase';


/** One help request from the band (field names are the backend's — never rename). */
export interface HelpEvent {
  /** UUID, unique per event, chosen by the device (reused on retry). */
  event_id: string;
  /** UUID of the device that sent it. */
  device_id: string;
  kind: 'help_requested';
  /** Server time the backend received it (ISO). */
  received_at: string;
  /** Server time a linked carer acknowledged it, or null if nobody has yet. */
  acknowledged_at: string | null;
}

/**
 * true = SAMPLE data (label shown). false = real Supabase data.
 * Automatic: real only when mobile/.env has a valid EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY.
 */
export const IS_SAMPLE = !SUPABASE_ENABLED;

/** Fictional sample rows (clearly labelled in the UI). UUIDs are made up. */
function initialSample(): HelpEvent[] {
  const now = Date.now();
  return [
    {
      event_id: '3f1c2a9e-7b4d-4e8a-9c21-5d6e7f8a9b10',
      device_id: 'b7e4c0d2-1a3f-4c5e-8d9a-0f1e2d3c4b5a',
      kind: 'help_requested',
      received_at: new Date(now - 45_000).toISOString(),
      acknowledged_at: null,
    },
  ];
}

// Pretend database. Kept at module level so the acknowledgement survives leaving and
// re-opening the screen — like the real "verify after refreshing" check in the handoff.
let sampleDb: HelpEvent[] = initialSample();

/** Simulated network delay, so the loading state is visible like on a real hotspot. */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- Change listeners ----
// Why: the takeover and the list screen each poll every 5 s. When THIS phone acknowledges,
// we tell every open screen at once so they don't disagree for up to 5 s.
type Listener = () => void;
const listeners = new Set<Listener>();

/** Subscribe to "help events changed on this phone". Returns an unsubscribe function. */
export function onHelpEventsChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Tells all subscribers to reload. */
const notify = () => listeners.forEach((fn) => fn());

/**
 * Loads the carer's help events, newest first.
 * LIVE: public.alerts — row-level security returns ONLY alerts of bands linked to this carer.
 * Why limit=50: the list screen never needs more, and it keeps each 5 s poll small on a hotspot.
 */
export async function fetchHelpEvents(): Promise<HelpEvent[]> {
  if (!IS_SAMPLE) {
    if (!supa.isSignedIn()) throw new Error(NOT_SIGNED_IN);
    return supa.select<HelpEvent[]>('alerts?select=device_id,event_id,kind,received_at,acknowledged_at&order=received_at.desc&limit=50');
  }
  await wait(400);
  return [...sampleDb].sort((a, b) => b.received_at.localeCompare(a.received_at)).map((e) => ({ ...e }));
}

/** Message shown when Supabase is on but no carer is signed in. */
export const NOT_SIGNED_IN = 'Sign in with your carer account to see real alerts.';

/**
 * Acknowledges one event and returns the UPDATED row from the "server".
 * Inputs: device_id and event_id (both UUIDs from the alert). Output: the updated HelpEvent.
 * Throws if the operation fails — the caller must only show "Acknowledged" after this resolves.
 * A second call keeps the ORIGINAL acknowledged_at (backend rule: a retry must not reset the timestamp).
 *
 * LIVE: RPC acknowledge_alert(p_device_id, p_event_id) — no acknowledged_by is sent; Supabase uses the
 * signed-in carer (auth.uid()) and rejects carers not linked to the band.
 * `failNext` exists only to test the error state in the sample.
 */
export async function acknowledgeAlert(p_device_id: string, p_event_id: string, failNext = false): Promise<HelpEvent> {
  if (!IS_SAMPLE) {
    if (!supa.isSignedIn()) throw new Error(NOT_SIGNED_IN);
    const row = await supa.rpc<HelpEvent>('acknowledge_alert', { p_device_id, p_event_id });
    notify();
    return row;
  }
  await wait(700);
  if (failNext) throw new Error('Sample failure: the server did not confirm. Nothing was saved.');
  const row = sampleDb.find((e) => e.device_id === p_device_id && e.event_id === p_event_id);
  if (!row) throw new Error('Alert not found for this device.');
  if (!row.acknowledged_at) row.acknowledged_at = new Date().toISOString(); // server time in the real RPC
  notify();
  return { ...row };
}

/** SAMPLE ONLY: adds a new unacknowledged help request so the flow can be shown again. */
export function addSampleHelpEvent(): void {
  const rand = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  sampleDb.push({
    event_id: `${rand()}${rand()}-${rand()}-4${rand().slice(1)}-a${rand().slice(1)}-${rand()}${rand()}${rand()}`,
    device_id: 'b7e4c0d2-1a3f-4c5e-8d9a-0f1e2d3c4b5a',
    kind: 'help_requested',
    received_at: new Date().toISOString(),
    acknowledged_at: null,
  });
  notify();
}

/** SAMPLE ONLY: back to the starting state for rehearsals. */
export function resetSampleHelpEvents(): void {
  sampleDb = initialSample();
  notify();
}
