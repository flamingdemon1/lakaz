/**
 * app/escalation.tsx — ESCALATION SETTINGS: demo vs real timers, community-alert rules, automatic
 * live tracking at level 2, and who the primary / secondary contacts are.
 * Owner: Person 3/4 (Zuhayr). Data: src/data/escalation.tsx (+ guardians in src/data/people.tsx).
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText, Button, Card, IconName, Screen, SectionTitle, SimulatedTag } from '@/components/ui';
import { fmtDelay, TimerMode, TIMERS, useEscalation } from '@/data/escalation';
import { usePeople } from '@/data/people';
import { colors, radius, space, statusStyles, TOUCH } from '@/theme';

/** Escalation settings screen (demo person p-01). */
export default function EscalationSettings() {
  const { settings, update, timers } = useEscalation();
  const { get } = usePeople();
  const p = get('p-01');
  const primary = p?.guardians.find((g) => g.role === 'primary');
  const secondary = p?.guardians.filter((g) => g.role === 'secondary') ?? [];

  const steps: { icon: IconName; title: string; who: string; after: string }[] = [
    { icon: 'watch', title: 'Band vibrates + Kreol voice warning', who: 'The person', after: '0 s' },
    { icon: 'person', title: 'Primary caregiver alerted', who: primary ? `${primary.name} (${primary.relationship})` : 'Not set!', after: fmtDelay(timers.l1) },
    {
      icon: 'people',
      title: 'Secondary caregiver(s) + live tracking',
      who: secondary.length ? secondary.map((g) => g.name).join(', ') : 'None — add one!',
      after: fmtDelay(timers.l2),
    },
    {
      icon: 'megaphone',
      title: 'Community alert (if the rules allow)',
      who: settings.communityEnabled ? 'Verified, opted-in responders nearby' : 'Switched off',
      after: fmtDelay(timers.l3),
    },
  ];

  return (
    <Screen edges={['bottom']}>
      <View style={styles.top}>
        <AppText variant="title" style={styles.flex}>
          Escalation for {p?.name ?? '—'}
        </AppText>
        <SimulatedTag text="SAMPLE" />
      </View>
      <AppText color={colors.textMuted}>If nobody responds, LAKAZ moves up one step at a time. Acknowledging stops it.</AppText>

      <SectionTitle>Timers</SectionTitle>
      <View style={styles.segment} accessibilityRole="radiogroup">
        {(['demo', 'real'] as TimerMode[]).map((m) => {
          const on = settings.timerMode === m;
          const t = TIMERS[m];
          return (
            <Pressable
              key={m}
              onPress={() => update({ timerMode: m })}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              aria-checked={on}
              style={[styles.seg, on && styles.segOn]}>
              <AppText variant="bodyBold" color={on ? colors.white : colors.text}>
                {m === 'demo' ? 'Demo' : 'Real'}
              </AppText>
              <AppText variant="small" color={on ? 'rgba(255,255,255,0.9)' : colors.textMuted}>
                {fmtDelay(t.l1)} / {fmtDelay(t.l2)} / {fmtDelay(t.l3)}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <AppText variant="small" color={colors.textMuted}>
        Real timers follow the plan: 2 / 7 / 15 min (15 min is when the Alzheimer's Association advises calling the
        authorities). Demo timers are for the stage.
      </AppText>

      <SectionTitle>The ladder</SectionTitle>
      <Card>
        {steps.map((s, i) => (
          <View key={s.title} style={[styles.step, i > 0 && styles.divider]}>
            <View style={styles.badge}>
              <AppText variant="smallBold" color={colors.white}>
                {i}
              </AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="bodyBold">{s.title}</AppText>
              <AppText variant="small" color={colors.textMuted}>
                {s.who}
              </AppText>
            </View>
            <AppText variant="smallBold" color={colors.link}>
              {s.after}
            </AppText>
          </View>
        ))}
      </Card>
      <Button
        label="Edit primary & secondary contacts"
        icon="people"
        tone="secondary"
        onPress={() => router.push({ pathname: '/person/[id]/guardians', params: { id: 'p-01' } })}
      />

      <SectionTitle>Rules</SectionTitle>
      <Card>
        <ToggleRow
          icon="megaphone"
          title="Allow community alerts (step 3)"
          sub="Only for exits and SOS, only if nobody acknowledged. Responders see last known location, never live tracking."
          value={settings.communityEnabled}
          onChange={(v) => update({ communityEnabled: v })}
        />
        <ToggleRow
          icon="radio"
          title="Start live tracking at step 2"
          sub="Visible to the primary and secondary caregivers only. Stops when the incident is closed."
          value={settings.autoTracking}
          onChange={(v) => update({ autoTracking: v })}
          last
        />
      </Card>
      <Card style={styles.note}>
        <Ionicons name="information-circle" size={20} color={colors.link} />
        <AppText variant="small" style={styles.flex}>
          In the real system the server runs this ladder; this app shows it, alerts each person in the app, and lets you act.
        </AppText>
      </Card>
    </Screen>
  );
}

/** Row with title, explanation and a switch; whole row toggles. */
function ToggleRow({
  icon,
  title,
  sub,
  value,
  onChange,
  last,
}: {
  icon: IconName;
  title: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      aria-checked={value}
      accessibilityLabel={title}
      style={[styles.toggle, !last && styles.divider]}>
      <Ionicons name={icon} size={22} color={value ? colors.link : colors.textMuted} />
      <View style={styles.flex}>
        <AppText variant="bodyBold">{title}</AppText>
        <AppText variant="small" color={colors.textMuted}>
          {sub}
        </AppText>
      </View>
      {/* Display-only: the row handles taps (avoids a double toggle on web). */}
      <View pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Switch value={value} trackColor={{ true: colors.primary, false: colors.border }} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  flex: { flex: 1 },
  segment: { flexDirection: 'row', gap: space.sm },
  seg: {
    flex: 1,
    alignItems: 'center',
    minHeight: TOUCH + 16,
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  segOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  badge: { width: 28, height: 28, borderRadius: 14, backgroundColor: statusStyles.Active.bg, alignItems: 'center', justifyContent: 'center' },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH + 12, paddingVertical: space.sm },
  note: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
});
