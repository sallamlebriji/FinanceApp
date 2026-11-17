import type { Currency } from '@mizan/shared';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  RefreshControl,
  ScrollView,
  type StyleProp,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmtMoney, useLocale } from '@/lib/format';
import { minTarget, noOutline, radius, space, tabular, type, type TypeStyle, useColors } from '@/theme';

/* ---------- Text ---------- */

type Tone = 'label' | 'label2' | 'label3' | 'accent' | 'positive' | 'negative' | 'warning' | 'accentFg';

export function Txt({
  variant = 'body',
  tone = 'label',
  weight,
  numeric,
  style,
  ...rest
}: TextProps & { variant?: TypeStyle; tone?: Tone; weight?: '400' | '500' | '600' | '700'; numeric?: boolean }) {
  const c = useColors();
  return (
    <Text
      {...rest}
      style={[type[variant], { color: c[tone] }, weight ? { fontWeight: weight } : null, numeric ? tabular : null, style]}
    />
  );
}

export function MoneyText({
  value,
  currency,
  sign,
  ...rest
}: Omit<Parameters<typeof Txt>[0], 'children'> & { value: string; currency: Currency; sign?: boolean }) {
  const locale = useLocale();
  return (
    <Txt numeric {...rest}>
      {fmtMoney(value, currency, locale, sign ? { signDisplay: 'exceptZero' } : {})}
    </Txt>
  );
}

/* ---------- Screen ---------- */

/**
 * A scrolling screen with a large title (iOS Large Title / Material top app bar "large").
 * Trailing actions sit on the title row; pull to refresh reloads the screen's data.
 */
export function Screen({
  title,
  actions,
  children,
  onRefresh,
  refreshing = false,
  contentStyle,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[
        { paddingTop: insets.top + space.sm, paddingBottom: space.xxl + insets.bottom, paddingHorizontal: space.lg, gap: space.lg },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.label3} /> : undefined}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: minTarget }}>
        <Txt variant="largeTitle" accessibilityRole="header" style={{ flexShrink: 1 }}>
          {title}
        </Txt>
        {actions ? <View style={{ flexDirection: 'row', gap: space.sm }}>{actions}</View> : null}
      </View>
      {children}
    </ScrollView>
  );
}

/* ---------- Containers ---------- */

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const c = useColors();
  return (
    <View style={[{ backgroundColor: c.surface, borderRadius: radius.card, overflow: 'hidden' }, padded && { padding: space.lg }, style]}>
      {children}
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm }}>
      <Txt variant="title3" accessibilityRole="header">
        {title}
      </Txt>
      {action}
    </View>
  );
}

export function Separator({ inset = 0 }: { inset?: number }) {
  const c = useColors();
  return <View style={{ height: 1, backgroundColor: c.separator, marginLeft: inset }} />;
}

/* ---------- Buttons ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'plain' | 'destructive';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon: Icon,
  style,
  accessibilityHint,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const c = useColors();
  const bg = { primary: c.accent, secondary: c.fill, plain: 'transparent', destructive: c.negativeSoft }[variant];
  const fg = { primary: c.accentFg, secondary: c.label, plain: c.accent, destructive: c.negative }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        {
          minHeight: 50,
          borderRadius: radius.control + 2,
          paddingHorizontal: space.lg,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          opacity: inactive ? 0.5 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : Icon ? <Icon size={20} color={fg} strokeWidth={2.2} /> : null}
      <Text style={[type.headline, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

/** Icon-only control: always carries an accessibility label; 44 pt / 48 dp hit target. */
export function IconButton({
  icon: Icon,
  label,
  onPress,
  prominent,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  prominent?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => ({
        width: minTarget,
        height: minTarget,
        borderRadius: minTarget / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: prominent ? c.accent : c.fill,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon size={22} color={prominent ? c.accentFg : c.label} strokeWidth={2.2} />
    </Pressable>
  );
}

/* ---------- List rows ---------- */

export function Row({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  chevron,
  accessibilityLabel,
  accessibilityHint,
  destructive,
}: {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: PressableProps['onPress'];
  chevron?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  destructive?: boolean;
}) {
  const c = useColors();
  const content = (
    <>
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt numberOfLines={1} tone={destructive ? 'negative' : 'label'}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="footnote" tone="label3" numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {trailing}
      {chevron ? <ChevronRight size={18} color={c.label3} /> : null}
    </>
  );
  const base: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm };
  if (!onPress) return <View style={[base, { paddingHorizontal: space.lg }]}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      android_ripple={{ color: c.fill }}
      style={({ pressed }) => [base, { paddingHorizontal: space.lg, backgroundColor: pressed ? c.fill : 'transparent' }]}
    >
      {content}
    </Pressable>
  );
}

