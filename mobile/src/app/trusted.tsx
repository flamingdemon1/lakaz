/**
 * app/trusted.tsx — OLD ROUTE kept so existing links still work.
 * Owner: Person 3/4 (Zuhayr).
 * Guardians are now per person (section B), so this just opens Marie-Claire's guardians page.
 */
import { Redirect } from 'expo-router';
import React from 'react';

/** Redirects to the demo person's guardians. */
export default function TrustedRedirect() {
  return <Redirect href={{ pathname: '/person/[id]/guardians', params: { id: 'p-01' } }} />;
}
