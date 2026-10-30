import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, LinearTransition, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeliveryPointSheet, useDeliveryPoint } from '@/components/delivery';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/layout';
import { ProductImage, QuantityStepper } from '@/components/product';
import { SummaryRow } from '@/components/summary';
import { ToastHost } from '@/components/ToastHost';
import { Badge, Button, Card, Divider, IconButton, Row, Tap, Txt } from '@/components/ui';
import { coupons } from '@/data/stores';
import { discountPercent } from '@/data/products';
import { money } from '@/lib/format';
import { haptic } from '@/lib/feedback';
import { checkCoupon, lineRegular, lineTotal, type CartLine } from '@/lib/pricing';
import { useCart, useCartLines, useCartTotals } from '@/store/cart';
import { useSession } from '@/store/session';
import { toast, useUi } from '@/store/ui';
import { colors, elevation, fonts, radius, space } from '@/theme/tokens';

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const lines = useCartLines();
  const totals = useCartTotals();
  const point = useDeliveryPoint();
  const [pointOpen, setPointOpen] = useState(false);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // El aviso "producto agregado · Ver carrito" ya no aplica dentro del carrito.
  useEffect(() => {
    const { toast: current, hideToast } = useUi.getState();
    if (current) hideToast(current.id);
  }, []);

  const goCheckout = () => {
    if (point.fulfillment === 'delivery' && !point.address) {
      toast('Agrega una dirección de entrega', { tone: 'error' });
      setPointOpen(true);
      return;
    }
    router.replace('/checkout');
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.View entering={FadeIn.duration(200)} style={styles.scrim}>
        <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Cerrar carrito" />
      </Animated.View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}
        pointerEvents="box-none"
      >
        <Animated.View
          entering={SlideInDown.springify().damping(24).stiffness(200)}
          style={[styles.panel, { maxHeight: '94%', paddingBottom: Math.max(insets.bottom, space.md) }]}
        >
          <View style={styles.handle} />
          <Row style={styles.header}>
            <View style={styles.headerIcon}>
              <Icon name="cart-outline" size={22} color={colors.primary} />
            </View>
            <Txt variant="headlineLg" color={colors.primaryDark} style={{ flex: 1 }}>
              Tu Carrito{' '}
              <Txt variant="bodyMd" color={colors.textMuted}>
                ({totals.itemCount} {totals.itemCount === 1 ? 'ítem' : 'ítems'})
              </Txt>
            </Txt>
            <IconButton icon="close" label="Cerrar" bg={colors.surfaceMid} onPress={close} />
          </Row>

          {lines.length === 0 ? (
            <EmptyState
              icon="cart-outline"
              title="Tu carrito está vacío"
              message="Agrega tus antojos favoritos y te los llevamos en 25-35 min."
              action="Explorar productos"
              onAction={close}
            />
          ) : (
            <>
              <ScrollView
                style={{ flexGrow: 0 }}
                contentContainerStyle={styles.body}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Card style={styles.block}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt variant="labelSm" color={colors.textMuted} style={styles.upper}>
                      {point.fulfillment === 'delivery' ? 'Punto de entrega' : 'Recoges en'}
                    </Txt>
                    <Row style={{ gap: 4 }}>
                      <Icon name="clock-outline" size={16} color={colors.primary} />
                      <Txt variant="labelMd" color={colors.primary}>
                        {point.eta}
                      </Txt>
                    </Row>
                  </Row>
                  <Tap
                    onPress={() => setPointOpen(true)}
                    style={styles.point}
                    accessibilityLabel="Cambiar punto de entrega"
                  >
                    <Icon
                      name={point.fulfillment === 'delivery' ? 'map-marker-outline' : 'storefront-outline'}
                      size={22}
                      color={colors.primary}
                    />
                    <View style={{ flex: 1 }}>
                      <Txt variant="labelLg" numberOfLines={1}>
                        {point.title}
                      </Txt>
                      <Txt variant="bodySm" color={colors.textMuted} numberOfLines={1}>
                        {point.fulfillment === 'delivery' ? point.subtitle : point.store.address}
                      </Txt>
                    </View>
                    <Icon name="chevron-down" size={22} color={colors.textMuted} />
                  </Tap>
                  {totals.freeShippingGap > 0 && (
                    <FreeShippingBar gap={totals.freeShippingGap} subtotal={totals.subtotal} />
                  )}
                </Card>

                <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
                  <Txt variant="labelSm" color={colors.textMuted} style={styles.upper}>
                    Productos en tu bolsa
                  </Txt>
                  <Txt variant="labelSm" color={colors.primary}>
                    Precios en S/
                  </Txt>
                </Row>

                {lines.map((line, index) => (
                  <CartItemRow key={line.product.id} line={line} index={index} />
                ))}

                <CouponBox />
                <Summary />

                <Row style={{ justifyContent: 'center', marginTop: space.sm }}>
                  <Icon name="shield-check-outline" size={16} color={colors.primary} />
                  <Txt variant="bodySm" color={colors.textMuted}>
                    Compra 100% segura con Tambo Express
                  </Txt>
                </Row>
              </ScrollView>

              <View style={styles.footer}>
                <Button
                  label="Continuar con la compra"
                  iconRight="arrow-right"
                  trailing={money(totals.total)}
                  size="lg"
                  onPress={goCheckout}
                />
                <Button label="Seguir comprando" variant="ghost" icon="basket-outline" onPress={close} />
              </View>
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
      <DeliveryPointSheet visible={pointOpen} onClose={() => setPointOpen(false)} />
      {Platform.OS === 'ios' && <ToastHost bottomOffset={156} />}
    </View>
  );
}

