import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Fulfillment } from '@/data/types';
import { colors, elevation, fonts, radius, space } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Button, IconButton, Tap, Txt } from './ui';

/* ——— Header morado de pantallas internas ——— */

export function ScreenHeader({
  title,
  kicker,
  onBack,
  back = true,
  right,
  children,
}: {
  title: string;
  kicker?: string;
  onBack?: () => void;
  back?: boolean;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
      <StatusBar style="light" />
      <View style={styles.headerRow}>
        {back && <IconButton icon="arrow-left" label="Volver" color={colors.white} onPress={goBack} />}
        <View style={{ flex: 1, paddingLeft: back ? 0 : space.sm }}>
          {kicker && (
            <Txt variant="labelSm" color="rgba(255,255,255,0.75)" style={{ textTransform: 'uppercase' }}>
              {kicker}
            </Txt>
          )}
          <Txt variant="headlineLg" color={colors.white} numberOfLines={2}>
            {title}
          </Txt>
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

/* ——— Toggle Delivery / Para llevar ——— */

export function FulfillmentToggle({
  value,
  onChange,
  tone = 'dark',
}: {
  value: Fulfillment;
  onChange: (f: Fulfillment) => void;
  tone?: 'dark' | 'light';
}) {
  const dark = tone === 'dark';
  const options: { id: Fulfillment; label: string; icon: IconName }[] = [
    { id: 'delivery', label: 'Delivery', icon: 'moped-outline' },
    { id: 'pickup', label: 'Para llevar', icon: 'storefront-outline' },
  ];
  return (
    <View
      style={[styles.toggle, { backgroundColor: dark ? 'rgba(0,0,0,0.22)' : colors.surfaceMid }]}
      accessibilityRole="tablist"
    >
      {options.map((o) => {
        const active = o.id === value;
        const fg = active
          ? dark
            ? colors.primary
            : colors.white
          : dark
            ? 'rgba(255,255,255,0.8)'
            : colors.textMuted;
        return (
          <Tap
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
            style={[
              styles.toggleItem,
              active && { backgroundColor: dark ? colors.white : colors.primary },
              active && elevation.card,
            ]}
          >
            <Icon name={o.icon} size={18} color={fg} />
            <Txt variant="labelMd" weight={active ? 'bold' : 'semibold'} color={fg}>
              {o.label}
            </Txt>
          </Tap>
        );
      })}
    </View>
  );
}

/* ——— Barra de búsqueda ——— */

export function SearchBar({
  value,
  onChangeText,
  placeholder,
  onPress,
  onFilter,
  autoFocus,
  onSubmit,
  style,
}: {
  value?: string;
  onChangeText?: (t: string) => void;
  placeholder: string;
  onPress?: () => void;
  onFilter?: () => void;
  autoFocus?: boolean;
  onSubmit?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const content = (
    <>
      <Icon name="magnify" size={22} color={colors.textMuted} />
      {onPress ? (
        <Txt variant="bodyMd" color={colors.placeholder} style={{ flex: 1 }} numberOfLines={1}>
          {placeholder}
        </Txt>
      ) : (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          style={styles.searchInput}
          autoFocus={autoFocus}
          returnKeyType="search"
          onSubmitEditing={onSubmit}
          accessibilityLabel={placeholder}
          autoCorrect={false}
        />
      )}
      {!!value && !onPress && (
        <IconButton
          icon="close-circle"
          label="Limpiar búsqueda"
          size={32}
          color={colors.placeholder}
          onPress={() => onChangeText?.('')}
        />
      )}
      {onFilter && (
        <IconButton icon="tune-variant" label="Filtros" size={36} color={colors.text} onPress={onFilter} />
      )}
    </>
  );
  if (onPress) {
    return (
      <Tap
        onPress={onPress}
        style={[styles.search, style]}
        accessibilityLabel={placeholder}
        pressedStyle={{ opacity: 0.85 }}
      >
        {content}
      </Tap>
    );
  }
  return <View style={[styles.search, style]}>{content}</View>;
}

/* ——— Campo de texto ——— */

export function TextField({
  label,
  icon,
  error,
  prefix,
  style,
  ...input
}: React.ComponentProps<typeof TextInput> & {
  label?: string;
  icon?: IconName;
  error?: string;
  prefix?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ gap: 6 }, style]}>
      {label && (
        <Txt variant="labelMd" color={colors.textMuted}>
          {label}
        </Txt>
      )}
      <View
        style={[
          styles.field,
          focused && { borderColor: colors.primary, borderWidth: 1.5 },
          !!error && { borderColor: colors.error },
        ]}
      >
        {icon && <Icon name={icon} size={20} color={colors.textMuted} />}
        {prefix && (
          <Txt variant="labelLg" color={colors.textMuted}>
            {prefix}
          </Txt>
        )}
        <TextInput
          placeholderTextColor={colors.placeholder}
          {...input}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[styles.fieldInput, input.multiline && styles.multiline]}
          accessibilityLabel={input.accessibilityLabel ?? label ?? input.placeholder}
        />
      </View>
      {error && (
        <Animated.View entering={FadeIn} style={styles.errorRow}>
          <Icon name="alert-circle-outline" size={14} color={colors.error} />
          <Txt variant="bodySm" color={colors.error} style={{ flex: 1 }}>
            {error}
          </Txt>
        </Animated.View>
      )}
    </View>
  );
}

