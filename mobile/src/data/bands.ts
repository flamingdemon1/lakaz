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
}

/** Takes no inputs. Returns linked bands under RLS, with null fields on older schemas. */
export async function fetchBands(): Promise<Band[]> {
  try {
    return await select<Band[]>('devices?select=id,label,wearer_name,wearer_age,wearer_area,last_seen&order=id');
  } catch (error) {
    // Only schema errors should fall back. Network and authentication failures remain visible.
    if (!/column.*does not exist|could not find.*column|schema cache/i.test(String(error))) throw error;
    let rows: { id: string; label?: string | null }[];
    try {
      rows = await select('devices?select=id,label&order=id');
    } catch (fallbackError) {
      if (!/column.*does not exist|could not find.*column|schema cache/i.test(String(fallbackError))) throw fallbackError;
      rows = await select('devices?select=id&order=id');
    }
    return rows.map((row) => ({
      id: row.id, label: row.label ?? null, wearer_name: null,
      wearer_age: null, wearer_area: null, last_seen: null,
    }));
  }
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
        setBand((deviceId ? rows.find((row) => row.id === deviceId) : rows[0]) ?? null);
        setError(null);
      } catch (reason) {
        if (!cancelled) {
          setBand(null); // A failed request cannot establish that a device is online.
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
