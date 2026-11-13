/**
 * useNow.ts — re-renders a component every second so "updated X s ago" keeps counting.
 * Owner: Person 3 (Fahim, Zuhayr).
 */
import { useEffect, useState } from 'react';

/** Returns Date.now(), refreshed every `everyMs` milliseconds (default 1 s). */
export function useNow(everyMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
