/**
 * auth.tsx — SAMPLE account system: sign-up, verification, log in (password or one-time code),
 * forgot password, profile, language, security. (Guardians per person live in src/data/people.tsx.)
 * Owner: Person 3/4 (Zuhayr). Real auth = Supabase Auth (Person 2: Shihad, Inshiraah).
 *
 * NOTHING HERE IS REAL: accounts live in memory (reset when the app reloads), no email or SMS is sent,
 * and every code is the fixed SAMPLE_CODE shown on screen. Each function marked "SWAP FOR SUPABASE"
 * is the only place that changes when the backend is ready; the screens stay the same.
 * Fictional data only (section 7.5). Never put real people's details here.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { SUPABASE_ENABLED } from '@/config';
import { useLakaz } from '@/data/store';
import * as supa from '@/data/supabase';
import { Lang, STRINGS, TKey } from '@/i18n';
import { setCurrentLang } from '@/i18n-auto';
import { normalisePhone } from '@/lib/validate';

/** The fixed code every SAMPLE "SMS/email" contains. Shown on screen with a SAMPLE label. */
export const SAMPLE_CODE = '123456';

export interface Account {
  id: string;
  name: string;
  email: string;
  phone: string; // +230XXXXXXXX
  email_verified: boolean;
  phone_verified: boolean;
  lang: Lang;
}

// ---------------- SAMPLE "database" (fictional) ----------------
// Demo sign-in for rehearsals — fictional caregiver c-01. Also listed in mobile/README.md.
const seedAccounts: (Account & { password: string })[] = [
  {
    id: 'c-01',
    name: 'Demo Caregiver',
    email: 'demo@lakaz.test',
    phone: '+23057000001',
    email_verified: true,
    phone_verified: true,
    lang: 'en',
    password: 'Lakaz2026',
  },
];
let accounts = seedAccounts.map((a) => ({ ...a }));

/** Simulated network delay so loading states are visible. */
const wait = (ms = 600) => new Promise((r) => setTimeout(r, ms));
/** Strips the password before an account leaves the "server". */
const publicAccount = ({ password: _p, ...a }: Account & { password: string }): Account => ({ ...a });

