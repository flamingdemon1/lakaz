/**
 * EscalationBridge.tsx — invisible helper that watches incidents and:
 *  1. writes the INCIDENT TIMELINE (started, who was alerted at each step, acknowledged, resolved);
 *  2. at step 2 STARTS LIVE TRACKING automatically — visible to primary + secondary only — and stops it
 *     when the incident is closed (privacy rule from section C: tracking is never left running).
 * Owner: Person 3/4 (Zuhayr). Mounted once in app/_layout.tsx (needs people + tracking + escalation).
 * Renders nothing.
 */
import { useEffect, useRef } from 'react';

import { communityBlockedReason, useEscalation } from '@/data/escalation';
import { usePeople } from '@/data/people';
import { useLakaz } from '@/data/store';
import { useTracking } from '@/data/tracking';
import { alertTitle } from '@/lib/format';
import type { Alert } from '@/types';

/** Name used in the tracking access log when LAKAZ starts/stops tracking by itself. */
const AUTO = 'LAKAZ (automatic)';

/** Watches alerts and keeps timelines + automatic tracking in step. */
export function EscalationBridge() {
  const { alerts, me } = useLakaz();
  const { get } = usePeople();
  const tracking = useTracking();
  const esc = useEscalation();
  // Last seen state of each alert, to detect changes. `null` = first run (don't log old history).
  const prev = useRef<Map<string, Pick<Alert, 'level' | 'status'>> | null>(null);
  const notedBlocked = useRef(new Set<string>());

  useEffect(() => {
    const first = prev.current === null;
    const seen = prev.current ?? new Map();
    for (const a of alerts) {
      const before = seen.get(a.alert_id);
      const p = get(a.person_id);
      const primary = p?.guardians.find((g) => g.role === 'primary');
      const secondary = p?.guardians.filter((g) => g.role === 'secondary') ?? [];
      const emergency = a.type === 'unexpected_exit' || a.type === 'sos';

      if (!before) {
        // Don't invent a timeline for alerts that were already closed when the app opened.
        if (!(first && a.status === 'Resolved')) {
          esc.addTimeline(
            a.alert_id,
            a.type === 'unexpected_exit'
              ? 'Band lost the home signal — band vibrates and plays the Kreol voice warning'
              : a.type === 'sos'
                ? 'SOS held on the band — everyone is alerted at once'
                : `Device warning: ${alertTitle[a.type].toLowerCase()} — primary caregiver alerted`,
            'start',
          );
        }
      } else {
        // Each new level reached.
        for (let lvl = before.level + 1; lvl <= a.level; lvl++) {
          if (lvl === 1) {
            esc.addTimeline(a.alert_id, `Step 1 · Primary caregiver alerted: ${primary?.name ?? 'not set'} (in-app alert)`, 'level');
          } else if (lvl === 2) {
            esc.addTimeline(a.alert_id, `Step 2 · Secondary caregiver(s) alerted: ${secondary.map((g) => g.name).join(', ') || 'none set'}`, 'level');
            if (emergency && esc.settings.autoTracking && primary && !tracking.get(a.person_id).session) {
              tracking
                .start(
                  a.person_id,
                  { reason: 'incident', minutes: 60, shareWith: secondary.map((g) => g.phone) },
                  // Started "as" LAKAZ but owned by the primary, so they can manage who sees it.
                  { name: AUTO, phone: primary.phone },
                )
                .then(() => esc.addTimeline(a.alert_id, 'Live tracking started automatically — visible to primary + secondary only', 'tracking'))
                .catch(() => {});
            }
          } else if (lvl === 3) {
            esc.addTimeline(a.alert_id, 'Step 3 · Community alert sent to verified responders nearby (last known location only)', 'level');
          }
        }
        if (before.status !== a.status) {
          if (a.status === 'Acknowledged') {
            const who = a.acknowledged_by === me?.id ? 'you' : a.acknowledged_by ?? 'a caregiver';
            esc.addTimeline(a.alert_id, `Acknowledged by ${who} — escalation stopped`, 'ack');
          }
          if (a.status === 'Resolved') {
            esc.addTimeline(a.alert_id, 'Resolved — the person is safe', 'resolve');
            const s = tracking.get(a.person_id).session;
            // Only stop tracking LAKAZ started itself — never a session a caregiver started on purpose.
            if (s && s.startedBy.name === AUTO) {
              tracking.stop(a.person_id, { name: AUTO, phone: s.startedBy.phone }).then(() => esc.addTimeline(a.alert_id, 'Live tracking stopped automatically', 'tracking'));
            }
          }
        }
        // Explain once why the community step didn't happen when its time came.
        const secs = (Date.now() - new Date(a.created_at).getTime()) / 1000;
        const blocked = communityBlockedReason(a, esc.settings);
        if (emergency && a.level === 2 && secs >= esc.timers.l3 && blocked && !notedBlocked.current.has(a.alert_id)) {
          notedBlocked.current.add(a.alert_id);
          esc.addTimeline(a.alert_id, `Step 3 skipped — ${blocked}`, 'info');
        }
      }
      seen.set(a.alert_id, { level: a.level, status: a.status });
    }
    prev.current = seen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts]);

  return null;
}
