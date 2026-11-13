/**
 * nav.ts — navigation helper for moving between "logged out" and "logged in".
 * Owner: Person 3 (Zuhayr).
 * Why: plain router.replace() only swaps the TOP screen. After log out → log in → log out, old login
 * screens piled up underneath (found in testing), so "Back" went to a stale form. resetTo() clears first.
 */
import { router } from 'expo-router';

/** Clears the screen stack, then shows `path` (e.g. '/login' after log out, '/' after log in). */
export function resetTo(path: '/' | '/login' | '/verify') {
  if (router.canDismiss()) router.dismissAll();
  router.replace(path);
}
