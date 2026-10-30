import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  type TextProps,
  type StyleProp,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { colors, elevation, fonts, radius, space, type as typeScale, type TypeVariant } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';

/* ——— Texto ——— */

type TxtProps = TextProps & {
  variant?: TypeVariant;
  color?: string;
  weight?: keyof typeof fonts;
  align?: 'left' | 'center' | 'right';
};

export function Txt({ variant = 'bodyMd', color = colors.text, weight, align, style, ...rest }: TxtProps) {
  return (
    <Text
      {...rest}
      style={[
        typeScale[variant],
        { color },
        weight && { fontFamily: fonts[weight] },
        align && { textAlign: align },
        style,
      ]}
    />
  );
}

/* ——— Pressable con feedback ——— */

type TapProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  /** La superficie contiene otros botones: en web no puede ser un <button>. */
  hasNestedControls?: boolean;
};

export function Tap({ style, pressedStyle, hasNestedControls, ...rest }: TapProps) {
  const webContainer = hasNestedControls && Platform.OS === 'web';
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      {...(webContainer && { accessibilityRole: undefined, role: 'group' })}
      style={({ pressed }) => [
        style,
        pressed && (pressedStyle ?? { opacity: 0.75, transform: [{ scale: 0.98 }] }),
        rest.disabled && { opacity: 0.5 },
      ]}
    />
  );
}

/* ——— Botones ——— */

type ButtonVariant = 'gold' | 'brand' | 'ghost' | 'outline' | 'danger' | 'soft';

const buttonColors: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  gold: { bg: colors.gold, fg: colors.onGold },
  brand: { bg: colors.primary, fg: colors.white },
  ghost: { bg: 'transparent', fg: colors.primary },
  outline: { bg: colors.surface, fg: colors.primary, border: colors.border },
  danger: { bg: colors.errorSoft, fg: colors.error, border: '#F7C1BB' },
  soft: { bg: colors.surfaceMid, fg: colors.text },
};

type ButtonProps = Omit<TapProps, 'children'> & {
  label: string;
  variant?: ButtonVariant;
  icon?: IconName;
  iconRight?: IconName;
  trailing?: string;
  loading?: boolean;
  size?: 'md' | 'lg' | 'sm';
  full?: boolean;
};

export function Button({
  label,
  variant = 'gold',
  icon,
  iconRight,
  trailing,
  loading,
  size = 'md',
  full = true,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  const c = buttonColors[variant];
  const height = size === 'lg' ? 56 : size === 'sm' ? 38 : 48;
  return (
    <Tap
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      {...rest}
      style={[
        styles.button,
        {
          height,
          backgroundColor: c.bg,
          borderColor: c.border ?? 'transparent',
          borderWidth: c.border ? 1 : 0,
          alignSelf: full ? 'stretch' : 'flex-start',
          paddingHorizontal: size === 'sm' ? space.md : space.lg,
        },
        variant === 'gold' && elevation.float,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <>
          <View style={styles.buttonMain}>
            {icon && <Icon name={icon} size={size === 'sm' ? 18 : 20} color={c.fg} />}
            <Txt variant={size === 'sm' ? 'labelMd' : 'labelLg'} weight="bold" color={c.fg} numberOfLines={1}>
              {label}
            </Txt>
            {iconRight && <Icon name={iconRight} size={20} color={c.fg} />}
          </View>
          {trailing && (
            <View style={styles.trailing}>
              <Txt variant="labelLg" weight="extrabold" color={c.fg}>
                {trailing}
              </Txt>
            </View>
          )}
        </>
      )}
    </Tap>
  );
}

type IconButtonProps = Omit<TapProps, 'children'> & {
  icon: IconName;
  label: string;
  color?: string;
  bg?: string;
  size?: number;
  badge?: number;
};

export function IconButton({
  icon,
  label,
  color = colors.text,
  bg = 'transparent',
  size = 44,
  badge,
  style,
  ...rest
}: IconButtonProps) {
  return (
    <Tap
      accessibilityLabel={label}
      hitSlop={6}
      {...rest}
      style={[styles.iconButton, { width: size, height: size, backgroundColor: bg }, style]}
    >
      <Icon name={icon} size={Math.round(size * 0.52)} color={color} />
      {!!badge && badge > 0 && (
        <View style={styles.countBadge}>
          <Txt variant="labelSm" color={colors.onGold}>
            {badge > 99 ? '99+' : badge}
          </Txt>
        </View>
      )}
    </Tap>
  );
}

/* ——— Superficies ——— */

export function Card({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.card, style]} />;
}

