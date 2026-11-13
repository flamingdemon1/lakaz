/**
 * facilities.ts — read-only lookup of Mauritian health facilities, filtered by district.
 * Owner: Person 3 (Zuhayr). Backend owner: Shihad (migration 20261113180000_create_facilities.sql).
 *
 * Data: public.facilities in Supabase — 169 records from Open Data Mauritius
 * ("Locations of hospitals, clinics, medi-clinics, Area Health Centres and Community Health Centres",
 * Mauritius Digital Promotion Agency, CC BY-SA 4.0). Fields: id, name, type, district, source_url.
 * RLS: only signed-in users can read; nobody can write from the app.
 *
 * Why it's separate from helpAlert.ts: the handoff says the lookup must not be able to break the alert flow.
 * Why there is NO sample mode: inventing facility names in a safety app is worse than showing nothing.
 */
import { SUPABASE_ENABLED } from '@/config';
import * as supa from '@/data/supabase';

/** One facility row (field names are the backend's — never rename). */
export interface Facility {
  id: number;
  name: string;
  type: string;
  district: string;
  source_url: string;
}

/**
 * The nine district values EXACTLY as stored in Supabase (backend/README.md).
 * Why exact: the query uses district=eq.<value>; "Plaines Wilhems" ≠ "Plaines Wilhems district".
 */
export const DISTRICTS = [
  'Black River',
  'Flacq',
  'Grand Port',
  'Moka',
  'Pamplemousses',
  'Plaines Wilhems',
  'Port Louis',
  'Riviere du Rempart',
  'Savanne',
] as const;
export type District = (typeof DISTRICTS)[number];

/** Dataset credit shown under the list (licence requires attribution). */
export const DATASET_CREDIT = 'Open Data Mauritius · Mauritius Digital Promotion Agency · CC BY-SA 4.0';

/** Why the lookup can't run, as a code the screen turns into the right message. */
export const FACILITIES_NOT_CONNECTED = 'Facility lookup needs the Supabase connection (mobile/.env).';
export const FACILITIES_NOT_SIGNED_IN = 'Sign in with your carer account to look up facilities.';

/**
 * Loads all facilities in one district, sorted by name.
 * Input: a district value from DISTRICTS. Output: Facility[] (can be empty).
 * Throws a readable Error (no connection, not signed in, server error, 8 s timeout — see supabase.ts).
 */
export async function fetchFacilities(district: District): Promise<Facility[]> {
  if (!SUPABASE_ENABLED) throw new Error(FACILITIES_NOT_CONNECTED);
  if (!supa.isSignedIn()) throw new Error(FACILITIES_NOT_SIGNED_IN);
  // encodeURIComponent: district names contain spaces ("Plaines Wilhems", "Riviere du Rempart").
  return supa.select<Facility[]>(
    `facilities?select=id,name,type,district,source_url&district=eq.${encodeURIComponent(district)}&order=name.asc`,
  );
}
