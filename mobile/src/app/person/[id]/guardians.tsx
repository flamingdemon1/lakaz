/**
 * app/person/[id]/guardians.tsx — AUTHORISED GUARDIANS & CAREGIVERS for one person, in alert order.
 * Owner: Person 3/4 (Fahim, Zuhayr). Exactly one PRIMARY (first alert, level 1); the rest SECONDARY (level 2).
 * Live mode reads linked carer names from Supabase. Sample mode retains fictional guardian editing.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FormError, TextField } from '@/components/forms';
import { AppText, Button, Card, EmptyState, Screen, SimulatedTag } from '@/components/ui';
import { USE_MOCK } from '@/config';
import { fetchBands } from '@/data/bands';
import { currentUser, rpc } from '@/data/supabase';
import { useAuth } from '@/data/auth';
import { Guardian, usePeople } from '@/data/people';
import { checkName, checkPhone } from '@/lib/validate';
import { colors, radius, space, statusStyles } from '@/theme';

/** Chooses real band membership or the unchanged sample guardian editor. */
export default function Guardians() {
  return USE_MOCK ? <SampleGuardians /> : <LinkedCarers />;
}

interface LinkedCarer {
  carer_id: string;
  name: string | null;
}

/** Reads names for the first linked band without implying an escalation order or exposing contacts. */
function LinkedCarers() {
  const { user, t } = useAuth();
  const [carers, setCarers] = useState<LinkedCarer[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [hasBand, setHasBand] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const accountId = currentUser()?.id;

  useEffect(() => {
    let cancelled = false;
    /** Loads band membership and ignores replies after navigation or an account change. */
    async function load() {
      setLoading(true);
      setFailed(false);
      setCarers([]);
      setHasBand(false);
      try {
        const bands = await fetchBands();
        const band = bands[0];
        const names = band
          ? await rpc<LinkedCarer[]>('linked_carer_names', { p_device_id: band.id })
          : [];
        // A late response must never display the previous account's linked carers.
        if (cancelled || currentUser()?.id !== accountId) return;
        setHasBand(!!band);
        setCarers(names);
      } catch {
        if (!cancelled && currentUser()?.id === accountId) setFailed(true);
      } finally {
        if (!cancelled && currentUser()?.id === accountId) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [user?.id, accountId, attempt]);

  return (
    <Screen edges={['bottom']}>
      <AppText color={colors.textMuted}>{t('linkedCarersJoin')}</AppText>
      {loading ? <AppText>{t('linkedCarersLoading')}</AppText> : failed ? (
        <Card style={styles.gap}>
          <AppText>{t('linkedCarersError')}</AppText>
          <Button label={t('linkedCarersRetry')} onPress={() => setAttempt((value) => value + 1)} />
        </Card>
      ) : !hasBand ? (
        <EmptyState icon="watch" title={t('bandNotLinked')} />
      ) : carers.length === 0 ? (
        <EmptyState icon="people" title={t('linkedCarersEmpty')} />
      ) : carers.map((carer) => (
        <Card key={carer.carer_id}>
          <AppText variant="bodyBold">
            {carer.carer_id === accountId ? t('linkedCarersYou') : carer.name?.trim() || t('linkedCarersUnnamed')}
          </AppText>
        </Card>
      ))}
    </Screen>
  );
}

/** Sample guardians screen retains alert order and the local add form. */
function SampleGuardians() {
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
        {/* Sample stores stay sample even when Supabase authentication is live. */}
        <SimulatedTag text="SAMPLE DATA" />
        <AppText variant="small" color={colors.textMuted}>Sample screen: not connected to the band yet.</AppText>
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
      {/* Sample stores stay sample even when Supabase authentication is live. */}
      <SimulatedTag text="SAMPLE DATA" />
      <AppText variant="small" color={colors.textMuted}>Sample screen: not connected to the band yet.</AppText>
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
