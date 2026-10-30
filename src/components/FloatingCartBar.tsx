import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { money } from '@/lib/format';
import { useCartCount, useCartLines, useCartTotals } from '@/store/cart';
import { colors, elevation, radius, space } from '@/theme/tokens';
import { Icon } from './Icon';
import { Tap, Txt } from './ui';

/** Barra "Ver pedido actual / Ir a pagar". Se ubica sobre la tab bar. */
export function FloatingCartBar({ bottom = space.md }: { bottom?: number }) {
  const count = useCartCount();
  const lines = useCartLines();
  const totals = useCartTotals();
  if (count === 0) return null;
  const summary =
    lines.length === 1 ? lines[0].product.name : `${lines[0].product.name} y ${lines.length - 1} más`;

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(180)}
      style={[styles.wrap, { bottom }]}
    >
      <Tap
        onPress={() => router.push('/carrito')}
        style={styles.bar}
        accessibilityLabel={`Ver pedido actual, ${count} productos, ${money(totals.total)}. Ir a pagar`}
        pressedStyle={{ opacity: 0.92 }}
      >
        <View style={styles.count}>
          <Txt variant="labelLg" weight="extrabold" color={colors.onGold}>
            {count}
          </Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="labelLg" weight="bold" color={colors.white}>
            Ver pedido actual
          </Txt>
          <Txt variant="bodySm" color="rgba(255,255,255,0.8)" numberOfLines={1}>
            {summary} • {money(totals.subtotal)}
          </Txt>
        </View>
        <View style={styles.cta}>
          <Txt variant="labelMd" weight="bold" color={colors.onGold}>
            Ir a pagar
          </Txt>
          <Icon name="arrow-right" size={18} color={colors.onGold} />
        </View>
      </Tap>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.primaryDark,
    borderRadius: radius.xl,
    padding: space.md,
    ...elevation.float,
  },
  count: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    height: 36,
  },
});