interface AuthCtx {
  user: Account | null;
  /** Account waiting for its email/phone codes after sign-up or an unverified log in. */
  pending: Account | null;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TKey) => string;
  signUp: (p: { name: string; email: string; phone: string; password: string }) => Promise<void>;
  verifyAccount: (emailCode: string, phoneCode: string) => Promise<void>;
  resendCode: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<'ok' | 'needs_verification'>;
  requestOtp: (phone: string) => Promise<void>;
  loginWithOtp: (phone: string, code: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  updateProfile: (p: { name: string; email: string; phone: string }) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  logout: () => void;
  /** TEMPORARY bypass: signs in as the demo caregiver without a password. Remove before the pitch. */
  bypass: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

/** Provider — must sit INSIDE <LakazProvider> because it also opens/closes the caregiver area. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const lakaz = useLakaz();
  const [user, setUser] = useState<Account | null>(null);
  const [pending, setPending] = useState<Account | null>(null);
  const [lang, setLangState] = useState<Lang>('en');

  /** Signs a verified account in and opens the caregiver tabs. */
  const signIn = useCallback(
    (a: Account) => {
      setUser(a);
      setLangState(a.lang);
      setPending(null);
      lakaz.login();
    },
    [lakaz],
  );

  const value = useMemo<AuthCtx>(() => {
    /** Finds a stored account by email or phone (any format). */
    const find = (identifier: string) => {
      const phone = normalisePhone(identifier);
      const id = identifier.trim().toLowerCase();
      return accounts.find((a) => a.email.toLowerCase() === id || (phone && a.phone === phone));
    };

    // Keep non-React helpers (timeAgo in lib/format.ts) on the same language as the screens.
    setCurrentLang(lang);
    return {
      user,
      pending,
      lang,
      setLang: (l) => {
        setLangState(l);
        // Remember the choice on the account too (SWAP FOR SUPABASE: update the profile row).
        if (user) {
          accounts = accounts.map((a) => (a.id === user.id ? { ...a, lang: l } : a));
          setUser({ ...user, lang: l });
        }
      },
      t: (k) => STRINGS[lang][k] ?? STRINGS.en[k],

      // SWAP FOR SUPABASE: supabase.auth.signUp({ email, password, phone, options: { data: { name } } })
      signUp: async ({ name, email, phone, password }) => {
        await wait();
        if (find(email)) throw new Error('An account with this email already exists. Try logging in.');
        const p = normalisePhone(phone)!;
        if (find(p)) throw new Error('This phone number is already used by another account.');
        const acc = { id: `c-${Date.now()}`, name: name.trim(), email: email.trim().toLowerCase(), phone: p, email_verified: false, phone_verified: false, lang, password };
        accounts.push(acc);
        setPending(publicAccount(acc));
      },

      // SWAP FOR SUPABASE: supabase.auth.verifyOtp({ email, token, type: 'signup' }) + ({ phone, token, type: 'sms' })
      verifyAccount: async (emailCode, phoneCode) => {
        await wait();
        if (!pending) throw new Error('Nothing to verify. Please log in again.');
        if (emailCode !== SAMPLE_CODE) throw new Error('The email code is not right. Check it, or send a new one.');
        if (phoneCode !== SAMPLE_CODE) throw new Error('The phone code is not right. Check it, or send a new one.');
        accounts = accounts.map((a) => (a.id === pending.id ? { ...a, email_verified: true, phone_verified: true } : a));
        signIn({ ...pending, email_verified: true, phone_verified: true });
      },

      // SWAP FOR SUPABASE: supabase.auth.resend({ type: 'signup', email }) / phone OTP resend
      resendCode: async () => {
        await wait(400);
      },

      login: async (identifier, password) => {
        // LIVE: real carer account in Supabase Auth (email + password). Needed for real alerts + acknowledge.
        if (SUPABASE_ENABLED) {
          if (!identifier.includes('@')) throw new Error('Use the email of your carer account.');
          const u = await supa.signIn(identifier, password);
          const email = u.email ?? identifier.trim().toLowerCase();
          signIn({
            id: u.id,
            name: u.user_metadata?.name ?? u.user_metadata?.full_name ?? email.split('@')[0],
            email,
            phone: u.phone ? `+${u.phone.replace(/^\+/, '')}` : '',
            email_verified: true, // Supabase only lets confirmed users sign in (when confirmation is on)
            phone_verified: !!u.phone,
            lang,
          });
          return 'ok';
        }
        // SAMPLE accounts below.
        await wait();
        const acc = find(identifier);
        // Why one vague message: don't reveal whether an email has an account (basic account security).
        if (!acc || acc.password !== password) throw new Error('Email/phone or password is not right.');
        if (!acc.email_verified || !acc.phone_verified) {
          setPending(publicAccount(acc));
          return 'needs_verification';
        }
        signIn(publicAccount(acc));
        return 'ok';
      },

      // SWAP FOR SUPABASE: supabase.auth.signInWithOtp({ phone })
      requestOtp: async (phone) => {
        await wait();
        // Same reply whether or not the number exists (account security).
        if (!normalisePhone(phone)) throw new Error('Use a Mauritian mobile number: 8 digits starting with 5.');
      },

      // SWAP FOR SUPABASE: supabase.auth.verifyOtp({ phone, token, type: 'sms' })
      loginWithOtp: async (phone, code) => {
        await wait();
        const acc = find(phone);
        if (!acc || code !== SAMPLE_CODE) throw new Error('That code is not right or has expired. Send a new one.');
        signIn(publicAccount({ ...acc, phone_verified: true }));
      },

      // SWAP FOR SUPABASE: supabase.auth.resetPasswordForEmail(email)
      requestPasswordReset: async () => {
        await wait();
      },

      // SWAP FOR SUPABASE: verifyOtp({ email, token, type: 'recovery' }) then auth.updateUser({ password })
      resetPassword: async (email, code, newPassword) => {
        await wait();
        const acc = find(email);
        if (!acc || code !== SAMPLE_CODE) throw new Error('That code is not right or has expired. Send a new one.');
        acc.password = newPassword;
      },

      // SWAP FOR SUPABASE: update the profile row; auth.updateUser for email/phone (re-verification)
      updateProfile: async ({ name, email, phone }) => {
        await wait();
        if (!user) throw new Error('Please log in again.');
        const p = normalisePhone(phone)!;
        const other = accounts.find((a) => a.id !== user.id && (a.email === email.toLowerCase() || a.phone === p));
        if (other) throw new Error('That email or phone is already used by another account.');
        // Changing email/phone means it must be verified again.
        const next: Account = {
          ...user,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: p,
          email_verified: user.email_verified && email.trim().toLowerCase() === user.email,
          phone_verified: user.phone_verified && p === user.phone,
        };
        accounts = accounts.map((a) => (a.id === user.id ? { ...a, ...next } : a));
        setUser(next);
      },

      // SWAP FOR SUPABASE: re-authenticate, then auth.updateUser({ password })
      changePassword: async (current, next) => {
        await wait();
        const acc = accounts.find((a) => a.id === user?.id);
        if (!acc || acc.password !== current) throw new Error('Your current password is not right.');
        acc.password = next;
      },

      // LIVE: also ends the Supabase session (scope 'global' for "all devices" is a later improvement).
      logout: () => {
        if (SUPABASE_ENABLED) void supa.signOut();
        setUser(null);
        setPending(null);
        lakaz.logout();
      },

      bypass: () => signIn(publicAccount(accounts[0])),
      // Guardians / trusted caregivers moved to src/data/people.tsx (they belong to each person).
    };
  }, [user, pending, lang, signIn, lakaz]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Hook for every account screen. */
/**
 * The chosen language, or 'en' outside <AuthProvider>. Safe to call from shared components like AppText,
 * which also render on screens that sit outside the provider.
 */
export function useLang(): Lang {
  return useContext(Ctx)?.lang ?? 'en';
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}
