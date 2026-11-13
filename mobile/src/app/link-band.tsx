/**
 * app/link-band.tsx — LINK A BAND: the carer types the code printed on the band and is linked to it.
 * Owner: Person 3 (Zuhayr). Backend: RPC claim_device(p_code) in migration 20261114003000 (Shihad applies it).
 *
 * Why: until now an admin linked each carer to a band by hand in the Supabase SQL editor. With this screen a
 * family member links themselves. The server checks the code, uses the signed-in carer's identity and is
 * retry-safe (linking twice keeps one link). Success is only shown after the server confirms.
 * SAMPLE mode (no Supabase key): the code LKZ-DEMO-0001 works.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FormError, TextField } from '@/components/forms';
import { AppText, Button, Card, Screen, SimulatedTag } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { claimBand, IS_SAMPLE } from '@/data/helpAlert';
import { fill } from '@/i18n';
import { colors, space, statusStyles } from '@/theme';

/** Screen: one code field → "Link this band" → confirmation from the server (or the error, in plain words). */
export default function LinkBand() {
  const { t } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState<string | null>(null);

  /** Sends the code; shows the band's name only after Supabase confirms the link. */
  const onLink = async () => {
    setBusy(true);
    setError(null);
    setLinked(null);
    try {
      const band = await claimBand(code);
      setLinked(band.label ?? t('unnamedBand'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: t('linkBand') }} />
      {IS_SAMPLE ? <SimulatedTag text="SAMPLE DATA" /> : null}
      <AppText color={colors.textMuted}>{t('linkBandBody')}</AppText>

      <Card style={styles.gap}>
        <TextField
          label={t('linkCodeLabel')}
          value={code}
          onChangeText={(v) => {
            setCode(v.toUpperCase());
            setError(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="LKZ-XXXX-XXXX"
          returnKeyType="go"
          onSubmitEditing={onLink}
          helper={IS_SAMPLE ? t('linkSampleHint') : undefined}
        />
        <FormError message={error} />
        <Button label={t('linkBandBtn')} icon="link" size="lg" loading={busy} onPress={onLink} />
      </Card>

      {linked ? (
        <View style={styles.ok} accessibilityLiveRegion="polite">
          {/* Green = done ✓ (theme colour code). */}
          <Ionicons name="checkmark-circle" size={24} color={statusStyles.Resolved.bg} />
          <AppText style={styles.flex}>{fill(t('linkedOk'), { name: linked })}</AppText>
        </View>
      ) : null}
      {linked ? <Button label={t('actHelpAlerts')} icon="megaphone" tone="secondary" onPress={() => router.back()} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  ok: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: 12,
    backgroundColor: statusStyles.Resolved.soft,
  },
  flex: { flex: 1 },
});
