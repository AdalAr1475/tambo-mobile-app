import { router } from 'expo-router';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from '@/components/Icon';
import { Tap, Txt } from '@/components/ui';
import { haptic } from '@/lib/feedback';
import { colors, radius } from '@/theme/tokens';

/** Acceso al visor Tambo Spatial (`/visor/[id]`). Solo se usa con productos que tienen `model3d`. */
export function View3DChip({
  productId,
  tone = 'light',
  compact,
  style,
}: {
  productId: string;
  /** `light`: sobre fotos de producto. `dark`: sobre banners de color. */
  tone?: 'light' | 'dark';
  /** Solo "3D" (banners con poco espacio). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const dark = tone === 'dark';
  return (
    <Tap
      onPress={() => {
        haptic.tap();
        router.push(`/visor/${productId}`);
      }}
      hitSlop={6}
      accessibilityLabel="Ver en 3D"
      style={[styles.chip, dark ? styles.dark : styles.light, style]}
    >
      <Icon name="rotate-3d-variant" size={compact ? 18 : 14} color={dark ? colors.onDark : colors.primary} />
      <Txt variant="labelSm" color={dark ? colors.onDark : colors.primary}>
        {compact ? '3D' : 'Ver en 3D'}
      </Txt>
    </Tap>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 26,
    borderRadius: radius.full,
  },
  light: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primarySoft },
  dark: { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, height: 38, paddingHorizontal: 10 },
});
