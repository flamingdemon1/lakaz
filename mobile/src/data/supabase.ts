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
import type { Lang } from '@/i18n';

export interface SupaUser {
  id: string;
  email?: string;
  phone?: string;
  email_confirmed_at?: string;
  phone_confirmed_at?: string;
  user_metadata?: { name?: string; full_name?: string; language?: Lang };
}

export interface CarerProfile {
  name: string | null;
  phone: string | null;
  language: Lang;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: SupaUser;
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
    // Generic wording: used by alerts AND the facility lookup.
    return 'Backend not set up yet: a table/function is missing in Supabase. Ask Shihad/Inshiraah to apply the migration.';
  // A wrong/old key in mobile/.env — not the user's fault, so say what to fix.
  if (/invalid api key|no api key/i.test(msg)) return 'App setup problem: the Supabase key in mobile/.env is wrong. Ask Shihad for the publishable key.';
  if (/invalid login credentials/i.test(msg)) return 'Email or password is not right.';
  if (/otp_expired/.test(body?.error_code ?? body?.code ?? '') || /token has expired or is invalid/i.test(msg))
    return 'That email code is invalid or expired. Check it or request a new one.';
  if (/email not confirmed/i.test(msg)) return 'Verify your email before logging in.';
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
    if (init.auth !== false) {
      const userId = session?.user.id;
      await ensureFresh();
      if (userId !== session?.user.id) throw new Error('Please sign in again.');
    }
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
function save(r: TokenResponse) {
  session = {
    access_token: r.access_token,
    refresh_token: r.refresh_token,
    // Why minus 60 s: refresh a little early so a request never goes out with a just-expired token.
    expires_at: Date.now() + (r.expires_in - 60) * 1000,
    user: r.user,
  };
}

/** Refreshes the access token if it has expired. */
let refreshing: { session: Session; request: Promise<void> } | null = null;

async function ensureFresh() {
  const previous = session;
  if (!previous || Date.now() < previous.expires_at) return;
  if (refreshing?.session === previous) return refreshing.request;

  const request = call<TokenResponse>('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ refresh_token: previous.refresh_token }),
  }).then((result) => {
    if (session === previous) save(result);
  }).finally(() => {
    if (refreshing?.session === previous) refreshing = null;
  });

  refreshing = { session: previous, request };
  return request;
}

/** Signs a carer in with email + password. Returns the Supabase user. */
export async function signIn(email: string, password: string): Promise<SupaUser> {
  const r = await passwordSession(email, password);
  save(r);
  return r.user;
}

function passwordSession(email: string, password: string) {
  return call<TokenResponse>('/auth/v1/token?grant_type=password', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
}

function emailRequest<T>(path: string, email: string, fields?: Record<string, unknown>) {
  return call<T>(`/auth/v1/${path}`, {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email: email.trim().toLowerCase(), ...fields }),
  });
}

export async function signUp(email: string, password: string, name: string, language: Lang): Promise<SupaUser | null> {
  const result = await emailRequest<Partial<TokenResponse>>('signup', email, { password, data: { name, language } });
  // If the project has email confirmation disabled, Supabase returns a session immediately.
  if (result.access_token && result.refresh_token && result.expires_in && result.user) {
    save(result as TokenResponse);
    return result.user;
  }
  return null;
}

export const resendSignupCode = (email: string) => emailRequest('resend', email, { type: 'signup' });

export async function verifyEmail(email: string, token: string): Promise<SupaUser> {
  const result = await emailRequest<TokenResponse>('verify', email, { type: 'email', token });
  save(result);
  return result.user;
}

export const requestPasswordReset = (email: string) => emailRequest('recover', email);

export async function verifyRecoveryCode(email: string, token: string): Promise<string> {
  const result = await emailRequest<TokenResponse>('verify', email, { type: 'recovery', token });
  return result.access_token;
}

export async function resetPassword(recoveryToken: string, password: string): Promise<void> {
  await call('/auth/v1/user', {
    method: 'PUT',
    auth: false,
    headers: { Authorization: `Bearer ${recoveryToken}` },
    body: JSON.stringify({ password }),
  });
  await endSession(recoveryToken);
}

export async function changePassword(current: string, password: string): Promise<void> {
  const user = session?.user;
  if (!user?.email) throw new Error('Please sign in again.');
  const fresh = await passwordSession(user.email, current);
  let adopted = false;
  try {
    if (fresh.user.id !== user.id || session?.user.id !== user.id) throw new Error('Please sign in again.');
    await call('/auth/v1/user', {
      method: 'PUT',
      auth: false,
      headers: { Authorization: `Bearer ${fresh.access_token}` },
      body: JSON.stringify({ password }),
    });
    if (session?.user.id === user.id) {
      const previousToken = session.access_token;
      save(fresh);
      adopted = true;
      await endSession(previousToken);
    }
  } finally {
    if (!adopted) await endSession(fresh.access_token);
  }
}

export async function signOutEverywhere(): Promise<void> {
  if (!session) throw new Error('Please sign in again.');
  await call('/auth/v1/logout?scope=global', { method: 'POST' });
  session = null;
}

export async function getProfile(id: string): Promise<CarerProfile | null> {
  const rows = await select<CarerProfile[]>(`profiles?id=eq.${encodeURIComponent(id)}&select=name,phone,language`);
  return rows[0] ?? null;
}

export async function saveProfile(id: string, changes: Partial<CarerProfile>, createOnly = false): Promise<void> {
  if (session?.user.id !== id) throw new Error('Please sign in again.');
  await call('/rest/v1/profiles?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: `resolution=${createOnly ? 'ignore' : 'merge'}-duplicates,missing=default,return=minimal` },
    body: JSON.stringify({ id, ...changes }),
  });
}

async function endSession(token: string): Promise<void> {
  try {
    await call('/auth/v1/logout?scope=local', {
      method: 'POST',
      auth: false,
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Local sign-out still works when the network request fails.
  }
}

/** Signs out (best effort — the local session is cleared even if the network call fails). */
export async function signOut(): Promise<void> {
  const s = session;
  session = null;
  if (s) await endSession(s.access_token);
}

/** GET from the REST API, e.g. select('alerts?select=*&order=received_at.desc'). */
export const select = <T>(path: string) => call<T>(`/rest/v1/${path}`);

/** Calls a Postgres function, e.g. rpc('acknowledge_alert', { p_device_id, p_event_id }). */
export const rpc = <T>(name: string, args: Record<string, unknown>) =>
  call<T>(`/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(args) });
