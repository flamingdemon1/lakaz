/**
 * theme.ts — LAKAZ shared design tokens (colours, type, spacing).
 * Owner: Person 3/4 (Fahim, Zuhayr). The admin page and responder page should copy these values
 * so every screen looks like one product.
 *
 * Design direction ("warm home", chosen from the UI previews): cream paper + dark ink, quiet when
 * nothing is wrong, loud only when something is. The colour CODE is strict so a glance is enough:
 *   RED    = danger / emergency only (critical alerts, SOS, 999). Never used for decoration or branding.
 *   AMBER  = warning, needs attention soon (active alert, low battery).
 *   BLUE   = someone is handling it (acknowledged).
 *   GREEN  = safe (at home, resolved, band online).
 *   INK    = everything else (brand, buttons, links) — neutral so it never competes with a status.
 * Change a colour HERE, never inside a component.
 */
import { Platform } from 'react-native';

import type { AlertStatus } from '@/types';

/** Base palette. Contrast checked for white text on ink and on every status colour (≥ 4.5:1). */
export const colors = {
  primary: '#23394B', // dark ink-blue — brand, links, primary buttons (deliberately not a status colour)
  onPrimary: '#FFFFFF',
  background: '#FAF6EF', // warm cream "paper" — less clinical than blue-grey
  card: '#FFFFFF',
  text: '#2A2420', // warm near-black
  textMuted: '#6A5D52', // warm grey — ≥ 4.5:1 on white and on the cream background
  border: '#E9E0D4',
  muted: '#F2EBE1',
  simulated: '#7C3AED', // purple tag used ONLY for "SIMULATED" labels so they are never missed
  offline: '#6B7280',
  white: '#FFFFFF',
  // Semantic shortcuts — same values as statusStyles, named for what they MEAN.
  danger: '#B3261E',
  dangerSoft: '#FCEBEA',
  warning: '#A85A08',
  warningSoft: '#FDF1E1',
  safe: '#1F7A4D',
  safeSoft: '#E6F3EC',
  info: '#1D4ED8',
  infoSoft: '#E8EEFD',
} as const;

/**
 * Status colours shared with the admin page (section 6, Person 4).
 * Why each status also has an icon + text: colour alone fails for colour-blind users.
 */
export const statusStyles: Record<
  AlertStatus,
  { bg: string; fg: string; soft: string; icon: string; label: string }
> = {
  Critical: { bg: colors.danger, fg: '#FFFFFF', soft: colors.dangerSoft, icon: 'alert-circle', label: 'Critical' },
  Active: { bg: colors.warning, fg: '#FFFFFF', soft: colors.warningSoft, icon: 'warning', label: 'Active' },
  Acknowledged: { bg: colors.info, fg: '#FFFFFF', soft: colors.infoSoft, icon: 'person-circle', label: 'Acknowledged' },
  Resolved: { bg: colors.safe, fg: '#FFFFFF', soft: colors.safeSoft, icon: 'checkmark-circle', label: 'Resolved' },
};

/**
 * Motion timings (ms). One place so every animation feels like the same app.
 * Enter is slower than exit; nothing loops unless it means "needs attention" or "alive".
 */
export const motion = { fast: 150, base: 280, slow: 450, stagger: 70, breathe: 4000, pulse: 1800 } as const;

/** Spacing scale (4-pt grid). Use these instead of random numbers. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

/**
 * Font families. Atkinson Hyperlegible was designed for low-vision readers —
 * good for older caregivers and for the projector. Loaded in app/_layout.tsx.
 */
export const fonts = {
  regular: 'AtkinsonHyperlegible_400Regular',
  bold: 'AtkinsonHyperlegible_700Bold',
} as const;

/**
 * Type scale. Body is 18 (not the usual 16) because our users skew older and
 * the web build is shown on a projector.
 */
export const type = {
  hero: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 38 },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 18, lineHeight: 26 },
  bodyBold: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 26 },
  small: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  smallBold: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 0.6 },
} as const;

/**
 * Card edge: a warm hairline + a very faint shadow. Why not a big soft shadow: floating
 * "glow cards" everywhere is the generic template look; paper-like edges feel calmer.
 */
export const shadow = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(42,36,32,0.06)', borderWidth: 1, borderColor: '#E9E0D4' },
  default: {
    shadowColor: '#2A2420',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    borderWidth: 1,
    borderColor: '#E9E0D4',
  },
}) as object;

/** Max width so the web build doesn't stretch across a wide projector screen. */
export const MAX_WIDTH = 640;

/** Minimum touch target (WCAG / Apple HIG say 44; we use 48 for older hands). */
export const TOUCH = 48;
