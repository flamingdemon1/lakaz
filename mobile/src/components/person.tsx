/**
 * person.tsx — building blocks for person management: avatar, safety-profile picker,
 * device picker, device-connection card, and the shared add/edit PersonForm.
 * Owner: Person 3/4 (Zuhayr).
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FormError, TextField } from '@/components/forms';
import { AppText, Button, Card, SectionTitle, SimulatedTag } from '@/components/ui';
import {
  AVATAR_COLORS,
  CaredPerson,
  initialsOf,
  PersonInput,
  PROFILE_INFO,
  SafetyProfile,
  usePeople,
  WearableDevice,
} from '@/data/people';
import { isOnline } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { checkName, checkPhone } from '@/lib/validate';
import { colors, radius, space, statusStyles, TOUCH } from '@/theme';

/** Round initials avatar. Inputs: name, colour, size. */
export function Avatar({ name, color, size = 56 }: { name: string; color: string; size?: number }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}
      accessibilityLabel={`${name || 'New person'} avatar`}>
      <AppText variant={size >= 64 ? 'hero' : 'title'} color={colors.white}>
        {initialsOf(name)}
      </AppText>
    </View>
  );
}

/** Small chip with the safety-profile icon + name (+ SIMULATION tag where relevant). */
export function ProfileChip({ profile }: { profile: SafetyProfile }) {
  const info = PROFILE_INFO[profile];
  return (
    <View style={styles.chipRow}>
      <View style={styles.chip}>
        <Ionicons name={info.icon} size={14} color={colors.link} />
        <AppText variant="label" color={colors.link}>
          {info.title.toUpperCase()}
        </AppText>
      </View>
      {info.simulated ? <SimulatedTag text="SIMULATION" /> : null}
    </View>
  );
}