/* ——— Opción tipo radio ——— */

export function RadioCard({
  selected,
  onPress,
  title,
  subtitle,
  icon,
  iconNode,
  badge,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconNode?: ReactNode;
  badge?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View style={[styles.radioCard, selected && styles.radioCardActive]}>
      <Tap
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={title}
        style={styles.radioRow}
        pressedStyle={{ opacity: 0.8 }}
      >
        {iconNode ??
          (icon && (
            <View style={[styles.radioIcon, selected && { backgroundColor: colors.gold }]}>
              <Icon name={icon} size={20} color={selected ? colors.onGold : colors.textMuted} />
            </View>
          ))}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
            <Txt variant="labelLg">{title}</Txt>
            {badge}
          </View>
          {subtitle && (
            <Txt variant="bodySm" color={colors.textMuted}>
              {subtitle}
            </Txt>
          )}
        </View>
        <View style={[styles.radioDot, selected && { borderColor: colors.primary }]}>
          {selected && <View style={styles.radioDotInner} />}
        </View>
      </Tap>
      {children}
    </View>
  );
}

/* ——— Estado vacío ——— */

export function EmptyState({
  icon,
  title,
  message,
  action,
  onAction,
}: {
  icon: IconName;
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={40} color={colors.primary} />
      </View>
      <Txt variant="headlineMd" align="center">
        {title}
      </Txt>
      <Txt variant="bodyMd" color={colors.textMuted} align="center">
        {message}
      </Txt>
      {action && (
        <Button
          label={action}
          onPress={onAction}
          full={false}
          style={{ marginTop: space.sm, alignSelf: 'center' }}
        />
      )}
    </View>
  );
}

/* ——— Acordeón ——— */

export function Accordion({
  title,
  icon,
  children,
  initiallyOpen,
  tone,
}: {
  title: string;
  icon: IconName;
  children: ReactNode;
  initiallyOpen?: boolean;
  tone?: 'danger';
}) {
  const [open, setOpen] = useState(!!initiallyOpen);
  return (
    <View style={styles.accordion}>
      <Tap
        onPress={() => setOpen((o) => !o)}
        style={styles.accordionHead}
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        pressedStyle={{ opacity: 0.7 }}
      >
        <Icon name={icon} size={22} color={tone === 'danger' ? colors.error : colors.text} />
        <Txt variant="headlineMd" style={{ flex: 1, fontSize: 16 }}>
          {title}
        </Txt>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={22} color={colors.textMuted} />
      </Tap>
      {open && (
        <Animated.View entering={FadeIn.duration(180)} style={{ paddingLeft: 34, paddingBottom: space.lg }}>
          {children}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: space.sm,
    paddingBottom: space.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 48 },
  toggle: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    padding: 4,
    gap: 4,
  },
  toggleItem: {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 50,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: space.md,
    paddingRight: space.xs,
    ...elevation.float,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
    outlineStyle: 'none',
  } as object,
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DED6DA',
    paddingHorizontal: space.md,
  },
  fieldInput: {
    flex: 1,
    minHeight: 46,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.text,
    outlineStyle: 'none',
  } as object,
  multiline: { minHeight: 110, textAlignVertical: 'top', paddingTop: space.md },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  radioCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  radioCardActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primaryTint },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, minHeight: 64 },
  radioIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotInner: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.primary },
  empty: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xxl, paddingVertical: 48 },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  accordion: { borderBottomWidth: 1, borderBottomColor: colors.border },
  accordionHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.lg },
});
