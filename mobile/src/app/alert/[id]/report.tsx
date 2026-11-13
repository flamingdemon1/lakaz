/**
 * app/alert/[id]/report.tsx — INCIDENT REPORT: a plain-language summary of one incident
 * (what, when, how far it escalated, who responded, how long it took, last known location, full timeline)
 * that can be shared with the phone's normal share sheet (React Native Share — no extra package).
 * Owner: Person 3/4 (Zuhayr). Built from the alert (section 7.2) + the app's incident timeline.
 *
 * Privacy: the report contains a location and health-adjacent info → the screen warns before sharing.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, EmptyState, InfoRow, Screen, SectionTitle, SimulatedTag } from '@/components/ui';
import { USE_MOCK } from '@/config';
import { TimelineEntry, useEscalation } from '@/data/escalation';
import { usePeople } from '@/data/people';
import { useLakaz } from '@/data/store';
import { alertTitle, clock } from '@/lib/format';
import { colors, space, statusStyles } from '@/theme';
import type { Alert } from '@/types';

const STEP_NAMES = ['Band warning only', 'Primary caregiver', 'Secondary caregiver + live tracking', 'Community alert'];

/** "3 min 20 s" from milliseconds. */
function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min ${s % 60} s` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** Date + time in the phone's locale, e.g. "13/11/2026, 16:41". */
const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

/** Pulls the key facts out of the alert + timeline (used by the screen AND the shared text). */
function facts(a: Alert, tl: TimelineEntry[], personName: string) {
  const ack = tl.find((e) => e.kind === 'ack');
  const res = tl.find((e) => e.kind === 'resolve');
  const start = new Date(a.created_at).getTime();
  return {
    person: personName,
    type: alertTitle[a.type],
    started: when(a.created_at),
    status: a.status,
    highest: `Step ${a.level} · ${STEP_NAMES[a.level]}`,
    acknowledged: ack ? `${ack.text.replace(/ — escalation stopped$/, '')} after ${duration(new Date(ack.at).getTime() - start)}` : 'Not acknowledged',
    resolved: res ? `${when(res.at)} (after ${duration(new Date(res.at).getTime() - start)})` : a.status === 'Resolved' ? 'Resolved' : 'Still open',
    location: a.last_location ? `${a.last_location.lat.toFixed(4)}, ${a.last_location.lng.toFixed(4)} at ${clock(a.last_location.at)}` : 'Unknown',
  };
}

/** Plain-text version for sharing (WhatsApp, email, notes…). */
function reportText(a: Alert, tl: TimelineEntry[], personName: string) {
  const f = facts(a, tl, personName);
  return [
    `LAKAZ incident report${USE_MOCK ? ' (SAMPLE — fictional data)' : ''}`,
    `Incident: ${f.type} — ${f.person} (${a.alert_id})`,
    `Started: ${f.started}`,
    `Status: ${f.status}`,
    `Highest step reached: ${f.highest}`,
    `Response: ${f.acknowledged}`,
    `Closed: ${f.resolved}`,
    `Last known location: ${f.location}`,
    '',
    'Timeline:',
    ...tl.map((e) => `${clock(e.at)}  ${e.text}`),
  ].join('\n');
}

/** Report screen. */
export default function IncidentReport() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { alerts } = useLakaz();
  const { timeline } = useEscalation();
  const { get } = usePeople();
  const [msg, setMsg] = useState<string | null>(null);
  const a = alerts.find((x) => x.alert_id === id);

  if (!a) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon="document-text" title="Incident not found" />
      </Screen>
    );
  }
  const tl = timeline(a.alert_id);
  const name = get(a.person_id)?.name ?? 'Unknown';
  const f = facts(a, tl, name);

  /**
   * Opens the share sheet. Web fallback: copy to clipboard (not every browser can share).
   */
  const onShare = async () => {
    const text = reportText(a, tl, name);
    setMsg(null);
    try {
      if (Platform.OS === 'web' && !(navigator as Navigator & { share?: unknown }).share) {
        await navigator.clipboard.writeText(text);
        setMsg('Copied to the clipboard — paste it into WhatsApp or an email.');
        return;
      }
      await Share.share({ message: text, title: 'LAKAZ incident report' });
    } catch {
      setMsg('Sharing was cancelled or is not available here.');
    }
  };

  return (
    <Screen edges={['bottom']}>
      <View style={styles.top}>
        <Ionicons name="document-text" size={26} color={colors.primary} />
        <AppText variant="title" style={styles.flex}>
          Incident report
        </AppText>
        {USE_MOCK ? <SimulatedTag text="SAMPLE" /> : null}
      </View>

      <Card>
        <InfoRow icon="person" label="Person" value={f.person} />
        <InfoRow icon="alert-circle" label="What" value={f.type} />
        <InfoRow icon="time" label="Started" value={f.started} />
        <InfoRow icon="flag" label="Status" value={f.status} valueColor={statusStyles[a.status].bg} />
        <InfoRow icon="arrow-up-circle" label="Highest step" value={f.highest} />
        <InfoRow icon="hand-left" label="Response" value={f.acknowledged} />
        <InfoRow icon="checkmark-circle" label="Closed" value={f.resolved} />
        <InfoRow icon="location" label="Last known location" value={f.location} last />
      </Card>

      <SectionTitle>Timeline</SectionTitle>
      <Card>
        {tl.length === 0 ? (
          <AppText color={colors.textMuted}>No timeline recorded for this incident.</AppText>
        ) : (
          tl.map((e, i) => (
            <View key={`${e.at}-${i}`} style={[styles.tlRow, i > 0 && styles.divider]}>
              <AppText variant="smallBold" style={styles.tlTime}>
                {clock(e.at)}
              </AppText>
              <AppText variant="small" style={styles.flex}>
                {e.text}
              </AppText>
            </View>
          ))
        )}
      </Card>

      <Card style={styles.warn}>
        <Ionicons name="lock-closed" size={18} color={statusStyles.Active.bg} />
        <AppText variant="small" style={styles.flex}>
          This report includes a location. Only share it with people involved in this incident (family, coordinator, police).
        </AppText>
      </Card>
      <Button label="Share report" icon="share-social" size="lg" onPress={onShare} />
      {msg ? (
        <AppText variant="small" color={colors.textMuted} accessibilityLiveRegion="polite">
          {msg}
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  flex: { flex: 1 },
  tlRow: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm },
  tlTime: { width: 70 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  warn: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
});
