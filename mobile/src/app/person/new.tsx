/**
 * app/person/new.tsx — ADD A PERSON (child or elderly) under this account.
 * Owner: Person 3/4 (Zuhayr). The caregiver who adds them becomes their primary guardian.
 */
import { router } from 'expo-router';
import React from 'react';

import { PersonForm } from '@/components/person';
import { Screen } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { blankPerson, usePeople } from '@/data/people';

/** Add-person screen. On save, opens the new person's page (replacing this form). */
export default function NewPerson() {
  const { addPerson } = usePeople();
  const { user } = useAuth();

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
