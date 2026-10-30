import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeliveryPointSheet, useDeliveryPoint } from '@/components/delivery';
import { Icon, type IconName } from '@/components/Icon';
import { EmptyState, FulfillmentToggle, RadioCard, ScreenHeader, TextField } from '@/components/layout';
import { Sheet } from '@/components/Sheet';
import { SummaryRow } from '@/components/summary';
import { Badge, Button, Card, Chip, Divider, Row, Tap, Txt } from '@/components/ui';
import { getProduct } from '@/data/products';
import { toOrderItems } from '@/data/seedOrders';
import type { Order, PaymentMethodType, SavedCard } from '@/data/types';
import { money, round2 } from '@/lib/format';
import { haptic } from '@/lib/feedback';
import { checkCoupon } from '@/lib/pricing';
import { useCart, useCartTotals } from '@/store/cart';
import { newOrderId, randomCode, timestamp, useOrders } from '@/store/orders';
import { useSession } from '@/store/session';
import { toast, useUi } from '@/store/ui';
import { colors, elevation, fonts, radius, space } from '@/theme/tokens';

const MAP = require('../../assets/images/map-lima.jpg');

function buildSlots() {
  const now = new Date();
  const fmt = (h: number) => {
    const hh = h % 12 || 12;
    return `${String(hh).padStart(2, '0')}:00 ${h < 12 || h === 24 ? 'AM' : 'PM'}`;
  };
  const slots: string[] = [];
  for (let h = now.getHours() + 1; h < 23 && slots.length < 4; h++)
    slots.push(`Hoy: ${fmt(h)} - ${fmt(h + 1)}`);
  for (const h of [9, 11, 13, 18, 20]) slots.push(`Mañana: ${fmt(h)} - ${fmt(h + 1)}`);
  return slots;
}