function FreeShippingBar({ gap, subtotal }: { gap: number; subtotal: number }) {
  const pct = Math.min(1, subtotal / (subtotal + gap));
  return (
    <View style={{ gap: 6, marginTop: space.sm }}>
      <Row style={{ gap: 6 }}>
        <Icon name="moped-outline" size={16} color={colors.goldText} />
        <Txt variant="bodySm" color={colors.goldText} style={{ flex: 1 }}>
          Te faltan{' '}
          <Txt variant="bodySm" weight="bold" color={colors.goldText}>
            {money(gap)}
          </Txt>{' '}
          para tener delivery gratis
        </Txt>
      </Row>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

function CartItemRow({ line, index }: { line: CartLine; index: number }) {
  const { product, qty } = line;
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const restore = useCart((s) => s.restore);
  const total = lineTotal(product, qty);
  const regular = lineRegular(product, qty);
  const pct = discountPercent(product);
  const multiApplied = product.multiBuy && qty >= product.multiBuy.qty;

  const removeItem = () => {
    haptic.warning();
    remove(product.id);
    toast(`${product.name} eliminado`, {
      icon: 'trash-can-outline',
      action: { label: 'Deshacer', onPress: () => restore({ productId: product.id, qty }, index) },
    });
  };

  const changeQty = (n: number) => (n <= 0 ? removeItem() : setQty(product.id, n));

  return (
    <Animated.View layout={LinearTransition} entering={FadeIn}>
      <Card style={styles.item}>
        <Tap
          onPress={() => router.push(`/producto/${product.id}`)}
          style={styles.itemTop}
          accessibilityLabel={`Ver ${product.name}`}
          pressedStyle={{ opacity: 0.8 }}
        >
          <ProductImage product={product} size={72} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="labelLg" numberOfLines={2}>
              {product.name}
            </Txt>
            <Txt variant="bodySm" color={colors.textMuted} numberOfLines={1}>
              {product.subtitle}
            </Txt>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
              <Row style={{ alignItems: 'baseline', flexShrink: 1 }}>
                <Txt variant="price" color={colors.primary}>
                  {money(total)}
                </Txt>
                {regular > total && (
                  <Txt variant="priceStrike" color={colors.textSubtle}>
                    {money(regular)}
                  </Txt>
                )}
              </Row>
              {pct > 0 ? (
                <Badge label={`-${pct}%`} tone="danger" />
              ) : multiApplied ? (
                <Badge label="Promo aplicada" tone="success" />
              ) : (
                <Txt variant="bodySm" color={colors.textMuted}>
                  {product.multiBuy
                    ? `${product.multiBuy.qty} x ${money(product.multiBuy.price)}`
                    : 'Precio regular'}
                </Txt>
              )}
            </Row>
          </View>
        </Tap>
        <Divider />
        <Row style={{ justifyContent: 'space-between', paddingTop: space.sm }}>
          <QuantityStepper value={qty} onChange={changeQty} size="sm" trashAtMin />
          <Tap onPress={removeItem} style={styles.remove} accessibilityLabel={`Quitar ${product.name}`}>
            <Icon name="trash-can-outline" size={18} color={colors.error} />
            <Txt variant="labelMd" color={colors.error}>
              Quitar
            </Txt>
          </Tap>
        </Row>
      </Card>
    </Animated.View>
  );
}

function CouponBox() {
  const couponCode = useCart((s) => s.couponCode);
  const setCoupon = useCart((s) => s.setCoupon);
  const totals = useCartTotals();
  const usedCoupons = useSession((s) => s.usedCoupons);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();

  const apply = (value = code) => {
    const c = value.trim().toUpperCase();
    if (usedCoupons.includes(c)) {
      setError('Ya usaste este cupón en una compra anterior.');
      return;
    }
    const res = checkCoupon(c, totals.subtotal);
    if (!res.ok) {
      setError(res.error);
      haptic.warning();
      return;
    }
    setError(undefined);
    setCoupon(res.coupon.code);
    setCode('');
    haptic.success();
  };

  const available = coupons.filter((c) => !usedCoupons.includes(c.code) && c.code !== couponCode);

  return (
    <Card style={styles.block}>
      <Row style={{ gap: 6 }}>
        <Icon name="tag-outline" size={18} color={colors.text} />
        <Txt variant="labelMd">¿Tienes un cupón de descuento?</Txt>
      </Row>
      {couponCode ? (
        <Row style={styles.applied}>
          <Icon
            name={totals.coupon ? 'check-circle-outline' : 'alert-circle-outline'}
            size={20}
            color={totals.coupon ? colors.success : colors.goldText}
          />
          <View style={{ flex: 1 }}>
            <Txt variant="labelLg">{couponCode}</Txt>
            <Txt variant="bodySm" color={totals.coupon ? colors.success : colors.goldText}>
              {totals.coupon
                ? totals.coupon.kind === 'shipping'
                  ? 'Cupón verificado: ¡Delivery gratis en esta compra!'
                  : `Cupón verificado: ¡Ahorras ${money(totals.couponDiscount)} en esta compra!`
                : totals.couponError}
            </Txt>
          </View>
          <Tap onPress={() => setCoupon(undefined)} hitSlop={8} accessibilityLabel="Quitar cupón">
            <Txt variant="labelMd" color={colors.error}>
              Quitar
            </Txt>
          </Tap>
        </Row>
      ) : (
        <>
          <Row>
            <View style={[styles.couponInput, !!error && { borderColor: colors.error }]}>
              <Icon name="ticket-percent-outline" size={20} color={colors.textMuted} />
              <TextInput
                value={code}
                onChangeText={(t) => {
                  setCode(t.toUpperCase());
                  setError(undefined);
                }}
                placeholder="Ingresa código (ej. TAMBOAPP)"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="characters"
                autoCorrect={false}
                onSubmitEditing={() => apply()}
                returnKeyType="done"
                style={styles.couponText}
                accessibilityLabel="Código de cupón"
              />
            </View>
            <Button
              label="Aplicar"
              variant="brand"
              full={false}
              onPress={() => apply()}
              disabled={!code.trim()}
            />
          </Row>
          {error && (
            <Row style={{ gap: 4 }}>
              <Icon name="alert-circle-outline" size={14} color={colors.error} />
              <Txt variant="bodySm" color={colors.error} style={{ flex: 1 }}>
                {error}
              </Txt>
            </Row>
          )}
        </>
      )}
      {available.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.sm }}
        >
          {available.map((c) => (
            <Tap
              key={c.code}
              onPress={() => apply(c.code)}
              style={styles.couponChip}
              accessibilityLabel={`Aplicar cupón ${c.code}`}
            >
              <Icon name="ticket-percent-outline" size={14} color={colors.primary} />
              <Txt variant="labelSm" color={colors.primary}>
                {c.code}
              </Txt>
              <Txt variant="bodySm" color={colors.textMuted}>
                {c.title}
              </Txt>
            </Tap>
          ))}
        </ScrollView>
      )}
    </Card>
  );
}

