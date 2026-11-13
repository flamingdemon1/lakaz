/**
 * format.ts — turns raw contract values into words a worried caregiver understands.
 * Owner: Person 3/4 (Fahim, Zuhayr). Keep wording calm, short and honest.
 */
import { FRESH_MS, OFFLINE_MS } from '@/config';
import type { Alert, AlertLevel, AlertType, Device } from '@/types';

/** Milliseconds since an ISO time (0 if missing or in the future). */
export function ageMs(iso: string | null | undefined, now = Date.now()): number {
  if (!iso) return Infinity;
  return Math.max(0, now - new Date(iso).getTime());
}

/**
 * "12 s ago", "3 min ago", "2 h ago".
 * Why we always show this: old location must never look "live" (team rule).
 */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  const ms = ageMs(iso, now);
  if (!isFinite(ms)) return 'never';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ago`;
}

/** Clock time like "09:41" in the phone's locale. */
export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * Is this location fresh? Uses the 60 s rule (section 7.2).
 * We recompute on the phone too, because `location_fresh` from the server goes stale
 * if the socket stops sending updates.
 */
export function isFresh(alert: Alert, now = Date.now()): boolean {
  return !!alert.last_location && alert.location_fresh && ageMs(alert.last_location.at, now) < FRESH_MS;
}

/** Offline = no heartbeat for 20 s (section 7.2). */
export const isOnline = (d: Device | null, now = Date.now()) => !!d && ageMs(d.last_seen, now) < OFFLINE_MS;

/** Human title for each alert type. */
export const alertTitle: Record<AlertType, string> = {
  unexpected_exit: 'Left home',
  sos: 'SOS pressed',
  device_offline: 'Band disconnected',
};

/** One-line explanation for each alert type. */
export const alertExplainer: Record<AlertType, string> = {
  unexpected_exit: 'The band lost the home signal. GPS is now on.',
  sos: 'The SOS button on the band was held down.',
  device_offline: 'The band is disconnected.',
  // Honest wording: we have no skin sensor, so this is a guess from "no movement" (team file, known clashes).
};

/** What the caregiver should do next, per alert type (short, practical, no medical advice). */
export const alertAdvice: Record<AlertType, string> = {
  unexpected_exit: 'Call them, then check the map. Tap "I\'ve got it" so others know you are handling it.',
  sos: 'Call them now. If you cannot reach them, call 999.',
  device_offline: 'Check the band is charged and near the home Wi-Fi/hotspot. Call them if they are out.',
};

/** Only these alert types climb the escalation ladder (section 9). */
export const ESCALATING: AlertType[] = ['unexpected_exit', 'sos'];

/** Escalation ladder steps (section 9). Labels used by the ladder component. */
export const ladderSteps: { level: AlertLevel; title: string; detail: string; demo: string; real: string }[] = [
  { level: 0, title: 'Band buzzes', detail: 'Kreol voice prompt plays', demo: '0 s', real: '0 min' },
  { level: 1, title: 'Primary caregiver', detail: 'In-app alert + sound', demo: '10 s', real: '2 min' },
  { level: 2, title: 'Secondary caregiver', detail: 'Live tracking opens', demo: '25 s', real: '7 min' },
  { level: 3, title: 'Community alert', detail: 'Verified nearby responders', demo: '45 s', real: '15 min' },
];

/** Friendly words for the device status string (same text as the anchor LCD). */
export function homeStatusWords(status: string | undefined): { title: string; tone: 'calm' | 'alert' | 'unknown' } {
  const s = (status ?? '').toUpperCase().replace('_', ' ');
  if (s === 'HOME') return { title: 'At home', tone: 'calm' };
  if (s === 'LEFT HOME' || s === 'AWAY') return { title: 'Left home', tone: 'alert' };
  return { title: status || 'Unknown', tone: 'unknown' };
}
