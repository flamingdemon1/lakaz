/** Last-seen connection status for a linked band. Owner: Fahim. */
import React from 'react';
import { AppText, Card } from '@/components/ui';
import { useBand } from '@/data/bands';
import { useNow } from '@/lib/useNow';

/** Input: optional band UUID. Returns a status card, unknown until a timestamp is available. */
export function BandStatus({ deviceId }: { deviceId?: string }) {
  const { band, loading, error } = useBand(deviceId);
  const now = useNow(1000);
  const age = band?.last_seen ? now - Date.parse(band.last_seen) : NaN;
  // Negative or invalid ages are unknown, never online. Threshold matches the team contract.
  const valid = Number.isFinite(age) && age >= 0;
  const state = loading ? 'Checking band…' : error ? 'Connection unknown' :
    !band ? 'No linked band' : !valid ? 'Connection unknown' : age < 20_000 ? 'Online' : 'Offline';
  return (
    <Card>
      <AppText variant="bodyBold">{band?.label ?? 'Band'}</AppText>
      <AppText accessibilityLiveRegion="polite">{state}</AppText>
      {valid && <AppText variant="small">Last seen {Math.floor(age / 1000)} s ago</AppText>}
    </Card>
  );
}
