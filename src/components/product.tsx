import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { discountPercent } from '@/data/products';
import type { Product } from '@/data/types';
import { money } from '@/lib/format';
import { haptic } from '@/lib/feedback';
import { useAddToCart } from '@/lib/useAddToCart';
import { MAX_QTY, useCart, useCartQty } from '@/store/cart';
import { colors, radius, space } from '@/theme/tokens';
import { Icon } from './Icon';
import { Badge, type BadgeToneName, Tap, Txt } from './ui';

/* ——— Imagen o placeholder con ícono ——— */

export function ProductImage({
  product,
  size,
  style,
  rounded = radius.lg,
  contentFit = 'cover',
}: {
  product: Pick<Product, 'image' | 'icon' | 'tint' | 'name'>;
  size?: number;
  style?: StyleProp<ViewStyle>;
  rounded?: number;
  contentFit?: 'cover' | 'contain';
}) {
  const box: StyleProp<ViewStyle> = [
    { borderRadius: rounded, overflow: 'hidden', backgroundColor: product.tint ?? colors.surfaceLow },
    size ? { width: size, height: size } : { width: '100%', aspectRatio: 1 },
    style,
  ];
  if (product.image) {
    return (
      <View style={box}>
        <Image
          source={product.image}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          transition={150}
          accessibilityLabel={product.name}
        />
      </View>
    );
  }
  return (
    <View style={[box, styles.center]} accessibilityLabel={product.name}>
      <Icon name={product.icon ?? 'package-variant'} size={(size ?? 120) * 0.42} color={colors.primary} />
    </View>
  );
}

/* ——— Precio ——— */

export function PriceStack({
  product,
  size = 'md',
  horizontal,
}: {
  product: Pick<Product, 'price' | 'regularPrice' | 'priceNote'>;
  size?: 'sm' | 'md' | 'lg';
  horizontal?: boolean;
}) {
  const fontSize = size === 'lg' ? 26 : size === 'sm' ? 16 : 20;
  const hasStrike = !!product.regularPrice && product.regularPrice > product.price;
  const strike = hasStrike && (
    <Txt variant="priceStrike" color={colors.textSubtle}>
      {money(product.regularPrice!)}
    </Txt>
  );
  return (
    <View style={horizontal ? styles.priceRow : undefined}>
      {!horizontal && strike}
      {!horizontal && !hasStrike && product.priceNote && (
        <Txt variant="labelSm" color={colors.goldText}>
          {product.priceNote}
        </Txt>
      )}
      <Txt variant="price" color={colors.primary} style={{ fontSize, lineHeight: fontSize + 4 }}>
        {money(product.price)}
      </Txt>
      {horizontal && strike}
    </View>
  );
}

/* ——— Selector de cantidad ——— */

export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = MAX_QTY,
  size = 'md',
  tone = 'light',
  trashAtMin,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
  tone?: 'light' | 'gold';
  trashAtMin?: boolean;
}) {
  const h = size === 'sm' ? 34 : 44;
  const fg = colors.text;
  const showTrash = trashAtMin && value <= 1;
  const change = (n: number) => {
    haptic.tap();
    onChange(n);
  };
  return (
    <View
      style={[
        styles.stepper,
        { height: h, backgroundColor: tone === 'gold' ? colors.gold : colors.surface },
        tone === 'light' && { borderWidth: 1, borderColor: colors.borderStrong },
      ]}
    >
      <Tap
        onPress={() => change(value - 1)}
        disabled={!showTrash && value <= min}
        style={[styles.stepBtn, { width: h }]}
        accessibilityLabel={showTrash ? 'Quitar producto' : 'Disminuir cantidad'}
        hitSlop={4}
      >
        <Icon
          name={showTrash ? 'trash-can-outline' : 'minus'}
          size={size === 'sm' ? 18 : 20}
          color={showTrash ? colors.error : fg}
        />
      </Tap>
      <Txt
        variant="labelLg"
        weight="bold"
        style={{ minWidth: 22, textAlign: 'center' }}
        accessibilityLabel={`Cantidad ${value}`}
      >
        {value}
      </Txt>
      <Tap
        onPress={() => change(value + 1)}
        disabled={value >= max}
        style={[styles.stepBtn, { width: h }]}
        accessibilityLabel="Aumentar cantidad"
        hitSlop={4}
      >
        <Icon name="plus" size={size === 'sm' ? 18 : 20} color={fg} />
      </Tap>
    </View>
  );
}

