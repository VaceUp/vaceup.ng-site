/** VaceUp mobile UI kit: theme-aware primitives every screen composes.
 * Every interactive element carries default, disabled, and loading states;
 * touch targets meet the 44-point accessibility bar; colors follow the
 * light/dark theme. */
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { radius, spacing, TOUCH_TARGET, type, useTheme } from '@/theme';

export function Screen({ children, scroll = true, style, refreshControl }: {
  children: React.ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle>; refreshControl?: React.ReactElement;
}) {
  const { colors } = useTheme();
  if (!scroll) return <View style={[styles.screen, { backgroundColor: colors.page }, style]}>{children}</View>;
  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.page }]}
      contentContainerStyle={[styles.screenContent, style]}
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, tinted }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tinted?: 'navy' }) {
  const { colors } = useTheme();
  return (
    <View style={[
      styles.card,
      { backgroundColor: tinted === 'navy' ? colors.navy950 : colors.surface, borderColor: colors.line },
      style,
    ]}>
      {children}
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  intent?: 'primary' | 'neutral' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  wide?: boolean;
};

export function Button({ label, onPress, intent = 'primary', loading = false, disabled = false, icon, wide = false }: ButtonProps) {
  const { colors } = useTheme();
  const palette = intent === 'primary'
    ? { bg: colors.gold, fg: colors.navy950, border: colors.gold }
    : intent === 'danger'
      ? { bg: colors.errorBg, fg: colors.error, border: colors.error }
      : { bg: colors.navy100, fg: colors.text, border: colors.line };
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        wide && styles.buttonWide,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.55 : 1 },
        pressed && !inactive && { transform: [{ scale: 0.98 }] },
      ]}
    >
      {loading
        ? <ActivityIndicator color={palette.fg} />
        : (
          <>
            {icon && <Feather name={icon} size={16} color={palette.fg} />}
            <Text style={[styles.buttonLabel, { color: palette.fg }]}>{label}</Text>
          </>
        )}
    </Pressable>
  );
}

export function Field({ label, hint, error, children, ...inputProps }: TextInputProps & { label: string; hint?: string; error?: string; children?: React.ReactNode; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      <View>
        <TextInput
          {...inputProps}
          style={[styles.input, { backgroundColor: colors.surface, borderColor: error ? colors.error : colors.line, color: colors.text }, error && styles.inputError]}
          placeholderTextColor={colors.textMuted}
        />
        {children}
      </View>
      {error ? <Text style={[styles.fieldHint, { color: colors.error }]}>{error}</Text> : hint ? <Text style={[styles.fieldHint, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

export function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stack}>
      <Text style={[type.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[type.body, { color: colors.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function EmptyState({ icon, title, body }: { icon: keyof typeof Feather.glyphMap; title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Feather name={icon} size={36} color={colors.focus} />
      <Text style={[type.heading, { color: colors.text, marginTop: spacing(1) }]}>{title}</Text>
      <Text style={[type.body, { color: colors.textMuted, maxWidth: 320 }]}>{body}</Text>
    </View>
  );
}

export function Note({ tone = 'info', children }: { tone?: 'info' | 'success' | 'error'; children: React.ReactNode }) {
  const { colors } = useTheme();
  const palette = tone === 'success'
    ? { bg: colors.successBg, fg: colors.success, border: colors.success }
    : tone === 'error'
      ? { bg: colors.errorBg, fg: colors.error, border: colors.error }
      : { bg: colors.navy100, fg: colors.text, border: colors.line };
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : 'status'} style={[styles.note, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Feather name={tone === 'success' ? 'check-circle' : tone === 'error' ? 'alert-circle' : 'info'} size={16} color={palette.fg} />
      <Text style={[type.small, { color: palette.fg, flex: 1 }]}>{children}</Text>
    </View>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <View accessibilityLabel={`Progress ${clamped} percent`} style={[styles.progressTrack, { backgroundColor: colors.navy100 }]}>
      <View style={[styles.progressFill, { width: `${clamped}%`, backgroundColor: colors.gold }]} />
    </View>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'gold' | 'success' | 'error' }) {
  const { colors } = useTheme();
  const palette = tone === 'gold'
    ? { bg: colors.gold, fg: colors.navy950 }
    : tone === 'success'
      ? { bg: colors.successBg, fg: colors.success }
      : tone === 'error'
        ? { bg: colors.errorBg, fg: colors.error }
        : { bg: colors.navy100, fg: colors.textMuted };
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[type.caption, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

export function Separator() {
  const { colors } = useTheme();
  return <View style={[styles.separator, { backgroundColor: colors.line }]} />;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[type.caption, { color: colors.focus, letterSpacing: 1.5, textTransform: 'uppercase' }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  screenContent: { padding: spacing(4), paddingBottom: spacing(8), gap: spacing(4) },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing(4),
    gap: spacing(3),
  },
  stack: { gap: spacing(1.5) },
  button: {
    minHeight: TOUCH_TARGET,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing(5),
    paddingVertical: spacing(3),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
  },
  buttonWide: { alignSelf: 'stretch' },
  buttonLabel: { ...type.subheading, fontWeight: '700' },
  field: { gap: spacing(1.5) },
  fieldLabel: { ...type.small, fontWeight: '700' },
  fieldHint: { ...type.small },
  input: {
    minHeight: TOUCH_TARGET,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing(3),
    fontSize: 15,
  },
  inputError: { borderColor: '#B4232C' },
  empty: { alignItems: 'flex-start', gap: spacing(2), paddingVertical: spacing(6) },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(2),
    padding: spacing(3),
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.full },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
  },
  separator: { height: StyleSheet.hairlineWidth },
});
