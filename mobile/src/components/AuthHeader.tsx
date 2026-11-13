/**
 * AuthHeader.tsx — logo + title block at the top of every account screen.
 * Owner: Person 3/4 (Zuhayr).
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, space } from '@/theme';

/**
 * Inputs: title, an optional one-line explanation, and an optional `headline` — the huge left-aligned
 * welcome words ("Notice. Respond. Bring home.") used only on the login screen (glow design).
 */
export function AuthHeader({ title, body, headline }: { title: string; body?: string; headline?: string }) {
  return (
    <View style={[styles.wrap, headline ? styles.left : null]}>
      {headline ? (
        <AppText variant="display" style={styles.headline} accessibilityRole="header">
          {headline}
        </AppText>
      ) : null}
      <View style={styles.logo}>
        <Ionicons name="home" size={30} color={colors.white} />
      </View>
      <AppText variant="title" accessibilityRole="header" style={headline ? undefined : styles.center}>
        {title}
      </AppText>
      {body ? (
        <AppText color={colors.textMuted} style={headline ? undefined : styles.center}>
          {body}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.sm, marginTop: space.xl, marginBottom: space.sm },
  logo: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    backgroundImage: 'linear-gradient(135deg, #3D63FF 0%, #8B5CF6 100%)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  // With the big headline everything lines up on the left edge (one alignment, calmer).
  left: { alignItems: 'flex-start' },
  headline: { alignSelf: 'stretch', fontSize: 48, lineHeight: 52, marginBottom: space.lg },
});