/** Botón "+" que se transforma en stepper cuando el producto ya está en el carrito. */
export function AddControl({
  productId,
  variant = 'gold',
}: {
  productId: string;
  variant?: 'gold' | 'brand' | 'soft';
}) {
  const qty = useCartQty(productId);
  const setQty = useCart((s) => s.setQty);
  const addToCart = useAddToCart();
  if (qty > 0) {
    return (
      <QuantityStepper size="sm" tone="gold" value={qty} onChange={(n) => setQty(productId, n)} trashAtMin />
    );
  }
  const bg = variant === 'brand' ? colors.primary : variant === 'soft' ? colors.primarySoft : colors.gold;
  const fg = variant === 'brand' ? colors.white : variant === 'soft' ? colors.primary : colors.onGold;
  return (
    <Tap
      onPress={() => addToCart(productId)}
      style={[styles.addBtn, { backgroundColor: bg }]}
      accessibilityLabel="Agregar al carrito"
      hitSlop={6}
    >
      <Icon name="plus" size={22} color={fg} />
    </Tap>
  );
}

/* ——— Tarjeta de producto ——— */

const toneFor = (tone?: string): BadgeToneName =>
  tone === 'popular' ? 'popular' : tone === 'combo' ? 'combo' : tone === 'promo' ? 'promo' : 'discount';

export function ProductCard({
  product,
  width,
  addVariant = 'gold',
  showBadge = true,
}: {
  product: Product;
  width?: number;
  addVariant?: 'gold' | 'brand';
  showBadge?: boolean;
}) {
  const pct = discountPercent(product);
  const badge =
    pct > 0 && product.badge?.tone !== 'combo' ? { label: `-${pct}%`, tone: 'discount' } : product.badge;
  return (
    <Tap
      onPress={() => router.push(`/producto/${product.id}`)}
      style={[styles.card, width ? { width } : { flex: 1 }]}
      pressedStyle={{ opacity: 0.9 }}
      hasNestedControls
      accessibilityLabel={`${product.name}, ${money(product.price)}`}
    >
      <View>
        <ProductImage product={product} rounded={radius.lg} />
        {showBadge && badge && (
          <Badge label={badge.label} tone={toneFor(badge.tone)} style={styles.cardBadge} />
        )}
      </View>
      <View style={styles.cardBody}>
        <Txt variant="labelLg" numberOfLines={2} style={{ minHeight: 40 }}>
          {product.name}
        </Txt>
        <Txt variant="bodySm" color={colors.textMuted} numberOfLines={1}>
          {product.subtitle}
        </Txt>
      </View>
      <View style={styles.cardFooter}>
        <View style={{ flexGrow: 1, minWidth: 72 }}>
          <PriceStack product={product} size="sm" />
        </View>
        <AddControl productId={product.id} variant={addVariant} />
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    paddingHorizontal: 2,
  },
  stepBtn: { height: '100%', alignItems: 'center', justifyContent: 'center' },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#EFE7EC',
    padding: space.md,
    gap: space.sm,
  },
  cardBadge: { position: 'absolute', top: 8, left: 8, borderRadius: radius.sm },
  cardBody: { gap: 2 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMid,
    paddingTop: space.sm,
    marginTop: 'auto',
    flexWrap: 'wrap',
    columnGap: space.xs,
    rowGap: 6,
  },
});