/** Three big radio cards for the safety profile. */
export function ProfilePicker({ value, onChange }: { value: SafetyProfile; onChange: (p: SafetyProfile) => void }) {
  return (
    <View style={styles.gapSm} accessibilityRole="radiogroup">
      {(Object.keys(PROFILE_INFO) as SafetyProfile[]).map((p) => {
        const info = PROFILE_INFO[p];
        const on = p === value;
        return (
          <Pressable
            key={p}
            onPress={() => onChange(p)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            aria-checked={on}
            style={[styles.profileCard, on && styles.profileOn]}>
            <View style={[styles.profileIcon, on && { backgroundColor: colors.primary }]}>
              <Ionicons name={info.icon} size={22} color={on ? colors.white : colors.link} />
            </View>
            <View style={styles.flex}>
              <View style={styles.chipRow}>
                <AppText variant="bodyBold">{info.title}</AppText>
                {info.simulated ? <SimulatedTag text="SIMULATION" /> : null}
              </View>
              <AppText variant="small" color={colors.textMuted}>
                {info.body}
              </AppText>
            </View>
            <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={24} color={on ? colors.link : colors.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Device picker: "No device" + every band, showing who else uses it.
 * Picking a band that someone else uses moves it (one band per person). Also lets you add a band by ID.
 */
export function DevicePicker({
  value,
  onChange,
  personId,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  personId?: string;
}) {
  const { devices, ownerOf, addDevice } = usePeople();
  const [newId, setNewId] = useState('');
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /** Adds a band by its printed ID, then selects it. */
  const onAdd = async () => {
    setAdding(true);
    setErr(null);
    try {
      await addDevice(newId);
      onChange(newId.trim().toLowerCase());
      setNewId('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const options: (WearableDevice | null)[] = [null, ...devices];
  return (
    <View style={styles.gapSm} accessibilityRole="radiogroup">
      {options.map((d) => {
        const id = d?.device_id ?? null;
        const on = id === value;
        const owner = id ? ownerOf(id) : undefined;
        const usedByOther = owner && owner.id !== personId;
        return (
          <Pressable
            key={id ?? 'none'}
            onPress={() => onChange(id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            aria-checked={on}
            style={[styles.deviceRow, on && styles.profileOn]}>
            <Ionicons name={id ? 'watch' : 'remove-circle-outline'} size={22} color={on ? colors.link : colors.textMuted} />
            <View style={styles.flex}>
              <AppText variant="bodyBold">{d ? d.device_id : 'No device yet'}</AppText>
              <AppText variant="small" color={usedByOther ? statusStyles.Active.bg : colors.textMuted}>
                {d ? (usedByOther ? `Used by ${owner!.name} — will move to this person` : d.label) : 'You can assign one later'}
              </AppText>
            </View>
            <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={24} color={on ? colors.link : colors.textMuted} />
          </Pressable>
        );
      })}
      <View style={styles.addDevice}>
        <View style={styles.flex}>
          <TextField label="Add a band by ID" value={newId} onChangeText={setNewId} autoCapitalize="none" placeholder="band-03" error={err} />
        </View>
        <View style={styles.addBtn}>
          <Button label="Add" icon="add" tone="secondary" loading={adding} disabled={!newId.trim()} onPress={onAdd} />
        </View>
      </View>
    </View>
  );
}

/**
 * Device connection card: online/offline status.
 * Bluetooth and cellular status are TBD in scope (section 4), so they are NOT shown.
 */
export function DeviceConnection({ person }: { person: CaredPerson }) {
  const { deviceOf } = usePeople();
  const now = useNow();
  const d = deviceOf(person);
  if (!d) {
    return (
      <Card style={styles.rowCard}>
        <Ionicons name="watch-outline" size={26} color={colors.textMuted} />
        <AppText color={colors.textMuted} style={styles.flex}>
          No wearable assigned yet.
        </AppText>
      </Card>
    );
  }
  const online = isOnline({ device_id: d.device_id, battery_pct: d.battery_pct, last_seen: d.last_seen, gps_fix: null }, now);
  return (
    <Card style={styles.gapSm}>
      <View style={styles.rowCard}>
        <View style={[styles.ring, { borderColor: online ? colors.primary : colors.offline }]}>
          <Ionicons name="watch" size={24} color={online ? colors.link : colors.offline} />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyBold">
            {d.device_id} · {online ? 'Online' : 'Offline'}
          </AppText>
        </View>
        <SimulatedTag text="SAMPLE" />
      </View>
      {!online ? (
        <AppText variant="small" color={colors.textMuted}>
          Check the band is charged and near the home Wi-Fi/hotspot.
        </AppText>
      ) : null}
    </Card>
  );
}

/**
 * Add/edit form for a person. Sections: basics + avatar, safety profile, emergency contact,
 * medical (optional), wearable. Inputs: initial values, submit label, onSubmit.
 */
export function PersonForm({
  initial,
  personId,
  submitLabel,
  onSubmit,
}: {
  initial: PersonInput;
  personId?: string;
  submitLabel: string;
  onSubmit: (p: PersonInput) => Promise<void>;
}) {
  const [f, setF] = useState<PersonInput>(initial);
  const [ageText, setAgeText] = useState(initial.age ? String(initial.age) : '');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const age = Number(ageText);
  const errs = {
    name: checkName(f.name),
    // Why 1–120: catches typos like 740 without blocking real ages.
    age: Number.isInteger(age) && age >= 1 && age <= 120 ? null : 'Enter an age between 1 and 120.',
    eName: checkName(f.emergency.name),
    ePhone: checkPhone(f.emergency.phone),
    eRel: f.emergency.relationship.trim() ? null : 'e.g. Son, Neighbour',
  };
  const show = (k: keyof typeof errs) => (tried ? errs[k] : null);
  const setE = (k: keyof PersonInput['emergency']) => (v: string) => setF((s) => ({ ...s, emergency: { ...s.emergency, [k]: v } }));
  const setM = (k: keyof PersonInput['medical']) => (v: string) => setF((s) => ({ ...s, medical: { ...s.medical, [k]: v } }));

  /** Validates every section, then saves. Scrolls are left to the user; errors sit next to each field. */
  const submit = async () => {
    setTried(true);
    if (Object.values(errs).some(Boolean)) {
      setError('Some fields need fixing — see the red messages.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ ...f, age });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionTitle>Basics</SectionTitle>
      <Card style={styles.gap}>
        <View style={styles.rowCard}>
          <Avatar name={f.name} color={f.avatarColor} size={64} />
          <View style={[styles.flex, styles.gapSm]}>
            <AppText variant="smallBold">Avatar colour</AppText>
            <View style={styles.swatches} accessibilityRole="radiogroup">
              {AVATAR_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setF((s) => ({ ...s, avatarColor: c }))}
                  accessibilityRole="radio"
                  accessibilityLabel={`Colour ${c}`}
                  accessibilityState={{ checked: c === f.avatarColor }}
                  aria-checked={c === f.avatarColor}
                  hitSlop={6}
                  style={[styles.swatch, { backgroundColor: c }, c === f.avatarColor && styles.swatchOn]}
                />
              ))}
            </View>
          </View>
        </View>
        <AppText variant="small" color={colors.textMuted}>
          Photo upload comes later (needs an extra package the team must approve).
        </AppText>
        <TextField label="Full name" value={f.name} onChangeText={(v) => setF((s) => ({ ...s, name: v }))} error={show('name')} />
        <TextField label="Age" value={ageText} onChangeText={(v) => setAgeText(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={3} error={show('age')} />
      </Card>

      <SectionTitle>Safety profile</SectionTitle>
      <ProfilePicker value={f.profile} onChange={(p) => setF((s) => ({ ...s, profile: p }))} />

      <SectionTitle>Emergency contact</SectionTitle>
      <Card style={styles.gap}>
        <TextField label="Contact name" value={f.emergency.name} onChangeText={setE('name')} error={show('eName')} />
        <TextField
          label="Contact phone"
          value={f.emergency.phone}
          onChangeText={setE('phone')}
          keyboardType="phone-pad"
          placeholder="5xxx xxxx"
          error={show('ePhone')}
        />
        <TextField label="Relationship" value={f.emergency.relationship} onChangeText={setE('relationship')} placeholder="Son, Neighbour…" error={show('eRel')} />
      </Card>

      <SectionTitle right={<AppText variant="small" color={colors.textMuted}>Optional</AppText>}>Medical & safety notes</SectionTitle>
      <Card style={styles.gap}>
        <View style={styles.privacy}>
          <Ionicons name="lock-closed" size={18} color={colors.link} />
          <AppText variant="small" style={styles.flex}>
            Only guardians see this. It is never shown to community responders. Only add what helps keep them safe.
          </AppText>
        </View>
        <TextField label="Conditions" value={f.medical.conditions} onChangeText={setM('conditions')} placeholder="e.g. dementia, diabetes" />
        <TextField label="Allergies" value={f.medical.allergies} onChangeText={setM('allergies')} />
        <TextField label="Medication" value={f.medical.medications} onChangeText={setM('medications')} />
        <TextField label="How to help" value={f.medical.notes} onChangeText={setM('notes')} placeholder="e.g. speaks Kreol, calm voice" multiline />
      </Card>

      <SectionTitle>Wearable</SectionTitle>
      <DevicePicker value={f.device_id} onChange={(id) => setF((s) => ({ ...s, device_id: id }))} personId={personId} />

      <FormError message={error} />
      <Button label={submitLabel} icon="checkmark" size="lg" loading={busy} onPress={submit} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.md },
  gapSm: { gap: space.sm },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    minHeight: TOUCH + 16,
  },
  profileOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  profileIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    minHeight: TOUCH + 8,
  },
  addDevice: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  addBtn: { width: 96, marginBottom: 2 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  ring: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  swatches: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  swatch: { width: 32, height: 32, borderRadius: 16 },
  swatchOn: { borderWidth: 3, borderColor: colors.text },
  privacy: { flexDirection: 'row', gap: space.sm, alignItems: 'center', padding: space.md, borderRadius: radius.md, backgroundColor: colors.muted },
});
