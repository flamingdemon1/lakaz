/**
 * app/(tabs)/_layout.tsx — bottom tabs for the caregiver app (Home · Alerts · Band).
 * Owner: Person 3 (Fahim, Zuhayr).
 * Also mounts <IncomingAlert/>, so a new alert takes over the screen whatever tab you are on.
 * Max 3 tabs on purpose: fewer choices for a stressed caregiver.
 */
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';

import { IncomingAlert } from '@/components/IncomingAlert';
import { isOpen, useLakaz } from '@/data/store';
import { colors, fonts, statusStyles } from '@/theme';

/** Tab bar. Redirects to /login until the demo caregiver has signed in. */
export default function TabsLayout() {
  const { me, alerts } = useLakaz();
  if (!me) return <Redirect href="/login" />;

  const openCount = alerts.filter(isOpen).length;

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 13 },
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, minHeight: 64, paddingTop: 6 },
        }}>
        <Tabs.Screen
          name="index"
          options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color as string} size={size} /> }}
        />
        <Tabs.Screen
          name="alerts"
          options={{
            title: 'Alerts',
            tabBarIcon: ({ color, size }) => <Ionicons name="notifications" color={color as string} size={size} />,
            tabBarBadge: openCount > 0 ? openCount : undefined,
            tabBarBadgeStyle: { backgroundColor: statusStyles.Critical.bg, fontFamily: fonts.bold },
          }}
        />
        <Tabs.Screen
          name="device"
          options={{ title: 'Band', tabBarIcon: ({ color, size }) => <Ionicons name="watch" color={color as string} size={size} /> }}
        />
      </Tabs>
      <IncomingAlert />
    </>
  );
}
