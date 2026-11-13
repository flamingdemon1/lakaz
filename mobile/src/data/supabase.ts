/**
 * supabase.ts — tiny Supabase client using plain fetch (NO extra package: dependencies are frozen).
 * Owner: Person 3 (Zuhayr). Backend schema: backend/supabase/migrations/20261113143000_* (Inshiraah, Shihad).
 *
 * What it does:
 *  - signIn(email, password)   → POST /auth/v1/token?grant_type=password   (carer account in Supabase Auth)
 *  - select(path)              → GET  /rest/v1/<path>                      (row-level security decides what we see)
 *  - rpc(name, args)           → POST /rest/v1/rpc/<name>                  (e.g. acknowledge_alert)
 * The session lives in memory only (signing in again after a reload is fine for the demo; no package for storage).
 * Every request sends the anon key + the carer's access token, so Supabase knows WHO is asking (auth.uid()).
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/config';

export interface SupaUser {
  id: string;
  email?: string;
  phone?: string;
  user_metadata?: { name?: string; full_name?: string };
}

interface Session {
  access_token: string;
  refresh_token: string;
  /** Epoch ms when the access token stops working. */
  expires_at: number;
  user: SupaUser;
}

let session: Session | null = null;

/** Is a carer signed in to Supabase right now? */
export const isSignedIn = () => !!session;
export const currentUser = () => session?.user ?? null;

/**
 * Turns Supabase / Postgres errors into plain words a carer understands.
 * Why: the RPC raises 'unauthorized: …', 'forbidden: …', 'not_found: …' (see the migration).
 */
function friendly(status: number, body: any): string {
  const msg: string = body?.message ?? body?.msg ?? body?.error_description ?? body?.error ?? '';
  // PGRST205 = table missing: the backend migration hasn't been applied to this Supabase project yet.
  if (body?.code === 'PGRST205' || /could not find the (table|function)/i.test(msg))
    return 'Backend not set up yet: the alerts table/function is missing in Supabase. Ask Shihad/Inshiraah to apply the migration.';
  // A wrong/old key in mobile/.env — not the user's fault, so say what to fix.
  if (/invalid api key|no api key/i.test(msg)) return 'App setup problem: the Supabase key in mobile/.env is wrong. Ask Shihad for the publishable key.';
  if (/invalid login credentials/i.test(msg)) return 'Email or password is not right.';
  if (/email not confirmed/i.test(msg)) return 'This email is not confirmed yet. Check your inbox.';
  if (/forbidden/i.test(msg)) return 'Your account is not linked to this band.';
  if (/not_found/i.test(msg)) return 'That alert no longer exists.';
  if (/unauthorized|jwt expired|invalid jwt/i.test(msg) || status === 401) return 'Please sign in again.';
  return msg || `Server error (${status}).`;
}

/**
 * One request to Supabase with a 8 s timeout. Throws a readable Error.
 * Why 8 s: on a phone hotspot a request can hang; the screen must not spin forever.
 */
async function call<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    if (init.auth !== false) await ensureFresh();
    const res = await fetch(`${SUPABASE_URL}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        // Signed-in carer → their token (RLS uses it). Not signed in → anon key (sees nothing protected).
        Authorization: `Bearer ${session && init.auth !== false ? session.access_token : SUPABASE_ANON_KEY}`,
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(friendly(res.status, body));
    return body as T;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('No reply from the server after 8 s. Check the internet connection.');
    if (e instanceof TypeError) throw new Error('Cannot reach the server. Check the internet connection.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Saves a token response from /auth/v1/token. */
function save(r: { access_token: string; refresh_token: string; expires_in: number; user: SupaUser }) {
  session = {
    access_token: r.access_token,
    refresh_token: r.refresh_token,
    // Why minus 60 s: refresh a little early so a request never goes out with a just-expired token.
    expires_at: Date.now() + (r.expires_in - 60) * 1000,
    user: r.user,
  };
}

/** Refreshes the access token if it has expired. */
async function ensureFresh() {
  if (!session || Date.now() < session.expires_at) return;
  const r = await call<any>('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  save(r);
}

/** Signs a carer in with email + password. Returns the Supabase user. */
export async function signIn(email: string, password: string): Promise<SupaUser> {
  const r = await call<any>('/auth/v1/token?grant_type=password', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  save(r);
  return r.user;
}

/** Signs out (best effort — the local session is cleared even if the network call fails). */
export async function signOut(): Promise<void> {
  const s = session;
  session = null;
  if (!s) return;
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${s.access_token}` },
    });
  } catch {
    /* offline is fine — the token simply expires */
  }
}

/** GET from the REST API, e.g. select('alerts?select=*&order=received_at.desc'). */
export const select = <T>(path: string) => call<T>(`/rest/v1/${path}`);

/** Calls a Postgres function, e.g. rpc('acknowledge_alert', { p_device_id, p_event_id }). */
export const rpc = <T>(name: string, args: Record<string, unknown>) =>
  call<T>(`/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(args) });
