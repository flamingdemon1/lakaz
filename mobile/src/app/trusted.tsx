/**
 * app/trusted.tsx — TRUSTED FAMILY & CAREGIVERS: who gets alerts, and in which order.
 * Owner: Person 3/4 (Zuhayr). Exactly one PRIMARY (gets level 1 first); the rest are SECONDARY (level 2).
 * SAMPLE: nobody is invited or messaged. Fictional people only.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FormError, TextField } from '@/components/forms';
import { AppText, Button, Card, Screen, SimulatedTag } from '@/components/ui';
import { TrustedPerson, useAuth } from '@/data/auth';
import { checkName, checkPhone } from '@/lib/validate';
import { colors, radius, space, statusStyles } from '@/theme';

/** Trusted circle screen: list + add form. */
export default function Trusted() {
  const { t, trusted, addTrusted } = useAuth();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', phone: '', relationship: '' });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errs = {
    name: checkName(f.name),
    phone: checkPhone(f.phone),
    relationship: f.relationship.trim() ? null : 'e.g. Son, Neighbour, Nurse',
  };
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  /** Adds a person as SECONDARY. */
  const onAdd = async () => {
    setTried(true);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    setError(null);
    try {
      await addTrusted(f);
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
  const ordered = [...trusted].sort((a, b) => (a.role === b.role ? 0 : a.role === 'primary' ? -1 : 1));

  return (
    <Screen edges={['bottom']}>
      <View style={styles.top}>
        <SimulatedTag text="SAMPLE" />
        <AppText color={colors.textMuted} style={styles.flex}>
          {t('trustedBody')}
        </AppText>
      </View>

      {ordered.map((p, i) => (
        <PersonRow key={p.id} person={p} order={i + 1} />
      ))}

      {adding ? (
        <Card style={styles.gap}>
          <AppText variant="heading">{t('addPerson')}</AppText>
          <TextField label={t('fullName')} value={f.name} onChangeText={set('name')} error={tried ? errs.name : null} />
          <TextField
            label={t('phone')}
            value={f.phone}
            onChangeText={set('phone')}
            keyboardType="phone-pad"
            placeholder="5xxx xxxx"
            error={tried ? errs.phone : null}
          />
          <TextField
            label={t('relationship')}
            value={f.relationship}
            onChangeText={set('relationship')}
            placeholder="Son, Neighbour, Nurse…"
            error={tried ? errs.relationship : null}
          />
          <FormError message={error} />
          <Button label={t('add')} icon="person-add" loading={busy} onPress={onAdd} />
          <Button label={t('cancel')} tone="ghost" onPress={() => { setAdding(false); setError(null); setTried(false); }} />
        </Card>
      ) : (
        <Button label={t('addPerson')} icon="person-add" tone="secondary" onPress={() => setAdding(true)} />
      )}
    </Screen>
  );
}

/** One person card with role pill and actions. */
function PersonRow({ person, order }: { person: TrustedPerson; order: number }) {
  const { t, user, makePrimary, removeTrusted } = useAuth();
  const [busy, setBusy] = useState<'primary' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const primary = person.role === 'primary';
  // "You" = the row whose phone matches the signed-in account (not a fixed flag).
  const isMe = !!user && person.phone === user.phone;

  /** Runs one action and shows its error under the card. */
  const run = async (kind: 'primary' | 'remove') => {
    setBusy(kind);
    setError(null);
    try {
      await (kind === 'primary' ? makePrimary(person.id) : removeTrusted(person.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card style={styles.gap}>
      <View style={styles.personTop}>
        <View style={[styles.order, primary && styles.orderPrimary]}>
          <AppText variant="bodyBold" color={primary ? colors.white : colors.text}>
            {order}
          </AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyBold">
            {person.name}
            {isMe ? ` (${t('you')})` : ''}
          </AppText>
          <AppText variant="small" color={colors.textMuted}>
            {person.relationship} · {person.phone}
          </AppText>
        </View>
        <View style={[styles.pill, { backgroundColor: primary ? statusStyles.Acknowledged.bg : colors.muted }]}>
          <Ionicons name={primary ? 'star' : 'person'} size={12} color={primary ? colors.white : colors.textMuted} />
          <AppText variant="label" color={primary ? colors.white : colors.textMuted}>
            {(primary ? t('primary') : t('secondary')).toUpperCase()}
          </AppText>
        </View>
      </View>
      {!primary ? (
        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button label={t('makePrimary')} icon="star" tone="secondary" loading={busy === 'primary'} onPress={() => run('primary')} />
          </View>
          {!isMe ? (
            <View style={styles.flex}>
              <Button label={t('remove')} icon="trash" tone="ghost" loading={busy === 'remove'} onPress={() => run('remove')} />
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
  personTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  order: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  orderPrimary: { backgroundColor: statusStyles.Acknowledged.bg },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill },
  actions: { flexDirection: 'row', gap: space.sm },
});
