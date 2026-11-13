/**
 * AuthHeader.tsx — logo + title block at the top of every account screen.
 * Owner: Person 3/4 (Zuhayr).
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, space } from '@/theme';

/** Inputs: title (big) and an optional one-line explanation. */
export function AuthHeader({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.logo}>
        <Ionicons name="home" size={30} color={colors.white} />
      </View>
      <AppText variant="title" accessibilityRole="header" style={styles.center}>
        {title}
      </AppText>
      {body ? (
        <AppText color={colors.textMuted} style={styles.center}>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
});