/* ---------- Form controls ---------- */

export function Field({
  label,
  error,
  hint,
  style,
  ...input
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      <Txt variant="subhead" tone="label2" weight="500">
        {label}
      </Txt>
      <TextInput
        placeholderTextColor={c.label3}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        {...input}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        style={[
          type.body,
          noOutline,
          {
            color: c.label,
            backgroundColor: c.surface,
            minHeight: 50,
            borderRadius: radius.control + 2,
            paddingHorizontal: space.md,
            borderWidth: 1.5,
            borderColor: error ? c.negative : focused ? c.accent : c.separator,
          },
          style,
        ]}
      />
      {error ? (
        <Txt variant="footnote" tone="negative" accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="footnote" tone="label3">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  const c = useColors();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', backgroundColor: c.fill, borderRadius: radius.control, padding: 2 }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={{
              flex: 1,
              minHeight: 36,
              borderRadius: radius.control - 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? c.surface : 'transparent',
              paddingHorizontal: space.sm,
            }}
          >
            <Txt variant="subhead" weight={on ? '600' : '500'} numberOfLines={1}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A selectable pill; used for choosing accounts and categories (choices over typing). */
export function Chip({
  label,
  selected,
  onPress,
  leading,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  leading?: ReactNode;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs + 2,
        minHeight: 40,
        paddingHorizontal: space.md,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: selected ? c.accent : c.separator,
        backgroundColor: selected ? c.accentSoft : c.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {leading}
      <Txt variant="subhead" weight={selected ? '600' : '400'} tone={selected ? 'accent' : 'label'}>
        {label}
      </Txt>
    </Pressable>
  );
}

/* ---------- Status ---------- */

export function Progress({ value, tone = 'accent', label }: { value: number; tone?: 'accent' | 'warning' | 'negative'; label: string }) {
  const c = useColors();
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={{ height: 8, borderRadius: 4, backgroundColor: c.fill, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: 4, backgroundColor: c[tone] }} />
    </View>
  );
}

export function Badge({ label, tone }: { label: string; tone: 'warning' | 'negative' | 'positive' | 'neutral' }) {
  const c = useColors();
  const map = {
    warning: [c.warningSoft, c.warning],
    negative: [c.negativeSoft, c.negative],
    positive: [c.fill, c.positive],
    neutral: [c.fill, c.label2],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={[type.caption, { color: fg, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  const c = useColors();
  return (
    <View style={{ paddingVertical: space.xxl, alignItems: 'center' }} accessibilityLabel={label}>
      <ActivityIndicator color={c.label3} />
    </View>
  );
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xl }}>
      <Txt variant="headline" style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      <Txt variant="subhead" tone="label2" style={{ textAlign: 'center' }}>
        {message}
      </Txt>
      {action ? <View style={{ marginTop: space.sm, alignSelf: 'stretch' }}>{action}</View> : null}
    </Card>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card style={{ gap: space.md }}>
      <Txt variant="headline">Couldn’t load this</Txt>
      <Txt variant="subhead" tone="label2">
        {message}
      </Txt>
      <Button title="Try Again" variant="secondary" onPress={onRetry} />
    </Card>
  );
}
