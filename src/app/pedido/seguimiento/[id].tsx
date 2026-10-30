import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { EmptyState, ScreenHeader } from '@/components/layout';
import { Sheet } from '@/components/Sheet';
import { SummaryRow } from '@/components/summary';
import { StepProgress, TrackingMap } from '@/components/tracking';
import { Badge, Button, Card, Divider, IconButton, Row, Tap, Txt } from '@/components/ui';
import { getProduct } from '@/data/products';
import { getStore, rider } from '@/data/stores';
import { money } from '@/lib/format';
import { haptic } from '@/lib/feedback';
import { getOrderStatus } from '@/lib/orderProgress';
import { ProductImage } from '@/components/product';
import { useNow, useOrder, useOrders } from '@/store/orders';
import { useCart } from '@/store/cart';
import { toast } from '@/store/ui';
import { colors, fonts, radius, space } from '@/theme/tokens';

export default function TrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrder(id);
  const insets = useSafeAreaInsets();
  const cancel = useOrders((s) => s.cancel);
  const complete = useOrders((s) => s.complete);
  const rate = useOrders((s) => s.rate);
  const replaceCart = useCart((s) => s.replace);
  const [detailOpen, setDetailOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const finished = !order || !!order.seeded || !!order.cancelledAt || !!order.completedAt;
  const now = useNow(1000, !finished);

  // Aviso háptico cuando cambia el paso.
  const live = order ? getOrderStatus(order, now) : undefined;
  const lastStep = useRef(live?.step);
  useEffect(() => {
    if (live && lastStep.current !== undefined && live.step !== lastStep.current) {
      haptic.success();
      toast(live.phase === 'completed' ? live.headline : live.steps[live.step].title, {
        icon: 'bell-ring-outline',
      });
    }
    lastStep.current = live?.step;
  }, [live?.step, live?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!order || !live) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Seguimiento" />
        <EmptyState
          icon="map-marker-question-outline"
          title="Pedido no encontrado"
          message="Revisa tus pedidos en la pestaña Órdenes."
          action="Ver mis pedidos"
          onAction={() => router.dismissTo('/ordenes')}
        />
      </View>
    );
  }

  const store = getStore(order.storeId);
  const delivery = order.fulfillment === 'delivery';
  const showRider = delivery && live.phase === 'active' && live.step >= 2;
  const completed = live.phase === 'completed';
  const cancelled = live.phase === 'cancelled';

  const shareTracking = async () => {
    try {
      await Share.share({
        message: `Sigue mi pedido Tambo ${order.id}: ${live.headline}${live.etaMin ? `, llega en ~${live.etaMin} min` : ''}. 🛵`,
      });
    } catch {
      toast('No se pudo compartir', { tone: 'error' });
    }
  };

  const call = () =>
    Linking.openURL(`tel:${rider.phone}`).catch(() =>
      toast(`Llama a ${rider.name}: ${rider.phone}`, { icon: 'phone' }),
    );

  const reorder = () => {
    replaceCart(
      order.items.filter((i) => getProduct(i.productId)).map((i) => ({ productId: i.productId, qty: i.qty })),
    );
    router.push('/carrito');
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        kicker="Estado de orden"
        title={`Seguimiento de Pedido #${order.id}`}
        onBack={() => (router.canGoBack() ? router.back() : router.dismissTo('/ordenes'))}
        right={
          <Tap
            onPress={() => router.push('/perfil/ayuda')}
            style={styles.support}
            accessibilityLabel="Soporte"
          >
            <Icon name="face-agent" size={18} color={colors.white} />
            <Txt variant="labelMd" color={colors.white}>
              Soporte
            </Txt>
          </Tap>
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <TrackingMap
            progress={completed ? 1 : live.route}
            showRider={showRider}
            storeLabel={store.name}
            pickup={!delivery}
            riderLabel={`${rider.name.split(' ')[0]} en moto`}
          />
          {live.phase === 'active' && (
            <Row style={styles.gps}>
              <View style={styles.gpsDot} />
              <Txt variant="labelSm">
                {showRider ? 'GPS activo en vivo' : delivery ? 'Preparando en tienda' : 'Retiro en tienda'}
              </Txt>
            </Row>
          )}
        </View>

        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Estado actual */}
          <View
            style={[
              styles.statusCard,
              cancelled && { backgroundColor: colors.errorSoft },
              completed && { backgroundColor: colors.successSoft },
            ]}
          >
            <View style={styles.statusIcon}>
              <Icon
                name={
                  cancelled
                    ? 'close-circle-outline'
                    : completed
                      ? 'check-decagram'
                      : delivery
                        ? 'moped-outline'
                        : 'storefront-outline'
                }
                size={28}
                color={cancelled ? colors.error : completed ? colors.success : colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Row style={{ gap: 6 }}>
                <Txt variant="labelSm" color={colors.primary} style={{ textTransform: 'uppercase' }}>
                  Estado actual
                </Txt>
                {live.phase === 'active' && <View style={styles.liveDot} />}
              </Row>
              <Txt variant="headlineMd">{live.headline}</Txt>
              <Txt variant="bodySm" color={colors.textMuted}>
                {live.detail}
              </Txt>
            </View>
            {live.phase === 'active' && live.etaMin > 0 && (
              <View style={styles.eta}>
                <Txt variant="labelSm" color={colors.onGold}>
                  TIEMPO
                </Txt>
                <Txt variant="headlineXl" color={colors.onGold} style={{ lineHeight: 32 }}>
                  {live.etaMin}
                </Txt>
                <Txt variant="labelSm" color={colors.onGold}>
                  MIN
                </Txt>
              </View>
            )}
          </View>

          {!cancelled && (
            <Card style={{ padding: space.lg, gap: space.lg }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="labelLg">Progreso del pedido</Txt>
                <Txt variant="labelMd" color={colors.textMuted}>
                  Paso {live.step + 1} de {live.steps.length}
                </Txt>
              </Row>
              <StepProgress status={live} />
            </Card>
          )}

          {/* Acción para retiro en tienda */}
          {!delivery && live.phase === 'active' && live.step === 2 && (
            <Animated.View entering={FadeInDown}>
              <Card style={{ padding: space.lg, gap: space.md, alignItems: 'center' }}>
                <Txt variant="bodyMd" color={colors.textMuted}>
                  Muestra este código en caja
                </Txt>
                <Txt variant="headlineXl" color={colors.primary} style={{ letterSpacing: 4 }}>
                  {order.id}
                </Txt>
                <Button
                  label="Ya recogí mi pedido"
                  variant="brand"
                  icon="check"
                  onPress={() => complete(order.id)}
                />
              </Card>
            </Animated.View>
          )}

          {/* Repartidor */}
          {delivery && !cancelled && (
            <Card style={styles.rider}>
              <View>
                <Image
                  source={rider.photo}
                  style={styles.riderPhoto}
                  contentFit="cover"
                  accessibilityLabel={rider.name}
                />
                <View style={styles.online} />
              </View>
              <View style={{ flex: 1 }}>
                <Row style={{ gap: 4 }}>
                  <Txt variant="labelLg" weight="bold">
                    {rider.name}
                  </Txt>
                  <Icon name="check-decagram-outline" size={16} color={colors.goldText} />
                </Row>
                <Row style={{ gap: 4 }}>
                  <Icon name="star" size={14} color={colors.goldDark} />
                  <Txt variant="bodySm" color={colors.textMuted}>
                    {rider.rating} (Tambo Rider)
                  </Txt>
                </Row>
                <Txt variant="bodySm" color={colors.textMuted} numberOfLines={1}>
                  {rider.vehicle} • Placa {rider.plate}
                </Txt>
              </View>
              {!completed && (
                <>
                  <IconButton
                    icon="phone-outline"
                    label={`Llamar a ${rider.name}`}
                    bg={colors.surfaceMid}
                    onPress={call}
                  />
                  <IconButton
                    icon="message-text-outline"
                    label={`Enviar mensaje a ${rider.name}`}
                    bg={colors.primary}
                    color={colors.white}
                    onPress={() => setChatOpen(true)}
                  />
                </>
              )}
            </Card>
          )}

          {completed && <RateCard rating={order.rating} onRate={(r) => rate(order.id, r)} />}

          {/* Detalle de compra */}
          <Card style={{ overflow: 'hidden' }}>
            <Tap
              onPress={() => setDetailOpen((o) => !o)}
              style={styles.detailHead}
              accessibilityState={{ expanded: detailOpen }}
              accessibilityLabel="Ver detalle de la compra"
            >
              <Icon name="receipt-text-outline" size={22} color={colors.text} />
              <Txt variant="labelLg" style={{ flex: 1 }}>
                Ver detalle de la compra
              </Txt>
              <Txt variant="headlineMd" color={colors.primary}>
                {money(order.totals.total)}
              </Txt>
              <Icon name={detailOpen ? 'chevron-up' : 'chevron-down'} size={22} color={colors.text} />
            </Tap>
            {detailOpen && (
              <Animated.View entering={FadeIn} style={styles.detailBody}>
                {order.items.map((i) => {
                  const p = getProduct(i.productId);
                  return (
                    <Row key={i.productId} style={{ alignItems: 'flex-start', gap: space.md }}>
                      {p && <ProductImage product={p} size={44} rounded={radius.md} />}
                      <View style={{ flex: 1 }}>
                        <Txt variant="labelMd" numberOfLines={2}>
                          {i.name}
                        </Txt>
                        <Txt variant="bodySm" color={colors.textMuted}>
                          {i.subtitle} • Cant: {i.qty}
                        </Txt>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Txt variant="labelLg">{money(i.lineTotal)}</Txt>
                        {i.regularPrice && i.regularPrice * i.qty > i.lineTotal && (
                          <Txt variant="priceStrike" color={colors.textSubtle}>
                            {money(i.regularPrice * i.qty)}
                          </Txt>
                        )}
                      </View>
                    </Row>
                  );
                })}
                <Divider />
                <SummaryRow label="Subtotal de productos" value={money(order.totals.regularSubtotal)} />
                <SummaryRow
                  label={delivery ? 'Costo de envío express' : 'Retiro en tienda'}
                  value={order.totals.shipping ? money(order.totals.shipping) : 'Gratis'}
                />
                {order.totals.productDiscount > 0 && (
                  <SummaryRow
                    label="Descuento aplicado (Promo Tambo)"
                    value={`-${money(order.totals.productDiscount)}`}
                    tone="success"
                  />
                )}
                {order.totals.couponDiscount > 0 && (
                  <SummaryRow
                    label={`Cupón ${order.couponCode}`}
                    value={`-${money(order.totals.couponDiscount)}`}
                    tone="success"
                  />
                )}
                <Divider />
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt variant="headlineMd">
                    {order.payment.method === 'cash' ? 'Total a pagar' : 'Total pagado'}
                  </Txt>
                  <Txt variant="headlineMd" color={colors.primary}>
                    {money(order.totals.total)}
                  </Txt>
                </Row>
                <Txt variant="bodySm" color={colors.textMuted}>
                  {order.payment.label}
                  {order.payment.cashAmount
                    ? ` • Paga con ${money(order.payment.cashAmount)} (vuelto ${money(order.payment.cashAmount - order.totals.total)})`
                    : ''}
                </Txt>
                <View style={styles.addressBox}>
                  <Icon
                    name={delivery ? 'map-marker-outline' : 'storefront-outline'}
                    size={20}
                    color={colors.text}
                  />
                  <View style={{ flex: 1 }}>
                    <Txt variant="labelSm" style={{ textTransform: 'uppercase' }}>
                      {delivery ? 'Dirección de entrega' : 'Tienda de retiro'}
                    </Txt>
                    <Txt variant="bodySm" color={colors.textMuted}>
                      {delivery
                        ? `${order.address?.line1}, ${order.address?.district}`
                        : `${store.name}, ${store.address}`}
                    </Txt>
                    {order.address?.reference && (
                      <Txt variant="bodySm" color={colors.textMuted}>
                        Instrucciones: {order.address.reference}
                      </Txt>
                    )}
                  </View>
                </View>
              </Animated.View>
            )}
          </Card>

          {live.phase === 'active' && (
            <Button
              label="Compartir seguimiento con un amigo"
              icon="share-variant-outline"
              onPress={shareTracking}
            />
          )}
          {(completed || cancelled) && (
            <Button label="Volver a pedir" icon="restore" variant="brand" onPress={reorder} />
          )}
          {live.canCancel && (
            <Button
              label="Cancelar pedido"
              variant="danger"
              icon="close"
              onPress={() => setCancelOpen(true)}
            />
          )}
          <Tap
            onPress={() => router.push('/perfil/ayuda')}
            accessibilityLabel="Reportar un problema"
            style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center' }}
          >
            <Txt variant="bodyMd" color={colors.textMuted} style={{ textDecorationLine: 'underline' }}>
              ¿Tienes algún problema con tu pedido? Contáctanos
            </Txt>
          </Tap>
        </View>
      </ScrollView>

      <ChatSheet visible={chatOpen} onClose={() => setChatOpen(false)} />
      <Sheet
        visible={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="¿Cancelar pedido?"
        subtitle="La tienda aún no empieza a prepararlo"
      >
        <View style={{ gap: space.md }}>
          <Txt variant="bodyMd" color={colors.textMuted}>
            Si cancelas ahora te devolveremos {money(order.totals.total)} a tu método de pago en un máximo de
            48 horas.
          </Txt>
          <Button
            label="Sí, cancelar pedido"
            variant="danger"
            onPress={() => {
              cancel(order.id);
              setCancelOpen(false);
              toast('Pedido cancelado', { icon: 'close-circle-outline' });
            }}
          />
          <Button label="No, mantener pedido" variant="ghost" onPress={() => setCancelOpen(false)} />
        </View>
      </Sheet>
    </View>
  );
}

function RateCard({ rating, onRate }: { rating?: number; onRate: (r: number) => void }) {
  const [value, setValue] = useState(rating ?? 0);
  return (
    <Animated.View entering={FadeInDown}>
      <Card style={{ padding: space.lg, gap: space.md, alignItems: 'center' }}>
        <Txt variant="headlineMd">{rating ? '¡Gracias por tu calificación!' : '¿Qué tal tu pedido?'}</Txt>
        <Row style={{ gap: space.xs }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <IconButton
              key={n}
              icon={n <= value ? 'star' : 'star-outline'}
              label={`${n} estrellas`}
              color={colors.goldDark}
              size={48}
              onPress={() => {
                setValue(n);
                onRate(n);
                haptic.tap();
              }}
            />
          ))}
        </Row>
        <Badge label="Sumaste puntos Tambo Lover con esta compra" tone="warning" icon="star-circle-outline" />
      </Card>
    </Animated.View>
  );
}

