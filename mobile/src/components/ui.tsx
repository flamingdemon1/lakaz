/**
 * ui.tsx — small building blocks every LAKAZ screen uses (text, screen, card, button, pills).
 * Owner: Person 3/4 (Fahim, Zuhayr). Change the look here once, and every screen follows.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Glow } from '@/components/Glow';
import { useAuth } from '@/data/auth';
import { STATUS_KEY } from '@/i18n';
import { colors, MAX_WIDTH, radius, shadow, space, statusStyles, TOUCH, type } from '@/theme';
import type { AlertStatus } from '@/types';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Text with the LAKAZ font. `variant` picks a size from the type scale in theme.ts. */
export function AppText({
  variant = 'body',
  color = colors.text,
  style,
  ...rest
}: TextProps & { variant?: keyof typeof type; color?: string }) {
  return <Text {...rest} style={[type[variant], { color }, style]} />;
}

/**
 * Page wrapper: safe area + scroll + centred max width (so the web build looks right on a projector).
 * `scroll={false}` for screens that manage their own scrolling. `glow={false}` hides the bottom glow
 * (e.g. forms where it would sit behind the keyboard).
 */
export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  glow = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: ('top' | 'bottom')[];
  glow?: boolean;
}) {
  const inner = <View style={styles.inner}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {/* Decoration only, fixed to the bottom of the screen while the content scrolls over it. */}
      {glow ? <Glow strength={0.7} /> : null}
      {/* Why: on iPhone the keyboard would otherwise cover the form fields at the bottom. */}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            // Why "handled": the first tap on a button works even while the keyboard is open.
            keyboardShouldPersistTaps="handled">
            {inner}
          </ScrollView>
        ) : (
          inner
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Raised dark card with a thin hairline edge. */
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/**
 * Big, clear button. Min height 48 for older hands (theme TOUCH).
 * Shows a spinner while `loading` so a slow hotspot never looks like "nothing happened".
 */
export function Button({
  label,
  onPress,
  icon,
  tone = 'primary',
  loading = false,
  disabled = false,
  size = 'md',
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  tone?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  size?: 'md' | 'lg';
  accessibilityHint?: string;
}) {
  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    // White pill with dark text (the reference's "Buy" button): the clearest button on a black screen.
    secondary: { bg: colors.white, fg: colors.ink, border: colors.white },
    danger: { bg: statusStyles.Critical.bg, fg: colors.white, border: statusStyles.Critical.bg },
    success: { bg: statusStyles.Resolved.bg, fg: colors.white, border: statusStyles.Resolved.bg },
    ghost: { bg: 'transparent', fg: colors.link, border: 'transparent' },
  }[tone];
  const inactive = disabled || loading;
  // Springy press: shrinks a little under the finger and bounces back — feels physical, not a flat flash.
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: v === 1 ? 8 : 0, useNativeDriver: Platform.OS !== 'web' }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
    <Pressable
      onPress={onPress}
      onPressIn={() => !inactive && springTo(0.96)}
      onPressOut={() => springTo(1)}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        size === 'lg' && styles.buttonLg,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={size === 'lg' ? 24 : 20} color={palette.fg} />}
          <AppText variant={size === 'lg' ? 'heading' : 'bodyBold'} color={palette.fg}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
    </Animated.View>
  );
}

/** Coloured status chip with icon + word (never colour alone). */
export function StatusPill({ status, large = false }: { status: AlertStatus; large?: boolean }) {
  const s = statusStyles[status];
  const { t } = useAuth();
  const label = t(STATUS_KEY[status]); // follows the language chosen in Profile
  return (
    <View
      style={[styles.pill, { backgroundColor: s.bg }, large && styles.pillLarge]}
      accessibilityLabel={label}>
      <Ionicons name={s.icon as IconName} size={large ? 18 : 14} color={s.fg} />
      <AppText variant={large ? 'smallBold' : 'label'} color={s.fg}>
        {label.toUpperCase()}
      </AppText>
    </View>
  );
}

/** Purple tag shown on anything fake. Team rule: label simulated things as simulated. */
export function SimulatedTag({ text = 'SIMULATED' }: { text?: string }) {
  return (
    <View style={styles.simTag} accessibilityLabel="Simulated data">
      <Ionicons name="flask" size={12} color={colors.white} />
      <AppText variant="label" color={colors.white}>
        {text}
      </AppText>
    </View>
  );
}

/** Section heading above a group of cards. */
export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <AppText variant="label" color={colors.textMuted} accessibilityRole="header">
        {typeof children === 'string' ? children.toUpperCase() : children}
      </AppText>
      {right}
    </View>
  );
}

/** Friendly empty / error / loading message with an icon. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={32} color={colors.link} />
      </View>
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      {body ? (
        <AppText color={colors.textMuted} style={styles.center}>
          {body}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}

/** Label + value row used on device and detail screens. */
export function InfoRow({
  icon,
  label,
  value,
  valueColor = colors.text,
  last = false,
}: {
  icon: IconName;
  label: string;
  value: string;
  valueColor?: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoDivider]}>
      <Ionicons name={icon} size={22} color={colors.textMuted} />
      <AppText color={colors.textMuted} style={styles.flex}>
        {label}
      </AppText>
      <AppText variant="bodyBold" color={valueColor} style={styles.infoValue as StyleProp<TextStyle>}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, paddingBottom: space.xxxl },
  inner: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', padding: space.lg, gap: space.lg },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, ...shadow },
  button: {
    minHeight: TOUCH,
    // 24 = half the 48 px height, so a one-line button is a perfect pill; a label that wraps to two lines
    // becomes a rounded box instead of a squashed capsule.
    borderRadius: radius.xl,
    borderWidth: 1.5,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonLg: { minHeight: 60 },
  pressed: { opacity: 0.9 }, // scale is animated in Button (springTo)
  disabled: { opacity: 0.5 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  pillLarge: { paddingHorizontal: space.md, paddingVertical: 6 },
  simTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.simulated,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.lg },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH, paddingVertical: space.sm },
  infoDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  infoValue: { textAlign: 'right', flexShrink: 1 },
  flex: { flex: 1 },
});
