/**
 * app/_layout.tsx — root of the app: loads fonts, provides data, defines the screen stack.
 * Owner: Person 3 (Fahim, Zuhayr).
 *
 * Routes:
 *   /login          demo login
 *   /(tabs)         Home · Alerts · Device   (caregiver app, needs demo login)
 *   /alert/[id]     alert detail (ladder, map, "I've got it")
 *   /responder      community responder page — opened from a QR on the web, no login, no install
 */
import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
  useFonts,
} from '@expo-google-fonts/atkinson-hyperlegible';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/data/auth';
import { LakazProvider } from '@/data/store';
import { colors, fonts } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Root component. Waits for the font so text doesn't jump after first paint. */
export default function RootLayout() {
  const [loaded, error] = useFonts({ AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold });

  useEffect(() => {
    // Why also on error: a missing font must never leave the phone stuck on the splash screen.
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <LakazProvider>
        {/* AuthProvider sits inside LakazProvider because logging in/out opens/closes the caregiver tabs. */}
        <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTitleStyle: { fontFamily: fonts.bold, fontSize: 20 },
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.background },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="alert/[id]" options={{ title: 'Alert', headerBackTitle: 'Back' }} />
          <Stack.Screen name="responder" options={{ headerShown: false, title: 'LAKAZ community alert' }} />
          {/* Help alert + acknowledge — the checkpoint flow agreed with the backend (docs/handoff.md). */}
          <Stack.Screen name="help-alert" options={{ title: 'Help alerts', headerBackTitle: 'Back' }} />
          {/* Account screens (SAMPLE auth, src/data/auth.tsx). */}
          <Stack.Screen name="signup" options={{ title: '', headerBackTitle: 'Back' }} />
          <Stack.Screen name="verify" options={{ title: '', headerBackTitle: 'Back' }} />
          <Stack.Screen name="otp" options={{ title: '', headerBackTitle: 'Back' }} />
          <Stack.Screen name="forgot-password" options={{ title: '', headerBackTitle: 'Back' }} />
          <Stack.Screen name="security" options={{ title: 'Account security', headerBackTitle: 'Back' }} />
          <Stack.Screen name="trusted" options={{ title: 'Trusted circle', headerBackTitle: 'Back' }} />
        </Stack>
        </AuthProvider>
      </LakazProvider>
    </SafeAreaProvider>
  );
}
