/**
 * CallContacts.tsx — one-tap calling during an incident: primary, secondary, the person's emergency
 * contact, and Mauritius emergency services (Police 999, SAMU ambulance 114).
 * Owner: Person 3/4 (Zuhayr).
 *
 * Safety rules:
 *  - Our caregivers' numbers are FICTIONAL sample data → they are NEVER dialled (a made-up number could
 *    belong to a real person). The app shows what it would call instead.
 *  - Real emergency numbers need a SECOND tap ("Tap again to call 999"), so nobody calls by accident on stage.
 *  - Every call attempt is written to the incident timeline.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText, IconName } from '@/components/ui';
import { useEscalation } from '@/data/escalation';
import { usePeople } from '@/data/people';
import { colors, radius, space, statusStyles, TOUCH } from '@/theme';

interface Contact {
  key: string;
  label: string;
  sub: string;
  number: string;
  icon: IconName;
  /** true = real public emergency number (dial after confirm). false = sample (never dial). */
  real: boolean;
}

/** Inputs: personId (for contacts) and alertId (for the timeline). */
export function CallContacts({ personId, alertId }: { personId: string; alertId: string }) {
  const { get } = usePeople();
  const { addTimeline } = useEscalation();
  const p = get(personId);
  const [armed, setArmed] = useState<string | null>(null); // which real number is waiting for its 2nd tap
  const [note, setNote] = useState<string | null>(null);

  // Disarm after 5 s so a forgotten first tap can't turn into a call much later.
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), 5000);
    return () => clearTimeout(t);
  }, [armed]);

  if (!p) return null;
  const primary = p.guardians.find((g) => g.role === 'primary');
  const secondaries = p.guardians.filter((g) => g.role === 'secondary');
  const contacts: Contact[] = [
    ...(primary ? [{ key: primary.id, label: primary.name, sub: `Primary · ${primary.relationship}`, number: primary.phone, icon: 'person' as IconName, real: false }] : []),
    ...secondaries.map((g) => ({ key: g.id, label: g.name, sub: `Secondary · ${g.relationship}`, number: g.phone, icon: 'people' as IconName, real: false })),
    // The person's emergency contact, unless it's already one of the guardians.
    ...(p.emergency.phone && !p.guardians.some((g) => g.phone === p.emergency.phone)
      ? [{ key: 'emergency', label: p.emergency.name, sub: `Emergency contact · ${p.emergency.relationship}`, number: p.emergency.phone, icon: 'call' as IconName, real: false }]
      : []),
    { key: '999', label: 'Police', sub: 'Mauritius emergency', number: '999', icon: 'shield', real: true },
    { key: '114', label: 'SAMU ambulance', sub: 'Mauritius medical emergency', number: '114', icon: 'medkit', real: true },
  ];

  /** Handles a tap: sample → explain, real → arm then dial on the 2nd tap. */
  const onCall = async (c: Contact) => {
    if (!c.real) {
      setNote(`SAMPLE: would call ${c.label} on ${c.number}. Sample numbers are never dialled.`);
      addTimeline(alertId, `Call to ${c.label} (sample number, not dialled)`, 'manual');
      return;
    }
    if (armed !== c.key) {
      setArmed(c.key);
      setNote(null);
      return;
    }
    setArmed(null);
    addTimeline(alertId, `Called ${c.label} (${c.number})`, 'manual');
    try {
      await Linking.openURL(`tel:${c.number}`);
    } catch {
      setNote(Platform.OS === 'web' ? `This browser can't make calls. Dial ${c.number} on a phone.` : `Couldn't open the phone app. Dial ${c.number}.`);
    }
  };

  return (
    <View style={styles.wrap}>
      {contacts.map((c) => {
        const isArmed = armed === c.key;
        return (
          <Pressable
            key={c.key}
            onPress={() => onCall(c)}
            accessibilityRole="button"
            accessibilityLabel={isArmed ? `Tap again to call ${c.label} on ${c.number}` : `Call ${c.label}`}
            style={({ pressed }) => [styles.row, c.real && styles.realRow, isArmed && styles.armed, pressed && styles.pressed]}>
            <View style={[styles.icon, { backgroundColor: c.real ? statusStyles.Critical.soft : colors.muted }]}>
              <Ionicons name={c.icon} size={20} color={c.real ? statusStyles.Critical.bg : colors.link} />
            </View>
            <View style={styles.flex}>
              <AppText variant="bodyBold">{isArmed ? `Tap again to call ${c.number}` : c.label}</AppText>
              <AppText variant="small" color={colors.textMuted}>
                {c.sub} · {c.number}
              </AppText>
            </View>
            <Ionicons name="call" size={22} color={isArmed ? colors.white : c.real ? statusStyles.Critical.bg : colors.link} />
          </Pressable>
        );
      })}
      {note ? (
        <AppText variant="small" color={colors.simulated} accessibilityLiveRegion="polite">
          {note}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: TOUCH + 8,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  realRow: { borderColor: colors.danger },
  armed: { backgroundColor: statusStyles.Critical.bg, borderColor: statusStyles.Critical.bg },
  pressed: { opacity: 0.85 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
