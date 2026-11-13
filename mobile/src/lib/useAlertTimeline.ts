/**
 * useAlertTimeline.ts — the timeline of one incident, for the Incident screen and the incident report.
 * Owner: Person 3 (Zuhayr).
 *
 * LIVE alerts (help presses and the band's left-home events): built from the SERVER's own timestamps in Supabase (received_at, acknowledged_at,
 * resolved_at) — so the timeline is true even after a refresh or on another carer's phone.
 * SAMPLE alerts: the app's in-memory timeline (data/escalation.tsx), as before.
 */
import { useAuth } from '@/data/auth';
import { TimelineEntry, useEscalation } from '@/data/escalation';
import { myCarerId } from '@/data/helpAlert';
import { useLakaz } from '@/data/store';
import { fill } from '@/i18n';
import type { Alert } from '@/types';

/** "You", the carer's name, or "a carer" — never an invented name. */
export function useCarerName() {
  const { carerNames } = useLakaz();
  const { t } = useAuth();
  return (id: string | null | undefined) => (!id ? t('someone') : id === myCarerId() ? t('whoYou') : carerNames[id] ?? t('someone'));
}

/** Input: the alert (or undefined while loading). Output: its timeline, oldest first. */
export function useAlertTimeline(alert: Alert | undefined): TimelineEntry[] {
  const { timeline } = useEscalation();
  const { t } = useAuth();
  const nameOf = useCarerName();
  if (!alert) return [];
  if (!alert.live) return timeline(alert.alert_id);

  const exit = alert.type === 'unexpected_exit';
  const out: TimelineEntry[] = [{ at: alert.created_at, kind: 'start', text: t(exit ? 'tlLeftHome' : 'tlPressed') }];
  if (alert.acknowledged_at) out.push({ at: alert.acknowledged_at, kind: 'ack', text: fill(t('tlAcked'), { who: nameOf(alert.acknowledged_by) }) });
  // Closed by the band itself (resolved_by empty) = it heard the home beacon again; otherwise a carer closed it.
  if (alert.resolved_at)
    out.push({
      at: alert.resolved_at,
      kind: 'resolve',
      text: exit && !alert.resolved_by ? t('tlBackHome') : fill(t('tlResolved'), { who: nameOf(alert.resolved_by) }),
    });
  return out;
}