const QUICK = ['Ya bajo 🙌', 'Toca el timbre 502', 'Déjalo en recepción', '¿Cuánto falta?'];

function ChatSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<{ from: 'me' | 'rider'; text: string }[]>([
    { from: 'rider', text: `¡Hola! Soy ${rider.name.split(' ')[0]}, ya tengo tu pedido. Voy en camino 🛵` },
  ]);
  const [text, setText] = useState('');
  const send = (t: string) => {
    const msg = t.trim();
    if (!msg) return;
    setMessages((m) => [...m, { from: 'me', text: msg }]);
    setText('');
    setTimeout(
      () =>
        setMessages((m) => [...m, { from: 'rider', text: '¡Perfecto, entendido! Te aviso al llegar 👍' }]),
      1200,
    );
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={`Chat con ${rider.name.split(' ')[0]}`}
      subtitle="Tambo Rider • En línea"
    >
      <View style={{ gap: space.sm }}>
        {messages.map((m, i) => (
          <Animated.View
            key={i}
            entering={FadeIn}
            style={[styles.bubble, m.from === 'me' ? styles.bubbleMe : styles.bubbleRider]}
          >
            <Txt variant="bodyMd" color={m.from === 'me' ? colors.white : colors.text}>
              {m.text}
            </Txt>
          </Animated.View>
        ))}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.sm, paddingVertical: space.sm }}
        >
          {QUICK.map((q) => (
            <Tap key={q} onPress={() => send(q)} style={styles.quick} accessibilityLabel={q}>
              <Txt variant="labelMd" color={colors.primary}>
                {q}
              </Txt>
            </Tap>
          ))}
        </ScrollView>
        <Row>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={colors.placeholder}
            style={styles.chatInput}
            onSubmitEditing={() => send(text)}
            returnKeyType="send"
            accessibilityLabel="Mensaje"
          />
          <IconButton
            icon="send"
            label="Enviar"
            bg={colors.primary}
            color={colors.white}
            onPress={() => send(text)}
          />
        </Row>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  support: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    height: 36,
    marginRight: space.sm,
  },
  gps: {
    position: 'absolute',
    top: space.md,
    right: space.md,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  sheet: {
    marginTop: -24,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.sheet + 8,
    borderTopRightRadius: radius.sheet + 8,
    paddingHorizontal: space.lg,
    gap: space.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.handle,
    marginTop: space.md,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceMid,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  eta: {
    backgroundColor: colors.gold,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    alignItems: 'center',
    minWidth: 72,
  },
  rider: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  riderPhoto: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: colors.primary },
  online: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.white,
  },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg },
  detailBody: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md },
  addressBox: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceLow,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubble: { maxWidth: '82%', padding: space.md, borderRadius: radius.lg },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleRider: { alignSelf: 'flex-start', backgroundColor: colors.surfaceMid, borderBottomLeftRadius: 4 },
  quick: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    height: 36,
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
  chatInput: {
    flex: 1,
    height: 46,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: space.md,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
});
