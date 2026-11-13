/**
 * app/person/[id]/edit.tsx — EDIT A PERSON (same form as "add").
 * Owner: Person 3/4 (Fahim, Zuhayr).
 */
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';

import { PersonForm } from '@/components/person';
import { EmptyState, Screen, AppText, SimulatedTag } from '@/components/ui';
import { usePeople } from '@/data/people';
import { colors } from '@/theme';

/** Edit screen. Saves, then goes back to the person's page. */
export default function EditPerson() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { get, updatePerson } = usePeople();
  const p = get(id);

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
  const { id: _id, guardians: _g, ...initial } = p;

  return (
    <Screen edges={['bottom']}>
      {/* Sample stores stay sample even when Supabase authentication is live. */}
      <SimulatedTag text="SAMPLE DATA" />
      <AppText variant="small" color={colors.textMuted}>Sample screen: not connected to the band yet.</AppText>
      <PersonForm
        initial={initial}
        personId={p.id}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          await updatePerson(p.id, input);
          router.back();
        }}
      />
    </Screen>
  );
}
