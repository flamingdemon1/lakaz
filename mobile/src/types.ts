/**
 * types.ts — TypeScript shapes for the LAKAZ shared contract (team file, section 7).
 * Owner: Person 3 (Fahim, Zuhayr). Field names MUST match section 7 exactly — never rename.
 * If the backend changes a field, the whole team must agree and log it (section 13).
 */

/** Alert statuses (section 7.2). */
export type AlertStatus = 'Critical' | 'Active' | 'Acknowledged' | 'Resolved';

/**
 * Alert types the app shows (section 7.2). `fall` is TBD, so it is not listed.
 * Dropped by team decision (13 Nov): `low_battery` (the band can't measure its battery yet) and
 * `possible_removal` (was never in the contract). Add them back only if the band really reports them.
 */
export type AlertType = 'unexpected_exit' | 'sos' | 'device_offline';

/** Escalation level: 0 band only · 1 primary · 2 secondary + tracking · 3 community. */
export type AlertLevel = 0 | 1 | 2 | 3;

/** A location fix. `at` is an ISO time string set by the backend. */
export interface LastLocation {
  lat: number;
  lng: number;
  at: string;
}

/** Alert object pushed by the backend (section 7.2). */
export interface Alert {
  alert_id: string;
  person_id: string;
  device_id: string;
  type: AlertType;
  level: AlertLevel;
  status: AlertStatus;
  created_at: string;
  acknowledged_by: string | null;
  last_location: LastLocation | null;
  /** true = last fix is less than 60 s old (computed by the backend). */
  location_fresh: boolean;
  /** Server time the band was heard at home again (unexpected_exit only); null/absent while still away. */
  resolved_at?: string | null;
}

/** GET /api/devices/:id/status → { status, person_name, since, level } (section 7.3). */
export interface DeviceStatus {
  /** e.g. "HOME" or "LEFT HOME" — same text the anchor LCD shows. Exact values: confirm with backend. */
  status: string;
  person_name: string;
  since: string;
  level: AlertLevel | null;
}

/**
 * ASSUMED shape for GET /api/devices — section 7 doesn't list its fields yet.
 * Confirm with Shihad/Inshiraah before relying on it. Only the field names from 7.1 are certain.
 */
export interface Device {
  device_id: string;
  battery_pct: number | null;
  /** ISO time of the last heartbeat. Offline = no heartbeat for 20 s (section 7.2). */
  last_seen: string | null;
  gps_fix: boolean | null;
}

/** ASSUMED shape for GET /api/people — confirm with backend. */
export interface Person {
  person_id: string;
  name: string;
  age: number;
  area: string;
  profile: 'Elderly' | 'Child';
  device_id: string;
}

/** How the app is currently getting its data — shown in the UI so we never lie about "live". */
export type ConnectionMode = 'mock' | 'connecting' | 'live' | 'disconnected';