const cardBrand = (n: string): SavedCard['brand'] =>
  n.startsWith('4')
    ? 'Visa'
    : n.startsWith('5')
      ? 'Mastercard'
      : n.startsWith('34') || n.startsWith('37')
        ? 'Amex'
        : 'Diners';

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const totals = useCartTotals();
  const items = useCart((s) => s.items);
  const couponCode = useCart((s) => s.couponCode);
  const setCoupon = useCart((s) => s.setCoupon);
  const clearCart = useCart((s) => s.clear);
  const place = useOrders((s) => s.place);
  const point = useDeliveryPoint();
  const session = useSession();

  const slots = useMemo(() => buildSlots(), []);
  const [pointOpen, setPointOpen] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  // Referencia editable por dirección (si cambia la dirección se usa la guardada en ella).
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [refOpen, setRefOpen] = useState<Record<string, boolean>>({});
  const addressKey = point.address?.id ?? '';
  const reference = refs[addressKey] ?? point.address?.reference ?? '';
  const setReference = (t: string) => setRefs((r) => ({ ...r, [addressKey]: t }));
  const showReference = refOpen[addressKey] || !!point.address?.reference;
  const setShowReference = (v: boolean) => setRefOpen((r) => ({ ...r, [addressKey]: v }));
  const [schedule, setSchedule] = useState<'asap' | 'scheduled'>('asap');
  const [slot, setSlot] = useState(slots[0]);
  const [method, setMethod] = useState<PaymentMethodType>(session.preferredPayment);
  const [cardId, setCardId] = useState<string | 'new'>(session.cards[0]?.id ?? 'new');
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', holder: '' });
  const [cash, setCash] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [placing, setPlacing] = useState(false);

  if (items.length === 0 && !placing) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Finalizar compra" />
        <EmptyState
          icon="cart-outline"
          title="Tu carrito está vacío"
          message="Agrega productos para continuar con la compra."
          action="Ir al inicio"
          onAction={() => router.replace('/')}
        />
      </View>
    );
  }

  const cashAmount = Number(cash.replace(',', '.'));
  const cardDigits = card.number.replace(/\D/g, '');
  const [mm, yy] = card.expiry.split('/').map(Number);
  const today = new Date();
  const curYY = today.getFullYear() % 100;
  const expiryValid = mm >= 1 && mm <= 12 && (yy > curYY || (yy === curYY && mm >= today.getMonth() + 1));

  const errors = {
    address:
      point.fulfillment === 'delivery' && !point.address ? 'Agrega una dirección de entrega.' : undefined,
    cardNumber:
      method === 'card' && cardId === 'new' && cardDigits.length < 15
        ? 'Número de tarjeta inválido.'
        : undefined,
    cardExpiry: method === 'card' && cardId === 'new' && !expiryValid ? 'Fecha inválida (MM/AA).' : undefined,
    cardCvv:
      method === 'card' && cardId === 'new' && !/^\d{3,4}$/.test(card.cvv) ? 'CVV inválido.' : undefined,
    cardHolder:
      method === 'card' && cardId === 'new' && card.holder.trim().length < 3
        ? 'Ingresa el nombre del titular.'
        : undefined,
    cash:
      method === 'cash' && cash.trim() !== '' && !(cashAmount >= totals.total)
        ? `El monto debe ser mayor o igual a ${money(totals.total)}.`
        : undefined,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const confirm = async () => {
    setSubmitted(true);
    if (hasErrors) {
      haptic.warning();
      toast('Revisa los datos marcados en rojo', { tone: 'error' });
      if (errors.address) setPointOpen(true);
      return;
    }
    const hasAlcohol = items.some((i) => getProduct(i.productId)?.alcoholic);
    if (hasAlcohol && !useSession.getState().ageVerified) {
      useUi.getState().openAgeGate(confirm);
      return;
    }
    setPlacing(true);
    let paymentLabel = 'Yape (QR Aprobado)';
    if (method === 'card') {
      let used = session.cards.find((c) => c.id === cardId);
      if (!used) {
        used = {
          id: randomCode('card', 6),
          brand: cardBrand(cardDigits),
          last4: cardDigits.slice(-4),
          holder: card.holder.trim().toUpperCase(),
          expiry: card.expiry,
        };
        session.addCard(used);
      }
      paymentLabel = `Tarjeta ${used.brand} •••• ${used.last4}`;
    }
    if (method === 'cash') {
      paymentLabel = point.fulfillment === 'delivery' ? 'Efectivo contra entrega' : 'Pago en caja';
    }
    await new Promise((r) => setTimeout(r, 1400));

    const order: Order = {
      id: newOrderId(),
      createdAt: timestamp(),
      items: toOrderItems(items),
      fulfillment: point.fulfillment,
      storeId: point.store.id,
      address:
        point.fulfillment === 'delivery' && point.address
          ? { ...point.address, reference: reference.trim() || undefined }
          : undefined,
      schedule: schedule === 'asap' ? { type: 'asap' } : { type: 'scheduled', slot },
      payment: {
        method,
        label: paymentLabel,
        cashAmount: method === 'cash' && cashAmount > 0 ? round2(cashAmount) : undefined,
      },
      couponCode: totals.coupon?.code,
      totals: {
        regularSubtotal: totals.regularSubtotal,
        productDiscount: totals.productDiscount,
        couponDiscount: totals.couponDiscount,
        shipping: totals.shipping,
        total: totals.total,
      },
    };
    place(order);
    session.addPoints(Math.floor(totals.total));
    session.setPreferredPayment(method);
    if (totals.coupon) session.markCouponUsed(totals.coupon.code);
    haptic.success();
    router.replace(`/pedido/confirmado/${order.id}`);
    clearCart();
  };

  const delivery = point.fulfillment === 'delivery';

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="Finalizar compra"
        right={
          <Row style={styles.secure}>
            <Icon name="shield-check-outline" size={16} color={colors.white} />
            <Txt variant="labelSm" color={colors.white}>
              SEGURA
            </Txt>
          </Row>
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <FulfillmentToggle value={point.fulfillment} onChange={session.setFulfillment} tone="light" />

          {/* Dirección o tienda */}
          <Card style={styles.block}>
            <BlockTitle
              icon={delivery ? 'map-marker-outline' : 'storefront-outline'}
              title={delivery ? 'Dirección de entrega' : 'Tienda de retiro'}
              action="Cambiar"
              onAction={() => setPointOpen(true)}
            />
            {delivery ? (
              point.address ? (
                <>
                  <View style={styles.map}>
                    <Image source={MAP} style={StyleSheet.absoluteFill} contentFit="cover" />
                    <View style={styles.mapPin}>
                      <Icon name="map-marker" size={40} color={colors.primary} />
                    </View>
                    <Row style={styles.mapLabel}>
                      <Icon name="crosshairs-gps" size={14} color={colors.primary} />
                      <Txt variant="labelSm">{point.address.district}</Txt>
                    </Row>
                  </View>
                  <View>
                    <Txt variant="labelLg" weight="bold">
                      {point.address.line1}
                    </Txt>
                    <Txt variant="bodySm" color={colors.textMuted}>
                      {point.address.district}
                    </Txt>
                  </View>
                  {showReference ? (
                    <TextField
                      label="Referencia para el repartidor"
                      icon="note-text-outline"
                      placeholder="Ej. frente al parque, timbre 502"
                      value={reference}
                      onChangeText={setReference}
                    />
                  ) : (
                    <Tap
                      onPress={() => setShowReference(true)}
                      style={styles.linkRow}
                      accessibilityLabel="Agregar referencia"
                    >
                      <Icon name="plus-circle-outline" size={20} color={colors.primary} />
                      <Txt
                        variant="labelMd"
                        color={colors.primary}
                        style={{ textDecorationLine: 'underline' }}
                      >
                        Agregar referencia (ej. frente al parque, timbre 502)
                      </Txt>
                    </Tap>
                  )}
                </>
              ) : (
                <Button
                  label="Agregar dirección"
                  icon="plus"
                  variant="outline"
                  onPress={() => setPointOpen(true)}
                />
              )
            ) : (
              <>
                <Row style={{ alignItems: 'flex-start', gap: space.md }}>
                  <View style={styles.storeIcon}>
                    <Icon name="storefront" size={24} color={colors.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="labelLg" weight="bold">
                      {point.store.name} - {point.store.district}
                    </Txt>
                    <Txt variant="bodySm" color={colors.textMuted}>
                      {point.store.address} • {point.store.distanceKm} km
                    </Txt>
                    <Badge
                      label={`Listo en ${point.store.eta}`}
                      tone="success"
                      style={{ marginTop: 6 }}
                      icon="clock-outline"
                    />
                  </View>
                </Row>
                <Row style={styles.info}>
                  <Icon name="information-outline" size={18} color={colors.primary} />
                  <Txt variant="bodySm" color={colors.textMuted} style={{ flex: 1 }}>
                    Muestra tu código de pedido en caja. Te avisaremos cuando esté listo para recoger.
                  </Txt>
                </Row>
              </>
            )}
            {submitted && errors.address && (
              <Txt variant="bodySm" color={colors.error}>
                {errors.address}
              </Txt>
            )}
          </Card>

          {/* Horario */}
          <Card style={styles.block}>
            <BlockTitle icon="clock-outline" title={delivery ? 'Horario de entrega' : 'Horario de recojo'} />
            <RadioCard
              selected={schedule === 'asap'}
              onPress={() => setSchedule('asap')}
              title="Lo antes posible"
              subtitle={delivery ? 'Llega en 25 - 35 min aprox.' : `Listo en ${point.store.eta}`}
              icon="lightning-bolt"
            />
            <RadioCard
              selected={schedule === 'scheduled'}
              onPress={() => setSchedule('scheduled')}
              title="Programar horario"
              subtitle={schedule === 'scheduled' ? slot : 'Elige el momento de entrega'}
              icon="calendar-clock-outline"
            >
              {schedule === 'scheduled' && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.slots}
                >
                  {slots.map((s) => (
                    <Chip key={s} label={s} active={slot === s} onPress={() => setSlot(s)} />
                  ))}
                </ScrollView>
              )}
            </RadioCard>
          </Card>

          {/* Pago */}
          <Card style={styles.block}>
            <BlockTitle
              icon="cash-multiple"
              title="Método de pago"
              right={<Badge label="Sin comisiones" tone="warning" />}
            />
            <RadioCard
              selected={method === 'yape'}
              onPress={() => setMethod('yape')}
              title="Yape / Plin"
              subtitle="Paga rápido con QR o número móvil"
              badge={<Badge label="Recomendado" tone="combo" />}
              iconNode={
                <View style={styles.yape}>
                  <Txt variant="headlineMd" color={colors.gold}>
                    Y
                  </Txt>
                </View>
              }
            >
              {method === 'yape' && (
                <Row style={styles.methodBody}>
                  <Icon name="cellphone-message" size={18} color={colors.primary} />
                  <Txt variant="bodySm" color={colors.textMuted} style={{ flex: 1 }}>
                    Al confirmar te llegará una solicitud de pago a tu app Yape ({session.profile.phone}).
                  </Txt>
                </Row>
              )}
            </RadioCard>
            <RadioCard
              selected={method === 'card'}
              onPress={() => setMethod('card')}
              title="Tarjeta Crédito / Débito"
              subtitle="Visa, Mastercard, Diners, Amex"
              icon="credit-card-outline"
            >
              {method === 'card' && (
                <View style={[styles.methodBody, { flexDirection: 'column', alignItems: 'stretch' }]}>
                  {session.cards.map((c) => (
                    <Tap
                      key={c.id}
                      onPress={() => setCardId(c.id)}
                      style={[styles.savedCard, cardId === c.id && styles.savedCardActive]}
                      accessibilityLabel={`${c.brand} terminada en ${c.last4}`}
                    >
                      <Icon name="credit-card" size={20} color={colors.primary} />
                      <Txt variant="labelMd" style={{ flex: 1 }}>
                        {c.brand} •••• {c.last4}
                      </Txt>
                      <Txt variant="bodySm" color={colors.textMuted}>
                        {c.expiry}
                      </Txt>
                      <Icon
                        name={cardId === c.id ? 'radiobox-marked' : 'radiobox-blank'}
                        size={20}
                        color={colors.primary}
                      />
                    </Tap>
                  ))}
                  <Tap
                    onPress={() => setCardId('new')}
                    style={[styles.savedCard, cardId === 'new' && styles.savedCardActive]}
                    accessibilityLabel="Usar una nueva tarjeta"
                  >
                    <Icon name="plus" size={20} color={colors.primary} />
                    <Txt variant="labelMd" style={{ flex: 1 }}>
                      Nueva tarjeta
                    </Txt>
                    <Icon
                      name={cardId === 'new' ? 'radiobox-marked' : 'radiobox-blank'}
                      size={20}
                      color={colors.primary}
                    />
                  </Tap>
                  {cardId === 'new' && (
                    <View style={{ gap: space.sm }}>
                      <TextField
                        placeholder="Número de tarjeta"
                        icon="credit-card-outline"
                        keyboardType="number-pad"
                        maxLength={19}
                        value={card.number}
                        onChangeText={(t) =>
                          setCard((c) => ({
                            ...c,
                            number: t.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 '),
                          }))
                        }
                        error={submitted ? errors.cardNumber : undefined}
                      />
                      <Row style={{ alignItems: 'flex-start' }}>
                        <TextField
                          placeholder="MM/AA"
                          keyboardType="number-pad"
                          maxLength={5}
                          value={card.expiry}
                          onChangeText={(t) => {
                            const d = t.replace(/\D/g, '');
                            setCard((c) => ({
                              ...c,
                              expiry: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2, 4)}` : d,
                            }));
                          }}
                          error={submitted ? errors.cardExpiry : undefined}
                          style={{ flex: 1 }}
                        />
                        <TextField
                          placeholder="CVV"
                          keyboardType="number-pad"
                          maxLength={4}
                          secureTextEntry
                          value={card.cvv}
                          onChangeText={(t) => setCard((c) => ({ ...c, cvv: t.replace(/\D/g, '') }))}
                          error={submitted ? errors.cardCvv : undefined}
                          style={{ flex: 1 }}
                        />
                      </Row>
                      <TextField
                        placeholder="Nombre del titular"
                        icon="account-outline"
                        autoCapitalize="characters"
                        value={card.holder}
                        onChangeText={(t) => setCard((c) => ({ ...c, holder: t }))}
                        error={submitted ? errors.cardHolder : undefined}
                      />
                      <Row style={{ gap: 4 }}>
                        <Icon name="lock-outline" size={14} color={colors.success} />
                        <Txt variant="bodySm" color={colors.textMuted}>
                          Pago cifrado. La tarjeta se guardará para tus próximas compras.
                        </Txt>
                      </Row>
                    </View>
                  )}
                </View>
              )}
            </RadioCard>
            <RadioCard
              selected={method === 'cash'}
              onPress={() => setMethod('cash')}
              title={delivery ? 'Efectivo contra entrega' : 'Efectivo en caja'}
              subtitle={delivery ? 'Paga al recibir tu pedido' : 'Paga al recoger tu pedido'}
              icon="cash"
            >
              {method === 'cash' && delivery && (
                <View style={[styles.methodBody, { flexDirection: 'column', alignItems: 'stretch' }]}>
                  <Txt variant="labelMd" color={colors.textMuted}>
                    ¿Con cuánto vas a pagar? (para tu vuelto)
                  </Txt>
                  <TextField
                    prefix="S/"
                    placeholder={Math.ceil(totals.total / 10) * 10 + ''}
                    keyboardType="decimal-pad"
                    value={cash}
                    onChangeText={setCash}
                    error={errors.cash}
                  />
                  <Row style={{ flexWrap: 'wrap' }}>
                    {[totals.total, Math.ceil(totals.total / 10) * 10, 50, 100]
                      .filter((v, i, a) => v >= totals.total && a.indexOf(v) === i)
                      .map((v) => (
                        <Chip
                          key={v}
                          label={v === totals.total ? 'Monto exacto' : money(v)}
                          active={cashAmount === v}
                          onPress={() => setCash(v.toFixed(2))}
                        />
                      ))}
                  </Row>
                  {cashAmount > totals.total && (
                    <Txt variant="labelMd" color={colors.success}>
                      Tu vuelto: {money(round2(cashAmount - totals.total))}
                    </Txt>
                  )}
                </View>
              )}
            </RadioCard>
          </Card>

          {/* Resumen */}
          <Card style={[styles.block, { padding: space.lg }]}>
            <Txt variant="labelLg" weight="bold">
              Resumen de la orden
            </Txt>
            <Divider />
            <SummaryRow
              label={`Subtotal (${totals.itemCount} ${totals.itemCount === 1 ? 'producto' : 'productos'})`}
              value={money(totals.regularSubtotal)}
            />
            {totals.productDiscount > 0 && (
              <SummaryRow
                label="Descuentos"
                value={`- ${money(totals.productDiscount)}`}
                tone="discount"
                icon="sale"
              />
            )}
            {totals.couponDiscount > 0 && (
              <SummaryRow
                label={`Cupón ${totals.coupon?.code}`}
                value={`- ${money(totals.couponDiscount)}`}
                tone="discount"
                icon="ticket-percent-outline"
              />
            )}
            <SummaryRow
              label={delivery ? 'Costo de envío' : 'Retiro en tienda'}
              value={totals.shipping === 0 ? 'Gratis' : money(totals.shipping)}
              tone={totals.shipping === 0 ? 'success' : undefined}
            />
            <Divider dashed />
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Txt variant="headlineMd">Total a pagar</Txt>
                <Txt variant="bodySm" color={colors.textMuted}>
                  Incluye impuestos de ley (IGV)
                </Txt>
              </View>
              <Txt variant="headlineLg" weight="extrabold" color={colors.primary}>
                {money(totals.total)}
              </Txt>
            </Row>
          </Card>

          <Tap onPress={() => setCouponOpen(true)} style={styles.coupon} accessibilityLabel="Ingresar cupón">
            <Icon name="tag-outline" size={22} color={colors.primary} />
            <Txt variant="labelMd" style={{ flex: 1 }}>
              {couponCode
                ? `Cupón ${couponCode} ${totals.coupon ? 'aplicado' : '(no válido)'}`
                : '¿Tienes un cupón de descuento?'}
            </Txt>
            <Txt variant="labelMd" color={colors.primary}>
              {couponCode ? 'Cambiar' : 'Ingresar'}
            </Txt>
          </Tap>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <Button
          label="CONFIRMAR PEDIDO"
          trailing={`${money(totals.total)}`}
          iconRight="arrow-right"
          size="lg"
          loading={placing}
          onPress={confirm}
        />
        <Txt variant="bodySm" align="center" color={colors.textMuted} style={{ marginTop: 6, fontSize: 11 }}>
          {placing
            ? method === 'yape'
              ? 'Esperando aprobación de Yape...'
              : 'Procesando tu pedido...'
            : 'Al pulsar confirmas los términos y condiciones de entrega Tambo'}
        </Txt>
      </View>

      <DeliveryPointSheet visible={pointOpen} onClose={() => setPointOpen(false)} />
      <CouponSheet
        visible={couponOpen}
        onClose={() => setCouponOpen(false)}
        subtotal={totals.subtotal}
        current={couponCode}
        onApply={(c) => {
          setCoupon(c);
          setCouponOpen(false);
          toast(c ? `Cupón ${c} aplicado` : 'Cupón quitado', {
            tone: 'success',
            icon: 'ticket-percent-outline',
          });
        }}
        used={session.usedCoupons}
      />
    </View>
  );
}

function BlockTitle({
  icon,
  title,
  action,
  onAction,
  right,
}: {
  icon: IconName;
  title: string;
  action?: string;
  onAction?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Row>
        <Icon name={icon} size={22} color={colors.primary} />
        <Txt variant="headlineMd" style={{ fontSize: 17 }}>
          {title}
        </Txt>
      </Row>
      {right}
      {action && (
        <Tap onPress={onAction} hitSlop={10} accessibilityLabel={action}>
          <Txt variant="labelMd" weight="bold" color={colors.primary}>
            {action}
          </Txt>
        </Tap>
      )}
    </Row>
  );
}

function CouponSheet({
  visible,
  onClose,
  subtotal,
  current,
  onApply,
  used,
}: {
  visible: boolean;
  onClose: () => void;
  subtotal: number;
  current?: string;
  onApply: (code?: string) => void;
  used: string[];
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const apply = () => {
    const c = code.trim().toUpperCase();
    if (used.includes(c)) return setError('Ya usaste este cupón en una compra anterior.');
    const res = checkCoupon(c, subtotal);
    if (!res.ok) return setError(res.error);
    setCode('');
    setError(undefined);
    onApply(res.coupon.code);
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Cupón de descuento"
      subtitle="Prueba TAMBOAPP, TAMBOYA10 o ENVIOGRATIS"
    >
      <View style={{ gap: space.md }}>
        <View style={[styles.couponInput, !!error && { borderColor: colors.error }]}>
          <Icon name="ticket-percent-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={code}
            onChangeText={(t) => {
              setCode(t.toUpperCase());
              setError(undefined);
            }}
            placeholder="Ingresa tu código"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.couponText}
            onSubmitEditing={apply}
            accessibilityLabel="Código de cupón"
          />
        </View>
        {error && (
          <Txt variant="bodySm" color={colors.error}>
            {error}
          </Txt>
        )}
        <Button label="Aplicar cupón" variant="brand" onPress={apply} disabled={!code.trim()} />
        {current && (
          <Button label={`Quitar ${current}`} variant="danger" onPress={() => onApply(undefined)} />
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.lg, paddingBottom: 140 },
  secure: {
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    marginRight: space.sm,
  },
  block: { padding: space.md, gap: space.md },
  map: { height: 120, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceMid },
  mapPin: { position: 'absolute', left: '50%', top: '50%', marginLeft: -20, marginTop: -36 },
  mapLabel: {
    position: 'absolute',
    left: space.sm,
    bottom: space.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    gap: 4,
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 40 },
  storeIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    backgroundColor: colors.primaryTint,
    padding: space.md,
    borderRadius: radius.lg,
    alignItems: 'flex-start',
  },
  slots: { gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.md },
  yape: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodBody: {
    backgroundColor: colors.surfaceLow,
    padding: space.md,
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  savedCardActive: { borderColor: colors.primary },
  coupon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceLow,
  },
  couponInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 50,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
  },
  couponText: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
    outlineStyle: 'none',
  } as object,
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...elevation.nav,
  },
});
