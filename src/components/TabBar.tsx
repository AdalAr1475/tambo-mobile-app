import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation, radius, TAB_BAR_HEIGHT } from '@/theme/tokens';
import { haptic } from '@/lib/feedback';
import { Icon, type IconName } from './Icon';
import { Tap, Txt } from './ui';

const TABS: Record<string, { label: string; icon: IconName; iconActive: IconName; dot?: boolean }> = {
  index: { label: 'Inicio', icon: 'storefront-outline', iconActive: 'storefront' },
  categorias: { label: 'Categorías', icon: 'view-grid-outline', iconActive: 'view-grid' },
  descuentos: { label: 'Descuentos', icon: 'tag-outline', iconActive: 'tag', dot: true },
  ordenes: { label: 'Órdenes', icon: 'receipt-text-outline', iconActive: 'receipt-text' },
  perfil: { label: 'Perfil', icon: 'account-outline', iconActive: 'account' },
};

export function TabBar({
  state,
  emitter,
  navigateToTab,
  badges = {},
}: BottomTabBarProps & { badges?: Record<string, number> }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: TAB_BAR_HEIGHT + insets.bottom }]}>
      {state.routes.map((route, index) => {
        const meta = TABS[route.name];
        if (!meta) return null;
        const focused = state.index === index;
        const badge = badges[route.name];
        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            haptic.tap();
            navigateToTab(route.key);
          }
        };
        return (
          <Tap
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={meta.label}
            style={styles.item}
            pressedStyle={{ opacity: 0.7 }}
          >
            <View style={[styles.pill, focused && styles.pillActive]}>
              <Icon
                name={focused ? meta.iconActive : meta.icon}
                size={24}
                color={focused ? colors.primary : colors.textSubtle}
              />
              {meta.dot && !focused && <View style={styles.dot} />}
              {!!badge && (
                <View style={styles.badge}>
                  <Txt variant="labelSm" color={colors.white} style={{ fontSize: 10 }}>
                    {badge}
                  </Txt>
                </View>
              )}
            </View>
            <Txt
              variant="labelSm"
              weight={focused ? 'bold' : 'semibold'}
              color={focused ? colors.primary : colors.textSubtle}
              style={{ fontSize: 11 }}
              numberOfLines={1}
            >
              {meta.label}
            </Txt>
          </Tap>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: '#ECEFF1',
    ...elevation.nav,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pill: {
    width: 56,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: colors.primarySoft },
  dot: {
    position: 'absolute',
    top: 2,
    right: 12,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.goldDark,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.magenta,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
