import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import type { OrderItem, Product, RedeemMode } from '@/data/types';
import { money } from '@/lib/format';
import { formatPoints, pts } from '@/lib/points';
import { redeemOption } from '@/lib/pricing';
import { cartPointsInUse, useAddToCart } from '@/lib/useAddToCart';
import { useBalance } from '@/store/wallet';
import { colors, radius, space } from '@/theme/tokens';
import { Icon } from './Icon';
import { RadioCard } from './layout';
import { ProductImage } from './product';
import { Sheet } from './Sheet';
import { Badge, Button, Row, Tap, Txt } from './ui';

export const POINTS_ICON = 'star-circle' as const;

/** "350 pts" o "200 pts + S/ 1.50". */
export const redeemLabel = (option: { points: number; cash: number }, qty = 1) =>
  option.cash > 0 ? `${pts(option.points * qty)} + ${money(option.cash * qty)}` : pts(option.points * qty);

/** Importe de una línea de pedido: "S/ 11.90", "350 pts" o "200 pts + S/ 1.50". */
export const orderItemPrice = (i: OrderItem) =>
  i.redeem && i.points ? redeemLabel({ points: i.points, cash: i.price }, i.qty) : money(i.lineTotal);

/** Modalidades de canje que ofrece un producto (en orden: 100% puntos, mixto). */
export const redeemModes = (product: Product): RedeemMode[] =>
  (['points', 'mixed'] as const).filter((m) => !!redeemOption(product, m));

/** Píldora dorada con el saldo (cabecera de Inicio y Descuentos). */
export function PointsPill() {
  const balance = useBalance();
  return (
    <Tap
      onPress={() => router.push('/puntos')}
      style={styles.pill}
      accessibilityLabel={`Tienes ${formatPoints(balance)} puntos Tambo Lover. Ver mis puntos`}
    >
      <Icon name={POINTS_ICON} size={18} color={colors.onGold} />
      <Animated.View key={balance} entering={ZoomIn.duration(250)}>
        <Txt variant="labelMd" weight="extrabold" color={colors.onGold}>
          {formatPoints(balance)}
        </Txt>
      </Animated.View>
    </Tap>
  );
}

/** Fila de la zona de canje: producto + precios en puntos + botón "Canjear". */
export function RedeemCard({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const modes = redeemModes(product);
  if (modes.length === 0) return null;
  return (
    <View style={styles.card}>
      <Tap
        onPress={() => router.push(`/producto/${product.id}`)}
        style={styles.cardMain}
        accessibilityLabel={`Ver ${product.name}`}
        pressedStyle={{ opacity: 0.85 }}
      >
        <ProductImage product={product} size={64} rounded={radius.md} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="labelLg" numberOfLines={2}>
            {product.name}
          </Txt>
          {modes.map((m) => (
            <Row key={m} style={{ gap: 4 }}>
              <Icon name={POINTS_ICON} size={14} color={colors.goldText} />
              <Txt variant="labelMd" color={colors.goldText}>
                {redeemLabel(redeemOption(product, m)!)}
              </Txt>
              {m === 'points' && <Badge label="Gratis" tone="success" />}
            </Row>
          ))}
          <Txt variant="bodySm" color={colors.textSubtle}>
            Precio normal {money(product.price)}
          </Txt>
        </View>
      </Tap>
      <Button label="Canjear" size="sm" full={false} onPress={() => setOpen(true)} />
      <RedeemSheet product={product} visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

/** Elegir cómo canjear un producto (100% puntos o puntos + soles) y agregarlo al carrito. */
export function RedeemSheet({
  product,
  visible,
  onClose,
}: {
  product: Product;
  visible: boolean;
  onClose: () => void;
}) {
  const balance = useBalance();
  const addToCart = useAddToCart();
  const modes = redeemModes(product);
  const [mode, setMode] = useState<RedeemMode>(modes[0] ?? 'points');
  const option = redeemOption(product, mode);
  const available = balance - (visible ? cartPointsInUse() : 0);
  const missing = option ? option.points - available : 0;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={`Canjear ${product.name}`}
      subtitle={`Tienes ${pts(available)} disponibles`}
    >
      <View style={{ gap: space.md }}>
        {modes.map((m) => {
          const o = redeemOption(product, m)!;
          return (
            <RadioCard
              key={m}
              selected={mode === m}
              onPress={() => setMode(m)}
              title={m === 'points' ? '100% con puntos' : 'Puntos + soles'}
              subtitle={`${redeemLabel(o)} • pagas ${money(o.cash)}`}
              icon={m === 'points' ? 'gift-outline' : 'cash-plus'}
            />
          );
        })}
        <Button
          label={missing > 0 ? `Te faltan ${pts(missing)}` : 'Agregar al carrito con puntos'}
          icon={POINTS_ICON}
          disabled={missing > 0 || !option}
          onPress={() => {
            addToCart(product.id, 1, { redeem: mode });
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: colors.surface,
  },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
});