export function Divider({ style, dashed }: { style?: StyleProp<ViewStyle>; dashed?: boolean }) {
  return <View style={[styles.divider, dashed && styles.dashed, style]} />;
}

/* ——— Badges y chips ——— */

const badgeTones = {
  discount: { bg: colors.error, fg: colors.white },
  popular: { bg: colors.primary, fg: colors.white },
  combo: { bg: colors.primaryDark, fg: colors.white },
  promo: { bg: colors.gold, fg: colors.onGold },
  new: { bg: colors.magenta, fg: colors.white },
  soft: { bg: colors.primarySoft, fg: colors.primary },
  success: { bg: colors.successSoft, fg: colors.success },
  neutral: { bg: colors.surfaceMid, fg: colors.textMuted },
  warning: { bg: colors.goldSoft, fg: colors.goldText },
  danger: { bg: colors.errorSoft, fg: colors.error },
} as const;

export type BadgeToneName = keyof typeof badgeTones;

export function Badge({
  label,
  tone = 'soft',
  icon,
  style,
}: {
  label: string;
  tone?: BadgeToneName;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const t = badgeTones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, style]}>
      {icon && <Icon name={icon} size={12} color={t.fg} />}
      <Txt variant="labelSm" color={t.fg}>
        {label}
      </Txt>
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  count,
  tone = 'light',
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  count?: number;
  tone?: 'light' | 'onPrimary';
}) {
  const onPrimary = tone === 'onPrimary';
  return (
    <Tap
      onPress={onPress}
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={label}
      style={[
        styles.chip,
        onPrimary
          ? { backgroundColor: active ? colors.gold : 'rgba(255,255,255,0.14)', borderColor: 'transparent' }
          : {
              backgroundColor: active ? colors.primaryDark : colors.surface,
              borderColor: active ? colors.primaryDark : colors.border,
            },
      ]}
    >
      <Txt
        variant="labelMd"
        weight={active ? 'bold' : 'semibold'}
        color={onPrimary ? (active ? colors.onGold : colors.white) : active ? colors.white : colors.text}
      >
        {label}
        {count !== undefined ? ` (${count})` : ''}
      </Txt>
    </Tap>
  );
}

/* ——— Encabezados de sección ——— */

export function SectionHeader({
  title,
  action,
  onAction,
  icon,
  right,
  subtitle,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  icon?: IconName;
  right?: ReactNode;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <View style={styles.row}>
          {icon && <Icon name={icon} size={22} color={colors.magenta} />}
          <Txt variant="headlineMd">{title}</Txt>
        </View>
        {subtitle && (
          <Txt variant="bodySm" color={colors.textMuted} style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        )}
      </View>
      {right}
      {action && (
        <Tap onPress={onAction} hitSlop={10} style={styles.row} accessibilityLabel={action}>
          <Txt variant="labelMd" color={colors.primary}>
            {action}
          </Txt>
          <Icon name="chevron-right" size={18} color={colors.primary} />
        </Tap>
      )}
    </View>
  );
}

export function Row({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.row, style]} />;
}

export function Spacer({ h = 0, w = 0 }: { h?: number; w?: number }) {
  return <View style={{ height: h, width: w }} />;
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonMain: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  trailing: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  iconButton: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  countBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#F1ECEE',
    ...elevation.card,
  },
  divider: { height: 1, backgroundColor: colors.border },
  dashed: { height: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  chip: {
    paddingHorizontal: space.lg,
    height: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    marginBottom: space.md,
    gap: space.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
