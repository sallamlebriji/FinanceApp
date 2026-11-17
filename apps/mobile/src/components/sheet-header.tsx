import { Pressable, View } from 'react-native';
import { minTarget, space, useColors } from '@/theme';
import { Txt } from './ui';

/**
 * Toolbar for a sheet (form sheets on Android can't show a native header): Cancel on the
 * leading side, the title, and the confirming action — prominent — on the trailing side.
 */
export function SheetHeader({
  title,
  onCancel,
  onConfirm,
  confirmLabel = 'Save',
  busy,
}: {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  busy?: boolean;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: space.sm,
        paddingTop: space.md,
        paddingBottom: space.xs,
        minHeight: minTarget + space.md,
      }}
    >
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        style={{ minHeight: minTarget, minWidth: 72, justifyContent: 'center', paddingHorizontal: space.sm }}
      >
        <Txt tone="accent">Cancel</Txt>
      </Pressable>
      <Txt variant="headline" accessibilityRole="header" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
        {title}
      </Txt>
      <Pressable
        onPress={onConfirm}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={confirmLabel}
        accessibilityState={{ disabled: !!busy, busy: !!busy }}
        style={({ pressed }) => ({
          minHeight: 36,
          minWidth: 72,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: space.md,
          borderRadius: 18,
          backgroundColor: c.accent,
          opacity: busy ? 0.5 : pressed ? 0.75 : 1,
          marginRight: space.sm,
        })}
        hitSlop={6}
      >
        <Txt variant="headline" tone="accentFg">
          {confirmLabel}
        </Txt>
      </Pressable>
    </View>
  );
}
