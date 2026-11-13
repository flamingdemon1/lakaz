/**
 * theme.ts — LAKAZ shared design tokens (colours, type, spacing).
 * Owner: Person 3/4 (Fahim, Zuhayr). The admin page and responder page should copy these values
 * so every screen looks like one product.
 *
 * Design direction (ui-ux-pro-max): minimal / Swiss style, calm when nothing is wrong,
 * loud only when something is. Colours are placeholders — the team will finalise them later.
 * Change a colour HERE, never inside a component.
 */
import { Platform } from 'react-native';

import type { AlertStatus } from '@/types';

/** Base palette. Contrast checked for white text on the status colours (≥ 4.5:1). */
export const colors = {
  primary: '#0E7490', // calm teal — brand, links, primary buttons
  onPrimary: '#FFFFFF',
  background: '#F1F7F9', // very light blue-grey page background
  card: '#FFFFFF',
  text: '#0F2A36', // near-black slate: easier on the eyes than pure black
  textMuted: '#4B6470', // secondary text — still ≥ 4.5:1 on white
  border: '#D5E3E8',
  muted: '#E6EFF2',
  simulated: '#7C3AED', // purple tag used ONLY for "SIMULATED" labels so they are never missed
  offline: '#6B7280',
  white: '#FFFFFF',
} as const;

/**
 * Status colours shared with the admin page (section 6, Person 4).
 * Why each status also has an icon + text: colour alone fails for colour-blind users.
 */
export const statusStyles: Record<
  AlertStatus,
  { bg: string; fg: string; soft: string; icon: string; label: string }
> = {
  Critical: { bg: '#B91C1C', fg: '#FFFFFF', soft: '#FDE8E8', icon: 'alert-circle', label: 'Critical' },
  Active: { bg: '#B45309', fg: '#FFFFFF', soft: '#FEF3E2', icon: 'warning', label: 'Active' },
  Acknowledged: { bg: '#1D4ED8', fg: '#FFFFFF', soft: '#E6EEFD', icon: 'person-circle', label: 'Acknowledged' },
  Resolved: { bg: '#047857', fg: '#FFFFFF', soft: '#E3F5EE', icon: 'checkmark-circle', label: 'Resolved' },
};

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

/** Soft card shadow that looks the same on iOS, Android and web. */
export const shadow = Platform.select({
  web: { boxShadow: '0 1px 3px rgba(15,42,54,0.08), 0 4px 12px rgba(15,42,54,0.06)' },
  default: {
    shadowColor: '#0F2A36',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
}) as object;

/** Max width so the web build doesn't stretch across a wide projector screen. */
export const MAX_WIDTH = 640;

/** Minimum touch target (WCAG / Apple HIG say 44; we use 48 for older hands). */
export const TOUCH = 48;
