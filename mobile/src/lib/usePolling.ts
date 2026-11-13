/**
 * usePolling.ts — runs a function every N ms while the app is open and in the foreground.
 * Owner: Person 3 (Zuhayr).
 * Why polling: agreed with Shihad as the first way to get new alerts from Supabase "while the app is open".
 * No background notifications are promised (Expo Go can't do remote push).
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Inputs: `fn` to run, `everyMs` interval (default 5 s), `enabled` switch.
 * Output: none. Runs once immediately, then on the interval; pauses when the app goes to background.
 */
export function usePolling(fn: () => void | Promise<void>, everyMs = 5000, enabled = true) {
  // Keep the newest fn in a ref so the timer doesn't restart every render.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      fnRef.current();
      timer = setInterval(() => fnRef.current(), everyMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    start();
    // Why: polling in the background wastes battery/data and the OS may kill it anyway.
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? start() : stop()));
    return () => {
      stop();
      sub.remove();
    };
  }, [everyMs, enabled]);
}
