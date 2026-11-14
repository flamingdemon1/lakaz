/**
 * AddPersonLive.tsx — ADD A PERSON for real (live Supabase): who they are + the code on their band, in one step.
 * Owner: Person 3 (Zuhayr). Backend: RPC claim_device_for_person (Shihad, migration 20261114040000).
 *
 * Why one step: in Lakaz a person is the wearer of a band. Saving the person and linking the band together means
 * a new carer (e.g. a judge) goes from "new account" to "this person's live alerts" without any sample data.
 * The server starts the band's history afresh, so the previous wearer's alerts are hidden (not deleted).
 * Emergency contacts and medical notes are not stored yet, so this form doesn't ask for them.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FormError, TextField } from '@/components/forms';
import { AppText, Button, Card } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { assignBandToPerson, AssignedBand } from '@/data/helpAlert';
import { colors, space } from '@/theme';

/** Inputs: onDone(band) after the server confirms. Shows the error in plain words otherwise. */
export function AddPersonLive({ onDone }: { onDone: (band: AssignedBand) => void }) {
  const { t } = useAuth();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [area, setArea] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Sends person + band code together; success only after Supabase confirms the link. */
  const onSave = async () => {
    setBusy(true);
    setError(null);
    try {
      const band = await assignBandToPerson(code, { name, age: age ? Number(age) : null, area: area || null });
      onDone(band);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.gap}>
      <AppText variant="title" accessibilityRole="header">
        {t('addPersonTitle')}
      </AppText>
      <AppText color={colors.textMuted}>{t('addPersonBody')}</AppText>

      <Card style={styles.gap}>
        <TextField label={t('apName')} value={name} onChangeText={setName} autoCapitalize="words" placeholder={t('apNamePh')} />
        <TextField
          label={t('apAge')}
          value={age}
          onChangeText={(v) => setAge(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={3}
          placeholder="74"
        />
        <TextField label={t('apArea')} value={area} onChangeText={setArea} autoCapitalize="words" placeholder={t('apAreaPh')} />
      </Card>

      <Card style={styles.gap}>
        <View style={styles.row}>
          <Ionicons name="watch" size={22} color={colors.link} />
          <AppText variant="bodyBold">{t('apBandTitle')}</AppText>
        </View>
        <TextField
          label={t('linkCodeLabel')}
          value={code}
          onChangeText={(v) => {
            setCode(v.toUpperCase());
            setError(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="LKZ-1307"
          returnKeyType="go"
          onSubmitEditing={onSave}
          helper={t('apCodeHelp')}
        />
        <FormError message={error} />
        <Button label={t('apSave')} icon="person-add" size="lg" loading={busy} onPress={onSave} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
