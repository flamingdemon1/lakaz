/**
 * motion.tsx — small animation building blocks for LAKAZ (fade-in, pulse rings, breathing, pop, slide-to-confirm).
 * Owner: Person 3/4 (Zuhayr).
 *
 * Built only on React Native's own `Animated` + `PanResponder` — NO new packages (team package freeze).
 * Rules every animation here follows:
 *  - Motion means something: "alive/safe" (slow breathe), "needs attention" (pulse), "done" (pop). No decoration loops.
 *  - If the phone asks for reduced motion (iOS/Android accessibility setting), everything shows its final state instantly.
 *  - Timings come from `motion` in theme.ts so the whole app feels consistent.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui';
import { colors, motion, radius, space } from '@/theme';

/** Native driver is not available on web (it only logs a warning there). */
const NATIVE = Platform.OS !== 'web';

/** True when the user turned on "Reduce motion" in their phone's accessibility settings. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduced(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/**
 * Fades + slides its children up into place once, on mount.
 * Use `delay={i * motion.stagger}` on a list so items arrive one after another.
 */
export function FadeIn({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) {
      v.setValue(1);
      return;
    }
    Animated.timing(v, {
      toValue: 1,
      duration: motion.slow,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE,
    }).start();
  }, [v, delay, reduced]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/**
 * Two expanding rings behind a dot/icon — the "radar" pulse used for an open alert / live location.
 * Only render it while something actually needs attention.
 */
export function PulseRings({ color, size = 16 }: { color: string; size?: number }) {
  const reduced = useReducedMotion();
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const ring = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: motion.pulse, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: NATIVE }),
        ]),
      );
    const la = ring(a, 0);
    const lb = ring(b, motion.pulse / 2);
    la.start();
    lb.start();
    return () => {
      la.stop();
      lb.stop();
    };
  }, [a, b, reduced]);
  if (reduced) return null;
  const ringStyle = (v: Animated.Value) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    borderColor: color,
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] }) }],
  });
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]} aria-hidden>
      <Animated.View style={[styles.ring, ringStyle(a)]} />
      <Animated.View style={[styles.ring, ringStyle(b)]} />
    </View>
  );
}

/** Very slow scale in/out — "alive and calm". Used on the avatar while she is safe at home. */
export function Breathe({ children, active = true }: { children: React.ReactNode; active?: boolean }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active || reduced) {
      v.setValue(0);
      return;
    }
    const half = motion.breathe / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
        Animated.timing(v, { toValue: 0, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, active, reduced]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

/** Springs its child in from small to full size with a little overshoot — used for "done" moments. */
export function PopIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      v.setValue(1);
      return;
    }
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(v, { toValue: 1, friction: 5, tension: 120, useNativeDriver: NATIVE }),
    ]).start();
  }, [v, delay, reduced]);
  return <Animated.View style={{ opacity: v, transform: [{ scale: v }] }}>{children}</Animated.View>;
}

/**
 * Smoothly blends between colours when `color` changes (e.g. home card going green → red).
 * Returns an Animated colour to put in `backgroundColor`. Colour can't use the native driver.
 */
export function useColorTransition(color: string) {
  const reduced = useReducedMotion();
  const [pair, setPair] = useState({ from: color, to: color });
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (color === pair.to) return;
    setPair({ from: pair.to, to: color });
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: reduced ? 0 : motion.slow * 1.4, useNativeDriver: false }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);
  return v.interpolate({ inputRange: [0, 1], outputRange: [pair.from, pair.to] });
}

/**
 * SLIDE TO CONFIRM — drag the knob to the end to fire `onConfirm`.
 * Why: "I've got it" stops the escalation for everyone, so a pocket tap must not trigger it.
 * Accessibility: screen readers see one button; double-tap (the "activate" action) confirms straight away,
 * because dragging is hard with VoiceOver/TalkBack (WCAG 2.5.7 "dragging movements").
 */
export function SlideToConfirm({
  label,
  onConfirm,
  color = colors.danger,
  loading = false,
  accessibilityHint,
}: {
  label: string;
  onConfirm: () => void;
  color?: string;
  loading?: boolean;
  accessibilityHint?: string;
}) {
  const reduced = useReducedMotion();
  const KNOB = 52;
  const PAD = 4;
  const x = useRef(new Animated.Value(0)).current;
  const nudge = useRef(new Animated.Value(0)).current;
  const max = useRef(0);
  const done = useRef(false);
  const confirmRef = useRef(onConfirm);
  confirmRef.current = onConfirm;

  // Small "try sliding me" nudge every few seconds, until the user touches it.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched || reduced || loading) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1600),
        Animated.timing(nudge, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        // JS driver: it is added to the drag value below, and native + JS values can't be mixed.
        Animated.spring(nudge, { toValue: 0, friction: 4, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [touched, reduced, loading, nudge]);

  // Reset when a confirm finished (e.g. it failed and the user must try again).
  useEffect(() => {
    if (!loading && done.current) {
      done.current = false;
      Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
    }
  }, [loading, x]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !done.current,
      onMoveShouldSetPanResponder: () => !done.current,
      onPanResponderGrant: () => setTouched(true),
      onPanResponderMove: (_, g) => x.setValue(Math.max(0, Math.min(max.current, g.dx))),
      onPanResponderRelease: (_, g) => {
        if (g.dx >= max.current * 0.85) {
          done.current = true;
          Animated.timing(x, { toValue: max.current, duration: motion.fast, useNativeDriver: false }).start(() =>
            confirmRef.current(),
          );
        } else {
          Animated.spring(x, { toValue: 0, friction: 6, useNativeDriver: false }).start();
        }
      },
      onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: false }).start(),
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    max.current = Math.max(0, e.nativeEvent.layout.width - KNOB - PAD * 2);
  };

  const labelOpacity = x.interpolate({ inputRange: [0, 120], outputRange: [1, 0.25], extrapolate: 'clamp' });
  const nudgeX = nudge.interpolate({ inputRange: [0, 1], outputRange: [0, 12] });

  return (
    <View
      onLayout={onLayout}
      style={[styles.track, { backgroundColor: color }]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint ?? 'Double-tap to confirm'}
      accessibilityState={{ busy: loading }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && onConfirm()}>
      <Animated.View style={[styles.trackLabel, { opacity: labelOpacity }]} pointerEvents="none">
        <AppText variant="bodyBold" color={colors.white}>
          {label}
        </AppText>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
      </Animated.View>
      <Animated.View
        {...pan.panHandlers}
        style={[
          styles.knob,
          { width: KNOB, height: KNOB, borderRadius: KNOB / 2, left: PAD, top: PAD },
          { transform: [{ translateX: Animated.add(x, nudgeX) }] },
        ]}>
        {loading ? <ActivityIndicator color={color} /> : <Ionicons name="arrow-forward" size={26} color={color} />}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2 },
  track: { height: 60, borderRadius: radius.pill, justifyContent: 'center', overflow: 'hidden' },
  trackLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingLeft: 56 },
  knob: {
    position: 'absolute',
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    // Why a cursor hint: on the web demo it must look draggable.
    ...(Platform.OS === 'web' ? ({ cursor: 'grab' } as object) : {}),
  },
});
