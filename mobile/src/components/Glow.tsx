/**
 * Glow.tsx — the soft coloured light that rises from the bottom of each screen ("Night glow" design).
 * Owner: Person 3/4 (Zuhayr).
 *
 * How: React Native 0.88 draws CSS gradients natively through the `backgroundImage` style, so no extra
 * package is needed (team rule: no new packages without asking Shihad). The web build passes the same
 * CSS string straight to the browser.
 * Why it never blocks taps: pointerEvents="none" — it is decoration only, behind the content.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

/** Turns '#RRGGBB' into 'rgba(r,g,b,a)' so one hex colour can fade out. */
function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Mixes a hex colour with white (amount 0–1) — the pale core of the glow, in the glow's own hue. */
function lighten(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Inputs: `color` (default brand blue; the emergency takeover passes red) and `strength` 0–1.
 * Draws two layers: a wide coloured glow and a paler core near the bottom edge, like a light behind glass.
 */
export function Glow({ color = colors.glow, strength = 1 }: { color?: string; strength?: number }) {
  const s = Math.max(0, Math.min(1, strength));
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.glow,
        {
          backgroundImage:
            `radial-gradient(ellipse 90% 60% at 50% 105%, ${rgba(lighten(color, 0.75), 0.55 * s)} 0%, transparent 45%), ` +
            `radial-gradient(ellipse 120% 70% at 50% 110%, ${rgba(color, 0.85 * s)} 0%, ${rgba(color, 0.25 * s)} 45%, transparent 75%)`,
        } as object,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
});
