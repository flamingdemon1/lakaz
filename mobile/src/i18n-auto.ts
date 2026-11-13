/**
 * i18n-auto.ts — automatic translation of fixed English UI text, keyed by the English sentence itself.
 * Owner: Person 3/4 (Zuhayr).
 *
 * Why this exists: the account screens and the carer's main path use explicit keys (i18n.ts, t('key')).
 * The ~20 settings screens have ~250 fixed English lines; rewriting every one of them to t('key') this close
 * to the freeze would be slow and easy to break. Instead <AppText> (components/ui.tsx) looks up its English
 * text here and shows the French / Kreol line if there is one. No match = the English stays (never blank).
 *
 * Rules:
 *  - The key must be the EXACT English text the screen renders (same punctuation, same "…").
 *  - Text built from variables ("Step 2", "12 s ago") can't match — those use t('key') + fill() instead.
 *  - In development, misses are collected in globalThis.__lakazMisses so we can see what is still English.
 * ⚠️ French and Kreol are a FIRST DRAFT — a native speaker on the team must check them before the pitch.
 */
import type { Lang } from '@/i18n';
import { AUTO_STRINGS } from '@/i18n-auto-strings';

/** Current language for code that is not a React component (e.g. timeAgo in lib/format.ts). Set by AuthProvider. */
let current: Lang = 'en';
export const setCurrentLang = (l: Lang) => {
  current = l;
};
export const getCurrentLang = () => current;

/** Translates one piece of fixed English text into `lang`; returns the English unchanged when there is no entry. */
export function autoT(text: string, lang: Lang): string {
  if (lang === 'en') return text;
  const core = text.trim();
  if (!core) return text;
  const hit = AUTO_STRINGS[core]?.[lang];
  if (hit) return text.replace(core, hit); // keep any leading/trailing spaces from the JSX
  // Dev only: remember what is still English (skip numbers, codes and ALL-CAPS labels already handled elsewhere).
  if (__DEV__ && /[a-z]{3}/.test(core)) {
    const g = globalThis as unknown as { __lakazMisses?: Set<string> };
    (g.__lakazMisses ??= new Set()).add(core);
  }
  return text;
}

/** Translates React children when they are plain text (or a list of text pieces); anything else is left alone. */
export function autoChildren(children: React.ReactNode, lang: Lang): React.ReactNode {
  if (lang === 'en') return children;
  if (typeof children === 'string') return autoT(children, lang);
  if (Array.isArray(children)) return children.map((c) => (typeof c === 'string' ? autoT(c, lang) : c));
  return children;
}
