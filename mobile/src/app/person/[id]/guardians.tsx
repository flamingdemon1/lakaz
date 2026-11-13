/**
 * app/person/[id]/guardians.tsx — AUTHORISED GUARDIANS & CAREGIVERS for one person, in alert order.
 * Owner: Person 3/4 (Zuhayr). Exactly one PRIMARY (first alert, level 1); the rest SECONDARY (level 2).
 * SAMPLE: nobody is invited or messaged. Fictional people only.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FormError, TextField } from '@/components/forms';
import { AppText, Button, Card, EmptyState, Screen, SimulatedTag } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { Guardian, usePeople } from '@/data/people';
import { checkName, checkPhone } from '@/lib/validate';
import { colors, radius, space, statusStyles } from '@/theme';

/** Guardians screen: list in alert order + add form. */
export default function Guardians() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { get, addGuardian } = usePeople();
  const p = get(id);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', phone: '', relationship: '' });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!p) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon="help-circle" title="Person not found" />
      </Screen>
    );
  }

  const errs = {
    name: checkName(f.name),
    phone: checkPhone(f.phone),
    relationship: f.relationship.trim() ? null : 'e.g. Son, Neighbour, Nurse',
  };
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  /** Adds a guardian as SECONDARY. */
  const onAdd = async () => {
    setTried(true);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    setError(null);
    try {
      await addGuardian(p.id, f);
      setF({ name: '', phone: '', relationship: '' });
      setTried(false);
      setAdding(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Primary first, so the list reads in alert order.
  const ordered = [...p.guardians].sort((a, b) => (a.role === b.role ? 0 : a.role === 'primary' ? -1 : 1));

  return (
    <Screen edges={['bottom']}>
      <View style={styles.top}>
        <SimulatedTag text="SAMPLE" />
        <AppText color={colors.textMuted} style={styles.flex}>
          These people get alerts for {p.name}, in this order.
        </AppText>
      </View>

      {ordered.map((g, i) => (
        <GuardianRow key={g.id} personId={p.id} guardian={g} order={i + 1} />
      ))}

      {adding ? (
        <Card style={styles.gap}>
          <AppText variant="heading">Add a guardian</AppText>
          <TextField label="Full name" value={f.name} onChangeText={set('name')} error={tried ? errs.name : null} />
          <TextField label="Phone number" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="5xxx xxxx" error={tried ? errs.phone : null} />
          <TextField label="Relationship" value={f.relationship} onChangeText={set('relationship')} placeholder="Son, Neighbour, Nurse…" error={tried ? errs.relationship : null} />
          <FormError message={error} />
          <Button label="Add" icon="person-add" loading={busy} onPress={onAdd} />
          <Button label="Cancel" tone="ghost" onPress={() => { setAdding(false); setError(null); setTried(false); }} />
        </Card>
      ) : (
        <Button label="Add a guardian" icon="person-add" tone="secondary" onPress={() => setAdding(true)} />
      )}
    </Screen>
  );
}

/** One guardian card with role pill and actions. "You" = matches the signed-in phone. */
function GuardianRow({ personId, guardian: g, order }: { personId: string; guardian: Guardian; order: number }) {
  const { makePrimary, removeGuardian } = usePeople();
  const { user } = useAuth();
  const [busy, setBusy] = useState<'primary' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const primary = g.role === 'primary';
  const isMe = !!user && g.phone === user.phone;

  /** Runs one action and shows its error under the card. */
  const run = async (kind: 'primary' | 'remove') => {
    setBusy(kind);
    setError(null);
    try {
      await (kind === 'primary' ? makePrimary(personId, g.id) : removeGuardian(personId, g.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card style={styles.gap}>
      <View style={styles.row}>
        <View style={[styles.order, primary && styles.orderPrimary]}>
          <AppText variant="bodyBold" color={primary ? colors.white : colors.text}>
            {order}
          </AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyBold">
            {g.name}
            {isMe ? ' (You)' : ''}
          </AppText>
          <AppText variant="small" color={colors.textMuted}>
            {g.relationship} · {g.phone}
          </AppText>
        </View>
        <View style={[styles.pill, { backgroundColor: primary ? statusStyles.Acknowledged.bg : colors.muted }]}>
          <Ionicons name={primary ? 'star' : 'person'} size={12} color={primary ? colors.white : colors.textMuted} />
          <AppText variant="label" color={primary ? colors.white : colors.textMuted}>
            {primary ? 'PRIMARY' : 'SECONDARY'}
          </AppText>
        </View>
      </View>
      {!primary ? (
        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button label="Make primary" icon="star" tone="secondary" loading={busy === 'primary'} onPress={() => run('primary')} />
          </View>
          {/* You can't remove yourself — another guardian would have to. */}
          {!isMe ? (
            <View style={styles.flex}>
              <Button label="Remove" icon="trash" tone="ghost" loading={busy === 'remove'} onPress={() => run('remove')} />
            </View>
          ) : null}
        </View>
      ) : null}
      <FormError message={error} />
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  flex: { flex: 1 },
  gap: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  order: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  orderPrimary: { backgroundColor: statusStyles.Acknowledged.bg },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill },
  actions: { flexDirection: 'row', gap: space.sm },
});
