import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DemoOnly } from '@/components/DemoOnly';
import { DeliveryPointSheet, useDeliveryPoint } from '@/components/delivery';
import { Icon, type IconName } from '@/components/Icon';
import { EmptyState, FulfillmentBadge, RadioCard, ScreenHeader, TextField } from '@/components/layout';
import { SmartMap } from '@/components/map/SmartMap';
import { OtpInput } from '@/components/otp';
import { POINTS_ICON } from '@/components/points';
import { AUTOPILOT_BENEFIT, AUTOPILOT_ICON } from '@/components/routines';
import { Sheet } from '@/components/Sheet';
import { SummaryRow } from '@/components/summary';
import { Badge, Button, Card, Chip, Divider, Row, Tap, Txt } from '@/components/ui';
import { getProduct } from '@/data/products';
import type { Order, PaymentMethodType, PickupMethod, SavedCard } from '@/data/types';
import { money, round2 } from '@/lib/format';
import { haptic } from '@/lib/feedback';
import { addressCoords, deliveryStoreFor } from '@/lib/geo';
import { InsufficientPointsError, placeOrder } from '@/lib/placeOrder';
import { formatPoints, pointsForSoles, pointsValue, pts } from '@/lib/points';
import { checkCoupon } from '@/lib/pricing';
import { buildSlots, HOLD_MINUTES, slotDisplay, type Slot } from '@/lib/slots';
import { useCart, useCartTotals } from '@/store/cart';
import { randomCode, useNow } from '@/store/orders';
import { useSession } from '@/store/session';
import { toast, useUi } from '@/store/ui';
import { useBalance } from '@/store/wallet';
import { colors, elevation, fonts, radius, space } from '@/theme/tokens';

const MAP = require('../../assets/images/map-lima.jpg');

/** Últimos 9 dígitos (celular peruano sin +51). */
const localPhone = (phone: string) => phone.replace(/\D/g, '').slice(-9);
const isYapePhone = (digits: string) => /^9\d{8}$/.test(digits);

