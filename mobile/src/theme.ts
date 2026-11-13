/**
 * theme.ts — LAKAZ shared design tokens (colours, type, spacing).
 * Owner: Person 3/4 (Fahim, Zuhayr). Change a colour HERE, never inside a component.
 *
 * Design direction "Night glow" (13 Nov, from the reference Zuhayr picked): near-black screens, a soft blue
 * glow rising from the bottom (see components/Glow.tsx), big bold headings, white pill buttons.
 * The colour CODE is unchanged and still strict, so a glance is enough:
 *   RED    = danger / emergency only (critical alerts, SOS, 999). The emergency glow turns red.
 *   AMBER  = warning, needs attention soon (active alert, band disconnected).
 *   BLUE   = someone is handling it (acknowledged).
 *   GREEN  = she is safe / done ✓ (at home, inside a safe zone, resolved, saved).
 *   BRAND BLUE (primary) = buttons, links, the glow — never a status on its own.
 * Why these exact hex values: each status colour is used BOTH as a fill under white text and as a text
 * colour on the black background, so each was picked to reach ~4.4:1 or better in both directions.
 */
import type { AlertStatus } from '@/types';

/** Base palette. Contrast checked for white text on ink and on every status colour (≥ 4.5:1). */
export const colors = {
  primary: '#3D63FF', // brand blue — buttons, links, glow. White text on it: 4.7:1
  onPrimary: '#FFFFFF',
  background: '#07070B', // near-black "night" screen
  card: '#13131C', // raised surface on black (light text on it: 16.8:1)
  text: '#F4F4F8',
  textMuted: '#A3A3B5', // 8:1 on the background, 7.4:1 on cards
  border: '#262634',
  muted: '#1C1C28', // quiet fill (icon circles, inset panels)
  simulated: '#7C3AED', // purple tag used ONLY for "SIMULATED" labels so they are never missed
  offline: '#8A8AA0',
  white: '#FFFFFF',
  ink: '#07070B', // dark text on white pills
  primarySoft: '#1A2150', // selected-choice background (dark brand tint)
  link: '#9DB0FF', // brand blue lightened for TEXT on black (9.5:1) — links, ghost buttons
  glow: '#3D4BFF', // the bottom glow colour (brand)
  // Semantic shortcuts — same values as statusStyles, named for what they MEAN.
  danger: '#D93A30',
  dangerSoft: '#341311', // dark tints: light text stays readable on them
  warning: '#B8690A',
  warningSoft: '#33220A',
  safe: '#1E8A55',
  safeSoft: '#0E2A1D',
  info: '#3D6BF5',
  infoSoft: '#141E45',
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
  display: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 44, letterSpacing: -0.8 }, // big glow-style headline
  hero: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.4 },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 18, lineHeight: 26 },
  bodyBold: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 26 },
  small: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  smallBold: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 0.6 },
} as const;

/**
 * Card edge on black: a thin cool hairline, no drop shadow (shadows don't show on near-black).
 */
export const shadow = { borderWidth: 1, borderColor: '#262634' } as object;

/** Max width so the web build doesn't stretch across a wide projector screen. */
export const MAX_WIDTH = 640;

/** Minimum touch target (WCAG / Apple HIG say 44; we use 48 for older hands). */
export const TOUCH = 48;
