/**
 * notify.tsx — ONE in-app notification system for every alert type (section E), plus the caregiver's
 * notification settings. Owner: Person 3/4 (Zuhayr).
 *
 * Why in-app: remote push does NOT work in Expo Go (locked team decision). While the app is open,
 * this banner + sound + vibration is the notification; WhatsApp is the "phone in pocket" channel.
 * In the production app the same categories become real push notifications.
 *
 * Safety rule: SOS and unexpected-exit alerts can't be switched off (a caregiver must never miss them).
 * Settings live in memory (no storage package) — they reset when the app reloads.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type NotifyCategory =
  | 'unexpected_exit'
  | 'sos'
  | 'device_offline'
  | 'safe_return'
  | 'zone_arrival'
  | 'zone_departure';

export type Tone = 'critical' | 'warning' | 'good' | 'info';

export const CATEGORY_INFO: Record<
  NotifyCategory,
  { label: string; desc: string; tone: Tone; icon: string; locked?: boolean }
> = {
  unexpected_exit: { label: 'Unexpected exit', desc: 'They left a safe zone when they should not have', tone: 'critical', icon: 'warning', locked: true },
  sos: { label: 'SOS', desc: 'The SOS button on the band was held down', tone: 'critical', icon: 'megaphone', locked: true },
  device_offline: { label: 'Band disconnected', desc: 'No signal from the band for 20 seconds', tone: 'warning', icon: 'cloud-offline' },
  safe_return: { label: 'Safe return', desc: 'They are back home and the alert is closed', tone: 'good', icon: 'home' },
  zone_arrival: { label: 'Zone arrival', desc: 'They arrived at a safe zone', tone: 'good', icon: 'enter' },
  zone_departure: { label: 'Zone departure', desc: 'They left a safe zone at an allowed time', tone: 'info', icon: 'exit' },
};

export interface Notice {
  id: string;
  category: NotifyCategory;
  title: string;
  body?: string;
  at: string;
  /** Where tapping the banner goes. */
  href?: { pathname: string; params?: Record<string, string> };
  /** true = SAMPLE event (label shown). */
  sample?: boolean;
}

export interface Pref {
  banner: boolean;
  sound: boolean;
  vibrate: boolean;
}

/** Defaults: everything on, except sound for calm "good news" categories. */
const defaultPrefs = (): Record<NotifyCategory, Pref> => {
  const out = {} as Record<NotifyCategory, Pref>;
  (Object.keys(CATEGORY_INFO) as NotifyCategory[]).forEach((c) => {
    const tone = CATEGORY_INFO[c].tone;
    out[c] = { banner: true, sound: tone === 'critical' || tone === 'warning', vibrate: true };
  });
  return out;
};

interface NotifyCtx {
  notices: Notice[];
  /** Adds a banner (unless the caregiver switched banners off for that category). */
  push: (n: Omit<Notice, 'id' | 'at'>) => void;
  dismiss: (id: string) => void;
  prefs: Record<NotifyCategory, Pref>;
  setPref: (c: NotifyCategory, key: keyof Pref, value: boolean) => void;
}

const Ctx = createContext<NotifyCtx | null>(null);

/** Provider — sits at the very top of the app so every store can raise notifications. */
export function NotifyProvider({ children }: { children: React.ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [prefs, setPrefs] = useState(defaultPrefs);

  const push = useCallback(
    (n: Omit<Notice, 'id' | 'at'>) => {
      const locked = CATEGORY_INFO[n.category].locked;
      if (!locked && !prefs[n.category].banner) return;
      // Why a cap of 10: a stuck simulator must not pile up hundreds of banners.
      setNotices((q) =>
        [...q, { ...n, id: `n-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, at: new Date().toISOString() }].slice(-10),
      );
    },
    [prefs],
  );

  const value = useMemo<NotifyCtx>(
    () => ({
      notices,
      push,
      dismiss: (id) => setNotices((q) => q.filter((x) => x.id !== id)),
      prefs,
      setPref: (c, key, v) => {
        if (CATEGORY_INFO[c].locked) return; // safety: can't switch off SOS / unexpected exit
        setPrefs((p) => ({ ...p, [c]: { ...p[c], [key]: v } }));
      },
    }),
    [notices, push, prefs],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Hook used by stores (to push) and by the banner/settings screens. */
export function useNotify() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useNotify must be used inside <NotifyProvider>');
  return v;
}