const PAYMENT_LABEL: Partial<Record<PaymentMethodType, string>> = {
  yape: 'Yape · Código de aprobación',
  plin: 'Plin · Solicitud de pago',
};

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
  // "Usar mis puntos": descuento libre (100 pts = S/ 1) sobre lo que queda por pagar en productos.
  const balance = useBalance();
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);
  const base = useCartTotals();
  const maxUsable = Math.max(
    0,
    Math.min(balance - base.pointsFromLines, pointsForSoles(base.subtotal - base.couponDiscount)),
  );
  const appliedPoints = usePoints ? Math.min(pointsToUse, maxUsable) : 0;
  const totals = useCartTotals({ pointsToUse: appliedPoints });
  const needsPayment = totals.total > 0;
  const items = useCart((s) => s.items);
  const couponCode = useCart((s) => s.couponCode);
  const setCoupon = useCart((s) => s.setCoupon);
  const point = useDeliveryPoint();
  const session = useSession();

  // Los bloques se recalculan cada minuto (y al cambiar de modalidad).
  const now = useNow(60_000);
  const minute = Math.floor(now / 60_000);
  const slots = useMemo(() => buildSlots(new Date(minute * 60_000), point.fulfillment), [minute, point.fulfillment]);
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
  // Retiro: Smart Locker por defecto si la tienda tiene casilleros libres.
  const lockersFree = point.store.lockers?.free ?? 0;
  const [pickupChoice, setPickupChoice] = useState<PickupMethod>();
  const pickupMethod: PickupMethod = lockersFree > 0 ? (pickupChoice ?? 'locker') : 'counter';
  const [schedule, setSchedule] = useState<'asap' | 'scheduled'>('asap');
  const [slotId, setSlotId] = useState<string>();
  const slot: Slot | undefined = slots.find((s) => s.id === slotId) ?? slots[0];
  const [method, setMethod] = useState<PaymentMethodType>(session.preferredPayment);
  const [cardId, setCardId] = useState<string | 'new'>(session.cards[0]?.id ?? 'new');
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', holder: '' });
  const [cash, setCash] = useState('');
  const [yapePhone, setYapePhone] = useState(() => localPhone(session.profile.phone));
  const [yapeOtp, setYapeOtp] = useState('');
  const [yapeSimulating, setYapeSimulating] = useState(false);
  const [yapeApproved, setYapeApproved] = useState(false);
  const simTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [placing, setPlacing] = useState(false);

  // Si el bloque elegido ya pasó, `slot` cae solo al siguiente disponible; aquí solo se avisa (una vez).
  const notifiedSlot = useRef<string>(undefined);
  useEffect(() => {
    if (schedule !== 'scheduled' || !slotId || slots.some((s) => s.id === slotId)) return;
    if (notifiedSlot.current === slotId) return;
    if (Number(slotId.split('-')[1]) < Date.now()) {
      notifiedSlot.current = slotId;
      toast('Tu horario ya no está disponible: elegimos el siguiente', { icon: 'clock-alert-outline' });
    }
  }, [slots, slotId, schedule]);

  useEffect(() => () => simTimers.current.forEach(clearTimeout), []);

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

  // Con total S/ 0.00 (canje 100% con puntos) no se valida ningún medio de pago.
  const pay = needsPayment ? method : undefined;
  const newCard = pay === 'card' && cardId === 'new';
  const errors = {
    address:
      point.fulfillment === 'delivery' && !point.address ? 'Agrega una dirección de entrega.' : undefined,
    cardNumber: newCard && cardDigits.length < 15 ? 'Número de tarjeta inválido.' : undefined,
    cardExpiry: newCard && !expiryValid ? 'Fecha inválida (MM/AA).' : undefined,
    cardCvv: newCard && !/^\d{3,4}$/.test(card.cvv) ? 'CVV inválido.' : undefined,
    cardHolder: newCard && card.holder.trim().length < 3 ? 'Ingresa el nombre del titular.' : undefined,
    cash:
      pay === 'cash' && cash.trim() !== '' && !(cashAmount >= totals.total)
        ? `El monto debe ser mayor o igual a ${money(totals.total)}.`
        : undefined,
    yapePhone:
      pay === 'yape' && !isYapePhone(yapePhone)
        ? 'Ingresa tu celular Yape (9 dígitos, empieza con 9).'
        : undefined,
    yapeOtp:
      pay === 'yape' && yapeOtp.length < 6 ? 'Ingresa el código de aprobación de 6 dígitos.' : undefined,
    slot: schedule === 'scheduled' && !slot ? 'No hay horarios disponibles, elige "Lo antes posible".' : undefined,
    points:
      totals.pointsToRedeem > balance
        ? `Te faltan ${pts(totals.pointsToRedeem - balance)} para tus canjes.`
        : undefined,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const simulateYape = () => {
    simTimers.current.forEach(clearTimeout);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setYapePhone(isYapePhone(yapePhone) ? yapePhone : '987654321');
    setYapeOtp('');
    setYapeApproved(false);
    setYapeSimulating(true);
    simTimers.current = [...code].map((_, i) =>
      setTimeout(() => {
        setYapeOtp(code.slice(0, i + 1));
        if (i === code.length - 1) {
          setYapeSimulating(false);
          setYapeApproved(true);
          haptic.success();
        }
      }, 120 * (i + 1)),
    );
  };

  const openYape = () =>
    Linking.openURL('yape://').catch(() => toast('Instala Yape para continuar', { tone: 'error' }));

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
    let paymentLabel = PAYMENT_LABEL[method] ?? '';
    if (needsPayment && method === 'card') {
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
    // Simula la autorización de la pasarela (Yape valida el código de aprobación).
    await new Promise((r) => setTimeout(r, 1400));

    const orderSchedule: Order['schedule'] =
      schedule === 'scheduled' && slot
        ? { type: 'scheduled', slot: slotDisplay(slot), start: slot.start, end: slot.end }
        : { type: 'asap' };
    // Guarda el pedido, registra puntos, marca el cupón y vacía el carrito en un solo paso.
    try {
      const order = placeOrder({
        items,
        fulfillment: point.fulfillment,
        storeId: point.store.id,
        address: point.address ? { ...point.address, reference: reference.trim() || undefined } : undefined,
        schedule: orderSchedule,
        payment: {
          method,
          label: paymentLabel,
          cashAmount: method === 'cash' && cashAmount > 0 ? round2(cashAmount) : undefined,
        },
        couponCode,
        pickupMethod,
        pointsToUse: appliedPoints,
      });
      if (needsPayment) session.setPreferredPayment(method);
      haptic.success();
      router.replace(`/pedido/confirmado/${order.id}`);
    } catch (e) {
      setPlacing(false);
      haptic.warning();
      toast(e instanceof InsufficientPointsError ? e.message : 'No pudimos registrar tu pedido', {
        tone: 'error',
      });
    }
  };

  const togglePoints = (on: boolean) => {
    setUsePoints(on);
    if (on) setPointsToUse(maxUsable);
    haptic.tap();
  };

  const delivery = point.fulfillment === 'delivery';
  // El delivery lo despacha la tienda más cercana a la dirección (igual que en placeOrder).
  const servingStore = deliveryStoreFor(point.address);

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
          {/* Dirección o tienda. La modalidad se decide en "¿Cómo quieres tu pedido?" (un solo lugar). */}
          <Card style={styles.block}>
            <Row style={{ justifyContent: 'space-between' }}>
              <FulfillmentBadge value={point.fulfillment} />
              <Tap
                onPress={() => setPointOpen(true)}
                hitSlop={10}
                style={styles.changeMode}
                accessibilityLabel={`Cambiar modalidad o ${delivery ? 'dirección' : 'tienda'}`}
              >
                <Icon name="swap-horizontal" size={16} color={colors.primary} />
                <Txt variant="labelMd" weight="bold" color={colors.primary}>
                  Cambiar modalidad
                </Txt>
              </Tap>
            </Row>
            <BlockTitle
              icon={delivery ? 'map-marker-outline' : 'storefront-outline'}
              title={delivery ? 'Dirección de entrega' : 'Tienda de retiro'}
            />
            {delivery ? (
              point.address ? (
                <>
                  <View style={styles.map}>
                    <SmartMap
                      height={120}
                      interactive={false}
                      markers={[
                        { id: 'home', kind: 'home', position: addressCoords(point.address) },
                        { id: 'store', kind: 'store', position: servingStore.coords },
                      ]}
                      fit={[addressCoords(point.address), servingStore.coords]}
                      fallback={
                        <>
                          <Image source={MAP} style={StyleSheet.absoluteFill} contentFit="cover" />
                          <View style={styles.mapPin}>
                            <Icon name="map-marker" size={40} color={colors.primary} />
                          </View>
                        </>
                      }
                    />
                    <Row style={styles.mapLabel}>
                      <Icon name="storefront-outline" size={14} color={colors.primary} />
                      <Txt variant="labelSm">Te atiende {servingStore.name}</Txt>
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
                <Txt variant="labelMd" color={colors.textMuted}>
                  ¿Cómo quieres retirarlo?
                </Txt>
                <RadioCard
                  selected={pickupMethod === 'locker'}
                  onPress={() => (lockersFree > 0 ? setPickupChoice('locker') : undefined)}
                  title="Tambo Smart Locker"
                  subtitle={
                    lockersFree > 0
                      ? 'Retiro autónomo 24/7 con QR, sin colas • casillero climatizado'
                      : 'Sin casilleros libres en esta tienda ahora'
                  }
                  icon="locker-multiple"
                  badge={
                    <Badge
                      label={lockersFree > 0 ? `${lockersFree} libres` : 'Lleno'}
                      tone={lockersFree > 0 ? 'success' : 'neutral'}
                    />
                  }
                />
                <RadioCard
                  selected={pickupMethod === 'counter'}
                  onPress={() => setPickupChoice('counter')}
                  title="Mostrador express"
                  subtitle="Muestra tu QR en caja y te lo entregan"
                  icon="storefront-outline"
                />
                <Row style={styles.info}>
                  <Icon name="information-outline" size={18} color={colors.primary} />
                  <Txt variant="bodySm" color={colors.textMuted} style={{ flex: 1 }}>
                    {pickupMethod === 'locker'
                      ? 'Cuando esté listo te asignamos un casillero y un QR que cambia cada 30 s. Solo tu QR abre la puerta.'
                      : 'Te avisaremos cuando esté listo. En caja escanean tu QR para entregártelo.'}
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
              subtitle={
                schedule === 'scheduled' && slot
                  ? slotDisplay(slot)
                  : delivery
                    ? 'Elige cuándo te lo llevamos (bloques de 30 min)'
                    : 'Elige cuándo lo recoges (bloques de 20 min)'
              }
              icon="calendar-clock-outline"
            >
              {schedule === 'scheduled' && (
                <View style={styles.slotsBox}>
                  {(['hoy', 'manana'] as const).map((day) => {
                    const daySlots = slots.filter((s) => s.day === day);
                    return (
                      <View key={day} style={{ gap: space.sm }}>
                        <Txt variant="labelSm" color={colors.textMuted} style={styles.slotDay}>
                          {day === 'hoy' ? 'Hoy' : 'Mañana'}
                        </Txt>
                        {daySlots.length === 0 ? (
                          <Txt variant="bodySm" color={colors.textMuted} style={styles.slotDay}>
                            Ya no hay horarios para hoy. Programa tu pedido para mañana.
                          </Txt>
                        ) : (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.slots}
                          >
                            {daySlots.map((s) => (
                              <Chip
                                key={s.id}
                                label={s.label}
                                active={slot?.id === s.id}
                                onPress={() => setSlotId(s.id)}
                              />
                            ))}
                          </ScrollView>
                        )}
                      </View>
                    );
                  })}
                  <Row style={styles.guarantee}>
                    <Icon name="timer-outline" size={18} color={colors.goldText} />
                    <Txt variant="bodySm" color={colors.goldText} style={{ flex: 1 }}>
                      {delivery
                        ? 'Tu pedido llegará dentro del bloque elegido. Te avisaremos cuando salga de la tienda.'
                        : `Estará listo al iniciar tu bloque y lo guardamos hasta ${HOLD_MINUTES} min ${
                            pickupMethod === 'locker' ? 'en tu Smart Locker climatizado' : 'en tienda'
                          }.`}
                    </Txt>
                  </Row>
                  {submitted && errors.slot && (
                    <Txt variant="bodySm" color={colors.error} style={styles.slotDay}>
                      {errors.slot}
                    </Txt>
                  )}
                </View>
              )}
            </RadioCard>
            <Tap
              onPress={() => router.push('/rutinas/nueva?desde=carrito')}
              style={styles.autopilot}
              accessibilityLabel="Repetir este pedido automáticamente con Tambo Auto-Pilot"
            >
              <View style={styles.autopilotIcon}>
                <Icon name={AUTOPILOT_ICON} size={20} color={colors.onGold} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="labelLg">Repetir este pedido (Auto-Pilot)</Txt>
                <Txt variant="bodySm" color={colors.textMuted}>
                  Prográmalo cada día o semana: {AUTOPILOT_BENEFIT}.
                </Txt>
              </View>
              <Icon name="chevron-right" size={22} color={colors.textMuted} />
            </Tap>
          </Card>

          {/* Tambo Lover Puntos */}
          <Card style={[styles.block, styles.pointsCard]}>
            <Row style={{ gap: space.md }}>
              <View style={styles.pointsIcon}>
                <Icon name={POINTS_ICON} size={22} color={colors.onGold} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="labelLg">Usar mis puntos Tambo Lover</Txt>
                <Txt variant="bodySm" color={colors.textMuted}>
                  Tienes {pts(balance - totals.pointsFromLines)} disponibles • 100 pts = S/ 1.00
                </Txt>
              </View>
              <Switch
                value={usePoints}
                onValueChange={togglePoints}
                disabled={maxUsable === 0}
                trackColor={{ true: colors.goldDark, false: colors.surfaceHigh }}
                thumbColor={colors.white}
                accessibilityLabel="Usar mis puntos como descuento"
              />
            </Row>
            {usePoints && maxUsable > 0 && (
              <Animated.View entering={FadeIn} style={{ gap: space.sm }}>
                <Row style={{ flexWrap: 'wrap' }}>
                  {[...new Set([500, 1000, maxUsable].filter((v) => v <= maxUsable))].map((v) => (
                    <Chip
                      key={v}
                      label={v === maxUsable ? `Máximo (${formatPoints(v)})` : formatPoints(v)}
                      active={appliedPoints === v}
                      onPress={() => setPointsToUse(v)}
                    />
                  ))}
                </Row>
                <Txt variant="labelMd" color={colors.goldText}>
                  Usas {pts(totals.pointsUsed)} y descuentas {money(totals.pointsUsedValue)}
                </Txt>
              </Animated.View>
            )}
            {maxUsable === 0 && totals.pointsFromLines === 0 && (
              <Txt variant="bodySm" color={colors.textMuted}>
                Junta puntos con tus compras para usarlos como descuento.
              </Txt>
            )}
            {totals.pointsFromLines > 0 && (
              <Row style={{ gap: 6 }}>
                <Icon name="gift-outline" size={16} color={colors.goldText} />
                <Txt variant="bodySm" color={colors.goldText} style={{ flex: 1 }}>
                  Tus canjes usan {pts(totals.pointsFromLines)} ({money(totals.pointsLinesValue)} en productos).
                </Txt>
              </Row>
            )}
            {submitted && errors.points && (
              <Txt variant="bodySm" color={colors.error}>
                {errors.points}
              </Txt>
            )}
          </Card>

          {/* Pago */}
          <Card style={styles.block}>
            <BlockTitle
              icon="cash-multiple"
              title="Método de pago"
              right={needsPayment ? <Badge label="Sin comisiones" tone="warning" /> : undefined}
            />
            {!needsPayment ? (
              <Row style={styles.freeOrder}>
                <Icon name="gift-outline" size={22} color={colors.success} />
                <Txt variant="bodySm" color={colors.success} style={{ flex: 1 }}>
                  Pagas el 100% con Tambo Lover Puntos. No necesitas ningún medio de pago.
                </Txt>
              </Row>
            ) : (
              <>
            <RadioCard
              selected={method === 'yape'}
              onPress={() => setMethod('yape')}
              title="Yape"
              subtitle="Paga con tu código de aprobación"
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
                <View style={[styles.methodBody, { flexDirection: 'column', alignItems: 'stretch' }]}>
                  <TextField
                    label="Celular Yape"
                    icon="cellphone"
                    prefix="+51"
                    placeholder="987 654 321"
                    keyboardType="number-pad"
                    maxLength={9}
                    value={yapePhone}
                    onChangeText={(t) => {
                      setYapePhone(t.replace(/\D/g, ''));
                      setYapeApproved(false);
                    }}
                    error={submitted ? errors.yapePhone : undefined}
                  />
                  <Txt variant="labelMd" color={colors.textMuted}>
                    Código de aprobación
                  </Txt>
                  <OtpInput
                    value={yapeOtp}
                    onChange={(c) => {
                      setYapeOtp(c);
                      setYapeApproved(false);
                    }}
                    error={submitted && !!errors.yapeOtp}
                  />
                  {submitted && errors.yapeOtp ? (
                    <Txt variant="bodySm" color={colors.error}>
                      {errors.yapeOtp}
                    </Txt>
                  ) : (
                    <Row style={{ alignItems: 'flex-start', gap: 6 }}>
                      <Icon name="information-outline" size={16} color={colors.primary} />
                      <Txt variant="bodySm" color={colors.textMuted} style={{ flex: 1 }}>
                        Lo encuentras en tu app Yape → menú → Código de aprobación. Vence en 2 minutos.
                      </Txt>
                    </Row>
                  )}
                  {yapeApproved && (
                    <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.yapeOk}>
                      <Icon name="check-decagram" size={20} color={colors.success} />
                      <Txt variant="labelMd" color={colors.success}>
                        Yape aprobado • {money(totals.total)}
                      </Txt>
                    </Animated.View>
                  )}
                  <Tap onPress={openYape} style={styles.linkRow} accessibilityLabel="Abrir la app Yape">
                    <Icon name="open-in-app" size={18} color={colors.primary} />
                    <Txt variant="labelMd" color={colors.primary} style={{ textDecorationLine: 'underline' }}>
                      Abrir Yape para ver mi código
                    </Txt>
                  </Tap>
                  <DemoOnly>
                    <Button
                      label={yapeSimulating ? 'Generando código…' : 'Simular código Yape'}
                      icon="lightning-bolt"
                      variant="outline"
                      size="sm"
                      disabled={yapeSimulating}
                      onPress={simulateYape}
                    />
                  </DemoOnly>
                </View>
              )}
            </RadioCard>
            <RadioCard
              selected={method === 'plin'}
              onPress={() => setMethod('plin')}
              title="Plin"
              subtitle="Te enviamos una solicitud de pago"
              icon="cellphone-message"
            >
              {method === 'plin' && (
                <Animated.View entering={FadeIn}>
                  <Row style={styles.methodBody}>
                    <Icon name="bell-ring-outline" size={18} color={colors.primary} />
                    <Txt variant="bodySm" color={colors.textMuted} style={{ flex: 1 }}>
                      Al confirmar te llegará una solicitud de pago a tu app Plin ({session.profile.phone}).
                    </Txt>
                  </Row>
                </Animated.View>
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
              </>
            )}
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
            {totals.pointsDiscount > 0 && (
              <SummaryRow
                label={`Tambo Lover Puntos (${pts(totals.pointsToRedeem)})`}
                value={`- ${money(totals.pointsDiscount)}`}
                tone="discount"
                icon={POINTS_ICON}
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
            <Row style={{ gap: 6 }}>
              <Icon name={POINTS_ICON} size={16} color={colors.goldText} />
              <Txt variant="bodySm" color={colors.goldText}>
                Sumarás {pts(totals.pointsEarned)} Tambo Lover con esta compra
                {totals.pointsEarned > 0 ? ` (≈ ${money(pointsValue(totals.pointsEarned))})` : ''}
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
            ? !needsPayment
              ? 'Canjeando tus puntos…'
              : method === 'yape'
              ? 'Validando código con Yape…'
              : method === 'plin'
                ? 'Esperando aprobación de Plin…'
                : 'Procesando tu pedido…'
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
  changeMode: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  pointsCard: { borderColor: colors.goldBorder, backgroundColor: colors.goldTint },
  autopilot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  autopilotIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freeOrder: { padding: space.md, gap: space.sm, borderRadius: radius.lg, backgroundColor: colors.successSoft },
  slotsBox: { gap: space.md, paddingBottom: space.md },
  slotDay: { paddingHorizontal: space.md, textTransform: 'uppercase' },
  slots: { gap: space.sm, paddingHorizontal: space.md },
  guarantee: {
    alignItems: 'flex-start',
    gap: 6,
    marginHorizontal: space.md,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.goldSoft,
  },
  yapeOk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.successSoft,
  },
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
