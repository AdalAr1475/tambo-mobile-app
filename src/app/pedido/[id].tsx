import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { EmptyState, ScreenHeader } from '@/components/layout';
import { SummaryRow } from '@/components/summary';
import { Badge, Button, Card, Divider, Row, Txt } from '@/components/ui';
import { getProduct } from '@/data/products';
import { getStore } from '@/data/stores';
import { friendlyDate, money, time24 } from '@/lib/format';
import { getOrderStatus } from '@/lib/orderProgress';
import { useCart } from '@/store/cart';
import { useNow, useOrder } from '@/store/orders';
import { useSession } from '@/store/session';
import { toast } from '@/store/ui';
import { colors, radius, space } from '@/theme/tokens';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrder(id);
  const now = useNow(2000);
  const insets = useSafeAreaInsets();
  const replace = useCart((s) => s.replace);
  const email = useSession((s) => s.profile.email);

  if (!order) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Pedido" />
        <EmptyState
          icon="receipt-text-remove-outline"
          title="Pedido no encontrado"
          message="Puede que haya sido eliminado."
        />
      </View>
    );
  }

  const status = getOrderStatus(order, now);
  const store = getStore(order.storeId);
  const igv = order.totals.total - order.totals.total / 1.18;
  const serial = `B001-${order.id.replace(/\D/g, '').padStart(8, '0')}`;
  const cancelled = status.phase === 'cancelled';

  const reorder = () => {
    replace(
      order.items.filter((i) => getProduct(i.productId)).map((i) => ({ productId: i.productId, qty: i.qty })),
    );
    router.push('/carrito');
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        kicker={cancelled ? 'Detalle del pedido' : 'Boleta electrónica'}
        title={`Pedido #${order.id}`}
      />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xl }]}>
        <Card style={styles.status}>
          <View style={[styles.statusIcon, cancelled && { backgroundColor: colors.errorSoft }]}>
            <Icon
              name={
                cancelled
                  ? 'close-circle-outline'
                  : status.phase === 'completed'
                    ? 'check-decagram'
                    : 'progress-clock'
              }
              size={26}
              color={cancelled ? colors.error : colors.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="labelLg" weight="bold">
              {status.headline}
            </Txt>
            <Txt variant="bodySm" color={colors.textMuted}>
              {friendlyDate(order.createdAt)} •{' '}
              {order.fulfillment === 'delivery' ? 'Delivery' : 'Para llevar'}
            </Txt>
          </View>
          {status.phase === 'active' && (
            <Button
              label="Rastrear"
              size="sm"
              full={false}
              onPress={() => router.push(`/pedido/seguimiento/${order.id}`)}
            />
          )}
        </Card>

        <Card style={styles.receipt}>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Txt variant="headlineLg" weight="extrabold" color={colors.primary}>
              Tambo+
            </Txt>
            <Txt variant="bodySm" color={colors.textMuted} align="center">
              {store.name} • {store.address}
            </Txt>
            <Badge
              label={cancelled ? 'ANULADA' : `BOLETA ${serial}`}
              tone={cancelled ? 'danger' : 'soft'}
              style={{ alignSelf: 'center', marginTop: space.sm }}
            />
          </View>
          <Divider dashed />
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="labelSm" color={colors.textMuted}>
              DESCRIPCIÓN
            </Txt>
            <Txt variant="labelSm" color={colors.textMuted}>
              IMPORTE
            </Txt>
          </Row>
          {order.items.map((i) => (
            <Row key={i.productId} style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Txt variant="labelMd">{i.name}</Txt>
                <Txt variant="bodySm" color={colors.textMuted}>
                  {i.qty} x {money(i.price)}
                </Txt>
              </View>
              <Txt variant="labelMd">{money(i.lineTotal)}</Txt>
            </Row>
          ))}
          <Divider dashed />
          <SummaryRow label="Subtotal productos" value={money(order.totals.regularSubtotal)} />
          {order.totals.productDiscount > 0 && (
            <SummaryRow
              label="Descuentos"
              value={`- ${money(order.totals.productDiscount)}`}
              tone="discount"
            />
          )}
          {order.totals.couponDiscount > 0 && (
            <SummaryRow
              label={`Cupón ${order.couponCode}`}
              value={`- ${money(order.totals.couponDiscount)}`}
              tone="discount"
            />
          )}
          <SummaryRow label="Envío" value={order.totals.shipping ? money(order.totals.shipping) : 'Gratis'} />
          <SummaryRow label="Op. gravada" value={money(order.totals.total - igv)} />
          <SummaryRow label="IGV (18%)" value={money(igv)} />
          <Divider />
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="headlineMd">Total</Txt>
            <Txt variant="headlineMd" color={colors.primary}>
              {money(order.totals.total)}
            </Txt>
          </Row>
          <Divider dashed />
          <InfoRow icon="credit-card-outline" label="Pago" value={order.payment.label} />
          {order.fulfillment === 'delivery' && order.address ? (
            <InfoRow
              icon="map-marker-outline"
              label="Entrega"
              value={`${order.address.line1}, ${order.address.district}`}
            />
          ) : (
            <InfoRow icon="storefront-outline" label="Retiro" value={`${store.name}, ${store.address}`} />
          )}
          {order.schedule.type === 'scheduled' && (
            <InfoRow icon="calendar-clock-outline" label="Horario" value={order.schedule.slot} />
          )}
          <InfoRow
            icon="clock-outline"
            label="Emitida"
            value={`${friendlyDate(order.createdAt)} (${time24(order.createdAt)})`}
          />
        </Card>

        {!cancelled && (
          <Button
            label="Enviar boleta a mi correo"
            icon="email-outline"
            variant="outline"
            onPress={() =>
              toast(`Boleta enviada a ${email}`, { icon: 'email-check-outline', tone: 'success' })
            }
          />
        )}
        <Button label="Volver a pedir" icon="restore" variant="brand" onPress={reorder} />
        <Button
          label="Necesito ayuda con este pedido"
          icon="help-circle-outline"
          variant="ghost"
          onPress={() => router.push('/perfil/ayuda')}
        />
      </ScrollView>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  value: string;
}) {
  return (
    <Row style={{ alignItems: 'flex-start' }}>
      <Icon name={icon} size={18} color={colors.textMuted} />
      <Txt variant="labelMd" style={{ width: 70 }}>
        {label}
      </Txt>
      <Txt variant="bodySm" color={colors.textMuted} style={{ flex: 1 }}>
        {value}
      </Txt>
    </Row>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receipt: { padding: space.lg, gap: space.md },
});
