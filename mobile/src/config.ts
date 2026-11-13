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
 * The shared Lakaz project is the default for local runs. Only publishable
 * credentials belong in the client. Supabase policies control data access.
 * Set both environment variables to empty strings to run the sample flows.
 */
const LAKAZ_SUPABASE_URL = 'https://vzujmdgfybhjytppcmcc.supabase.co';
const LAKAZ_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_mzSQT1alDmGT9_OiyQILQA_NE7YXvvV';

export const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? LAKAZ_SUPABASE_URL).replace(/\/$/, '');
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? LAKAZ_SUPABASE_PUBLISHABLE_KEY;

export const SUPABASE_ENABLED =
  SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20 && !SUPABASE_ANON_KEY.includes('PASTE');

/** How often to check for new help alerts while the app is open (agreed with Shihad: polling first). */
export const POLL_MS = 5000;
