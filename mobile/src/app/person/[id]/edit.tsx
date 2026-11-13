/**
 * app/person/[id]/edit.tsx — EDIT A PERSON (same form as "add").
 * Owner: Person 3/4 (Zuhayr).
 */
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';

import { PersonForm } from '@/components/person';
import { EmptyState, Screen } from '@/components/ui';
import { usePeople } from '@/data/people';

/** Edit screen. Saves, then goes back to the person's page. */
export default function EditPerson() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { get, updatePerson } = usePeople();
  const p = get(id);

  if (!p) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon="help-circle" title="Person not found" />
      </Screen>
    );
  }
  const { id: _id, guardians: _g, ...initial } = p;

  return (
    <Screen edges={['bottom']}>
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
