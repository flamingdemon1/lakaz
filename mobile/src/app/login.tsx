/**
 * app/login.tsx — DEMO login screen.
 * Owner: Person 3/4 (Fahim, Zuhayr).
 * Real sign-in (Supabase Auth) belongs to Person 2's backend work; until it exists this
 * screen just signs in the fictional caregiver c-01. It is labelled as a demo login.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Screen, SimulatedTag } from '@/components/ui';
import { useLakaz } from '@/data/store';
import { colors, radius, space } from '@/theme';

/** One-tap demo login, then go to Home. */
export default function Login() {
  const { login } = useLakaz();

  const onLogin = () => {
    login();
    router.replace('/');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Ionicons name="home" size={40} color={colors.white} />
        </View>
        <AppText variant="hero" color={colors.primary}>
          LAKAZ
        </AppText>
        <AppText variant="heading" style={styles.center}>
          Kan li sorti, ou kone.
        </AppText>
        <AppText color={colors.textMuted} style={styles.center}>
          When they leave, you know.
        </AppText>
      </View>

      <Card style={styles.gap}>
        <SimulatedTag text="DEMO LOGIN" />
        <AppText variant="bodyBold">Caregiver: Demo caregiver (primary)</AppText>
        <AppText variant="small" color={colors.textMuted}>
          Caring for Marie-Claire, 74, Rose-Hill (fictional demo person).
        </AppText>
        <Button label="Continue as demo caregiver" icon="log-in" size="lg" onPress={onLogin} />
      </Card>

      <Button label="Open community responder page" icon="people" tone="ghost" onPress={() => router.push('/responder')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: space.sm, marginTop: space.xxxl, marginBottom: space.xl },
  logo: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  center: { textAlign: 'center' },
  gap: { gap: space.md },
});
