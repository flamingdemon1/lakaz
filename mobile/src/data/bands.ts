/** Linked band reader and polling hook. Owner: Fahim. Never selects device secrets. */
import { useEffect, useState } from 'react';
import { POLL_MS, SUPABASE_ENABLED } from '@/config';
import { isSignedIn, select, currentUser } from '@/data/supabase';

export interface Band {
  id: string;
  label: string | null;
  wearer_name: string | null;
  wearer_age: number | null;
  wearer_area: string | null;
  last_seen: string | null;
  home_state: 'home' | 'away' | null;
  home_since: string | null;
}

/** Takes no inputs. Returns linked bands under RLS, with null fields on older schemas. */
export async function fetchBands(): Promise<Band[]> {
  // Try progressively older schemas, retaining wearer details when only home-state columns are absent.
  const projections = [
    'id,label,wearer_name,wearer_age,wearer_area,last_seen,home_state,home_since',
    'id,label,wearer_name,wearer_age,wearer_area,last_seen',
    'id,label',
    'id',
  ];
  for (const fields of projections) {
    try {
      const rows = await select<Partial<Band>[]>('devices?select=' + fields + '&order=id');
      return rows.map((row) => ({
        id: row.id!, label: row.label ?? null, wearer_name: row.wearer_name ?? null,
        wearer_age: row.wearer_age ?? null, wearer_area: row.wearer_area ?? null,
        last_seen: row.last_seen ?? null, home_state: row.home_state ?? null,
        home_since: row.home_since ?? null,
      }));
    } catch (error) {
      if (!/column.*does not exist|could not find.*column|schema cache/i.test(String(error))) throw error;
    }
  }
  return [];
}

/** Takes linked rows and an optional UUID. Returns that band or the most recently heard named wearer. */
export function pickBand(rows: Band[], deviceId?: string): Band | null {
  if (deviceId) return rows.find((row) => row.id === deviceId) ?? null;
  const named = rows.filter((row) => row.wearer_name?.trim());
  // Invalid or absent dates rank last; ties retain the server's deterministic ID order.
  const latest = [...named].sort((a, b) =>
    (Date.parse(b.last_seen ?? '') || 0) - (Date.parse(a.last_seen ?? '') || 0));
  return latest[0] ?? rows[0] ?? null;
}

/** Takes an optional band ID. Returns the matching band, request state and error, polling every 5 s. */
export function useBand(deviceId?: string) {
  const [band, setBand] = useState<Band | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    /** Fetches linked rows, guards account changes and schedules the next non-overlapping request. */
    async function poll() {
      const userId = currentUser()?.id;
      try {
        const rows = SUPABASE_ENABLED && isSignedIn() ? await fetchBands() : [];
        if (cancelled || currentUser()?.id !== userId) return;
        setBand(pickBand(rows, deviceId));
        setError(null);
      } catch (reason) {
        if (!cancelled) {
          setBand(null); // A failed request cannot establish current band reports.
          setError(String(reason));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = setTimeout(poll, POLL_MS);
        }
      }
    }
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [deviceId]);
  return { band, loading, error };
}