function Summary() {
  const t = useCartTotals();
  const fulfillment = useSession((s) => s.fulfillment);
  return (
    <Card style={[styles.block, { padding: space.lg }]}>
      <Txt variant="labelLg" weight="bold">
        Resumen de tu pedido
      </Txt>
      <Divider />
      <SummaryRow label="Total productos" value={money(t.regularSubtotal)} />
      {t.productDiscount > 0 && (
        <SummaryRow label="Descuentos" value={`- ${money(t.productDiscount)}`} icon="sale" tone="discount" />
      )}
      {t.couponDiscount > 0 && (
        <SummaryRow
          label={`Cupón ${t.coupon?.code}`}
          value={`- ${money(t.couponDiscount)}`}
          icon="ticket-percent-outline"
          tone="discount"
        />
      )}
      <SummaryRow
        label={fulfillment === 'delivery' ? 'Costo de envío (Delivery)' : 'Retiro en tienda'}
        value={t.shipping === 0 ? 'Gratis' : money(t.shipping)}
        icon={fulfillment === 'delivery' ? 'moped-outline' : 'storefront-outline'}
        tone={t.shipping === 0 ? 'success' : undefined}
      />
      <Divider dashed />
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <Txt variant="headlineMd">Total a pagar</Txt>
          <Txt variant="bodySm" color={colors.textMuted}>
            Incluye I.G.V. y boleta electrónica
          </Txt>
        </View>
        <Txt variant="headlineXl" color={colors.primary}>
          {money(t.total)}
        </Txt>
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  kav: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.sheet + 8,
    borderTopRightRadius: radius.sheet + 8,
    ...elevation.sheet,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.handle,
    marginTop: 10,
  },
  header: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.md },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.lg },
  block: { padding: space.md, gap: space.md },
  upper: { textTransform: 'uppercase' },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceLow,
  },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.goldDark },
  item: { padding: space.md },
  itemTop: { flexDirection: 'row', gap: space.md, paddingBottom: space.sm },
  remove: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm, minHeight: 40 },
  applied: {
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
  },
  couponInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: space.md,
  },
  couponText: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
    outlineStyle: 'none',
  } as object,
  couponChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    backgroundColor: colors.primaryTint,
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: 4,
  },
});
