/**
 * app/person/new.tsx — ADD A PERSON (child or elderly) under this account.
 * Owner: Person 3/4 (Zuhayr). The caregiver who adds them becomes their primary guardian.
 * Live mode uses components/AddPersonLive.tsx (real: person = wearer of the band they claim).
 */
import { router } from 'expo-router';
import React from 'react';

import { AddPersonLive } from '@/components/AddPersonLive';
import { PersonForm } from '@/components/person';
import { USE_MOCK } from '@/config';
import { Screen } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { blankPerson, usePeople } from '@/data/people';

/**
 * Add-person screen.
 * LIVE: the real one-step form (person + the code on their band) -> Home shows them with a fresh history.
 * SAMPLE: the full sample form, as before; on save it opens the new person's page.
 */
export default function NewPerson() {
  const { addPerson } = usePeople();
  const { user } = useAuth();
  if (!USE_MOCK) {
    return (
      <Screen edges={['bottom']}>
        <AddPersonLive onDone={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <PersonForm
        initial={blankPerson()}
        submitLabel="Save person"
        onSubmit={async (p) => {
          const id = await addPerson(p, { name: user?.name ?? 'Demo Caregiver', phone: user?.phone ?? '+23057000001' });
          router.replace({ pathname: '/person/[id]', params: { id } });
        }}
      />
    </Screen>
  );
}
