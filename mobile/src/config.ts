/**
 * config.ts — every setting that changes between the laptop, the hotspot and demo day.
 * Owner: Person 3 (Fahim, Zuhayr).
 *
 * Values come from mobile/.env (copy .env.example). Expo only exposes variables that start
 * with EXPO_PUBLIC_, and it bakes them in when `npx expo start` runs —
 * so after changing .env you MUST stop and restart Expo.
 */

/**
 * Backend base URL, e.g. http://192.168.43.20:3000
 * Why one constant: the laptop's IP changes every time the hotspot reconnects.
 * Run `ipconfig` on the laptop, look for "IPv4 Address" under the hotspot Wi-Fi adapter.
 * Never use "localhost" here — on the phone, localhost means the phone itself.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.43.20:3000';

/**
 * true = use the built-in SIMULATED data (no backend needed).
 * Default is mock so the UI can be built before the backend is ready.
 * Set EXPO_PUBLIC_USE_MOCK=false once Shihad's server runs.
 */
export const USE_MOCK = (process.env.EXPO_PUBLIC_USE_MOCK ?? 'true') !== 'false';

/** The one band in the demo (section 7.5). */
export const DEMO_DEVICE_ID = 'band-01';

/** Location older than this is "not fresh" — matches the backend's 60 s rule (section 7.2). */
export const FRESH_MS = 60_000;

/** Device is offline after 20 s without a heartbeat — matches section 7.2. */
export const OFFLINE_MS = 20_000;

/** Demo-mode escalation timers in seconds from the exit (section 9, D7). */
export const DEMO_LADDER_S = { l1: 10, l2: 25, l3: 45 } as const;

/**
 * Supabase project (backend owned by Shihad & Inshiraah). Put both in mobile/.env — never in code or git.
 * The anon/publishable key is designed to ship inside apps; row-level security protects the data.
 * NEVER put the service_role key in the app.
 */
export const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * true = help alerts come from the real Supabase project (carer must sign in).
 * false = SAMPLE data, as before. Why the placeholder check: the first message we got still said
 * "[PASTE_ANON_KEY_HERE]" — that must not count as a real key.
 */
export const SUPABASE_ENABLED =
  SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20 && !SUPABASE_ANON_KEY.includes('PASTE');

/** How often to check for new help alerts while the app is open (agreed with Shihad: polling first). */
export const POLL_MS = 5000;
