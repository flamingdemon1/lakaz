/**
 * escalation.tsx — EMERGENCY ESCALATION settings + incident timelines (section F).
 * Owner: Person 3/4 (Zuhayr). The real ladder runs on the backend (section 9, Person 2); in SAMPLE mode
 * the app runs the same rules itself so the whole story can be demoed without a server.
 *
 * Ladder (section 9, D7):  0 band buzzes + Kreol voice → 1 primary caregiver → 2 secondary + live tracking
 *                          → 3 community alert, ONLY if the community rules below are met.
 * Real timers 2 / 7 / 15 min (15 min = Alzheimer's Association threshold). Demo timers 10 / 25 / 45 s.
 * Settings and timelines live in memory (no storage package) and reset when the app reloads.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { Alert } from '@/types';

export type TimerMode = 'demo' | 'real';

/** Seconds from the exit to each level. */
export const TIMERS: Record<TimerMode, { l1: number; l2: number; l3: number }> = {
  demo: { l1: 10, l2: 25, l3: 45 },
  real: { l1: 120, l2: 420, l3: 900 },
};

export interface EscalationSettings {
  timerMode: TimerMode;
  /** Master switch for level 3 (community responders). */
  communityEnabled: boolean;
  /** At level 2, start live tracking for primary + secondary caregivers only. */
  autoTracking: boolean;
}

export interface TimelineEntry {
  at: string;
  text: string;
  kind: 'start' | 'level' | 'ack' | 'resolve' | 'manual' | 'tracking' | 'info';
}

/**
 * The COMMUNITY RULES: level 3 only happens when all are true. Returns null if allowed, or the reason why not.
 * Why rules at all: a community alert reaches strangers — it must be rare, justified and explainable.
 */
export function communityBlockedReason(a: Alert, s: EscalationSettings): string | null {
  if (!s.communityEnabled) return 'Community alerts are switched off in escalation settings';
  if (a.type !== 'unexpected_exit' && a.type !== 'sos') return 'Only emergencies (exit or SOS) can reach the community';
  if (a.status === 'Acknowledged') return 'A caregiver acknowledged it, so escalation stopped';
  if (a.status === 'Resolved') return 'The incident is closed';
  return null;
}

/** Friendly label for a number of seconds: "10 s" or "2 min". */
export const fmtDelay = (s: number) => (s < 60 ? `${s} s` : `${Math.round(s / 60)} min`);

interface EscalationCtx {
  settings: EscalationSettings;
  update: (patch: Partial<EscalationSettings>) => void;
  timers: { l1: number; l2: number; l3: number };
  timeline: (alertId: string) => TimelineEntry[];
  addTimeline: (alertId: string, text: string, kind: TimelineEntry['kind']) => void;
}

const Ctx = createContext<EscalationCtx | null>(null);

/** Provider — sits ABOVE LakazProvider because the sample ladder in the store reads these settings. */
export function EscalationProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<EscalationSettings>({ timerMode: 'demo', communityEnabled: true, autoTracking: true });
  const [timelines, setTimelines] = useState<Record<string, TimelineEntry[]>>({});

  const addTimeline = useCallback((alertId: string, text: string, kind: TimelineEntry['kind']) => {
    setTimelines((t) => ({ ...t, [alertId]: [...(t[alertId] ?? []), { at: new Date().toISOString(), text, kind }] }));
  }, []);

  const value = useMemo<EscalationCtx>(
    () => ({
      settings,
      update: (patch) => setSettings((s) => ({ ...s, ...patch })),
      timers: TIMERS[settings.timerMode],
      timeline: (id) => timelines[id] ?? [],
      addTimeline,
    }),
    [settings, timelines, addTimeline],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Hook for the store, the ladder, the incident screens and the settings screen. */
export function useEscalation() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useEscalation must be used inside <EscalationProvider>');
  return v;
}
