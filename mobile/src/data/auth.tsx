/** Live email accounts use Supabase Auth. The in-memory accounts below are for sample mode. */
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

function liveAccount(user: supa.SupaUser, lang: Lang, identifier: string): Account {
  const email = user.email ?? identifier.trim().toLowerCase();
  return {
    id: user.id,
    name: user.user_metadata?.name ?? user.user_metadata?.full_name ?? email.split('@')[0],
    email,
    phone: user.phone ? `+${user.phone.replace(/^\+/, '')}` : '',
    email_verified: !!user.email_confirmed_at,
    phone_verified: !!user.phone_confirmed_at,
    lang: user.user_metadata?.language && Object.hasOwn(STRINGS, user.user_metadata.language) ? user.user_metadata.language : lang,
  };
}

interface AuthCtx {
  user: Account | null;
  /** Account waiting for its email/phone codes after sign-up or an unverified log in. */
  pending: Account | null;
  lang: Lang;
  setLang: (l: Lang) => Promise<void>;
  t: (k: TKey) => string;
  signUp: (p: { name: string; email: string; phone: string; password: string }) => Promise<'ok' | 'needs_verification'>;
  verifyAccount: (emailCode: string, phoneCode: string) => Promise<void>;
  resendCode: () => Promise<void>;
  beginEmailVerification: (email: string) => Promise<void>;
  login: (identifier: string, password: string) => Promise<'ok' | 'needs_verification'>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  updateProfile: (p: { name: string; email: string; phone: string }) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  logout: (everywhere?: boolean) => Promise<void>;
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

  const signInLive = useCallback(async (account: supa.SupaUser, language: Lang, email: string) => {
    const fallback = liveAccount(account, language, email);
    let profile: supa.CarerProfile | null = null;
    try {
      profile = await supa.getProfile(account.id);
      if (!profile) {
        const name = fallback.name.trim();
        await supa.saveProfile(account.id, {
          name: name.length >= 2 && name.length <= 100 ? name : null,
          phone: normalisePhone(fallback.phone),
          language: fallback.lang,
        }, true);
      }
    } catch {
      // Profile loading must never block access to help alerts.
    }
    if (supa.currentUser()?.id !== account.id) return;
    signIn(profile ? {
      ...fallback,
      name: profile.name ?? fallback.name,
      phone: profile.phone ?? '',
      phone_verified: false,
      lang: profile.language,
    } : fallback);
  }, [signIn]);

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
      setLang: async (l) => {
        if (SUPABASE_ENABLED && user) {
          await supa.saveProfile(user.id, { language: l });
          if (supa.currentUser()?.id !== user.id) return;
        } else if (user) {
          accounts = accounts.map((a) => (a.id === user.id ? { ...a, lang: l } : a));
        }
        setLangState(l);
        setUser((account) => account && account.id === user?.id ? { ...account, lang: l } : account);
      },
      t: (k) => STRINGS[lang][k] ?? STRINGS.en[k],

      beginEmailVerification: async (email) => {
        await supa.resendSignupCode(email);
        setPending({ id: '', name: '', email: email.trim().toLowerCase(), phone: '', email_verified: false, phone_verified: false, lang });
      },
      signUp: async ({ name, email, phone, password }) => {
        if (SUPABASE_ENABLED) {
          const signedIn = await supa.signUp(email, password, name.trim(), lang);
          if (signedIn) {
            await signInLive(signedIn, lang, email);
            return 'ok';
          }
          setPending({ id: '', name: name.trim(), email: email.trim().toLowerCase(), phone: '', email_verified: false, phone_verified: false, lang });
          return 'needs_verification';
        }
        await wait();
        if (find(email)) throw new Error('An account with this email already exists. Try logging in.');
        const p = normalisePhone(phone)!;
        if (find(p)) throw new Error('This phone number is already used by another account.');
        const acc = { id: `c-${Date.now()}`, name: name.trim(), email: email.trim().toLowerCase(), phone: p, email_verified: false, phone_verified: false, lang, password };
        accounts.push(acc);
        setPending(publicAccount(acc));
        return 'needs_verification';
      },

      verifyAccount: async (emailCode, phoneCode) => {
        if (!pending) throw new Error('Nothing to verify. Please log in again.');
        if (SUPABASE_ENABLED) {
          const verified = await supa.verifyEmail(pending.email, emailCode);
          await signInLive(verified, lang, pending.email);
          return;
        }
        await wait();
        if (emailCode !== SAMPLE_CODE) throw new Error('The email code is not right. Check it, or send a new one.');
        if (phoneCode !== SAMPLE_CODE) throw new Error('The phone code is not right. Check it, or send a new one.');
        accounts = accounts.map((a) => (a.id === pending.id ? { ...a, email_verified: true, phone_verified: true } : a));
        signIn({ ...pending, email_verified: true, phone_verified: true });
      },

      resendCode: async () => {
        if (SUPABASE_ENABLED && pending) {
          await supa.resendSignupCode(pending.email);
          return;
        }
        await wait(400);
      },

      login: async (identifier, password) => {
        // LIVE: real carer account in Supabase Auth (email + password). Needed for real alerts + acknowledge.
        if (SUPABASE_ENABLED) {
          if (!identifier.includes('@')) throw new Error('Use the email of your carer account.');
          const u = await supa.signIn(identifier, password);
          await signInLive(u, lang, identifier);
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

      requestPasswordReset: async (email) => {
        if (SUPABASE_ENABLED) {
          await supa.requestPasswordReset(email);
          return;
        }
        await wait();
      },

      resetPassword: async (email, code, newPassword) => {
        await wait();
        const acc = find(email);
        if (!acc || code !== SAMPLE_CODE) throw new Error('That code is not right or has expired. Send a new one.');
        acc.password = newPassword;
      },

      updateProfile: async ({ name, email, phone }) => {
        if (!user) throw new Error('Please log in again.');
        if (SUPABASE_ENABLED) {
          const contact = normalisePhone(phone);
          if (phone.trim() && !contact) throw new Error('Enter a valid Mauritian mobile number.');
          const displayName = name.trim();
          await supa.saveProfile(user.id, { name: displayName, phone: contact });
          setUser((account) => account?.id === user.id
            ? { ...account, name: displayName, phone: contact ?? '', phone_verified: false }
            : account);
          return;
        }
        await wait();
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

      changePassword: async (current, next) => {
        if (SUPABASE_ENABLED) {
          await supa.changePassword(current, next);
          return;
        }
        await wait();
        const acc = accounts.find((a) => a.id === user?.id);
        if (!acc || acc.password !== current) throw new Error('Your current password is not right.');
        acc.password = next;
      },

      // Also ends the live session for this device.
      logout: async (everywhere = false) => {
        if (SUPABASE_ENABLED && everywhere) await supa.signOutEverywhere();
        else if (SUPABASE_ENABLED) void supa.signOut();
        setUser(null);
        setPending(null);
        lakaz.logout();
      },

      bypass: () => signIn(publicAccount(accounts[0])),
      // Guardians / trusted caregivers moved to src/data/people.tsx (they belong to each person).
    };
  }, [user, pending, lang, signIn, signInLive, lakaz]);

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
