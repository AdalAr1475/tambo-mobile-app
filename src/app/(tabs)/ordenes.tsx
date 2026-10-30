import { LinearGradient } from 'expo-linear-gradient';
import { router, useIsFocused } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Icon } from '@/components/Icon';
import { EmptyState, ScreenHeader, SearchBar } from '@/components/layout';
import { ProductImage } from '@/components/product';
import { Badge, Button, Card, Divider, IconButton, Row, Tap, Txt } from '@/components/ui';
import { getProduct, normalize } from '@/data/products';
import { getStore } from '@/data/stores';
import type { Order } from '@/data/types';
import { friendlyDate, money, pluralize, shortDate } from '@/lib/format';
import { getOrderStatus, type OrderStatus } from '@/lib/orderProgress';
import { useCart } from '@/store/cart';
import { useNow, useOrders } from '@/store/orders';
import { toast } from '@/store/ui';
import { colors, radius, space } from '@/theme/tokens';

export default function OrdersScreen() {
  const orders = useOrders((s) => s.orders);
  const focused = useIsFocused();
  const now = useNow(1000, focused);
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  const withStatus = useMemo(
    () =>
      orders
        .filter((o) => {
          const q = normalize(query.trim());
          return !q || normalize(`${o.id} ${o.items.map((i) => i.name).join(' ')}`).includes(q);
        })
        .map((o) => ({ order: o, status: getOrderStatus(o, now) })),
    [orders, now, query],
  );
  const active = withStatus.filter((x) => x.status.phase === 'active');
  const history = withStatus.filter((x) => x.status.phase !== 'active');

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="Mis Pedidos"
        back={false}
        right={
          <Row style={{ gap: 0 }}>
            <IconButton
              icon={searching ? 'close' : 'magnify'}
              label={searching ? 'Cerrar búsqueda' : 'Buscar pedido'}
              color={colors.white}
              onPress={() => {
                setSearching((s) => !s);
                setQuery('');
              }}
            />
            <IconButton
              icon="face-agent"
              label="Soporte"
              color={colors.white}
              onPress={() => router.push('/perfil/ayuda')}
            />
          </Row>
        }
      >
        {searching && (
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por código o producto"
            autoFocus
            style={{ marginHorizontal: space.sm, marginTop: space.sm }}
          />
        )}
      </ScreenHeader>

      <Row style={styles.tabs} accessibilityRole="tablist">
        {(
          [
            ['active', 'En curso', active.length],
            ['history', 'Historial', history.length],
          ] as const
        ).map(([key, label, n]) => {
          const selected = tab === key;
          return (
            <Tap
              key={key}
              onPress={() => setTab(key)}
              style={[styles.tab, selected && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label}, ${n}`}
              pressedStyle={{ opacity: 0.7 }}
            >
              <Txt
                variant="headlineMd"
                color={selected ? colors.primaryDark : colors.textMuted}
                style={{ fontSize: 17 }}
              >
                {label}
              </Txt>
              <View style={[styles.count, selected && { backgroundColor: colors.primarySoft }]}>
                <Txt variant="labelSm" color={selected ? colors.primary : colors.textMuted}>
                  {n}
                </Txt>
              </View>
            </Tap>
          );
        })}
      </Row>

      <ScrollView contentContainerStyle={styles.body}>
        {tab === 'active' ? (
          <>
            {active.length === 0 ? (
              <EmptyState
                icon="moped-outline"
                title={query ? 'Sin coincidencias' : 'No tienes pedidos en curso'}
                message={
                  query
                    ? 'Prueba con otro código o producto.'
                    : 'Tus antojos están a un click. Te los llevamos en 25-35 min.'
                }
                action={query ? undefined : 'Hacer un pedido'}
                onAction={() => router.navigate('/')}
              />
            ) : (
              active.map(({ order, status }) => (
                <ActiveOrderCard key={order.id} order={order} status={status} />
              ))
            )}
            {history.length > 0 && (
              <>
                <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
                  <Txt
                    variant="labelLg"
                    color={colors.textMuted}
                    style={{ textTransform: 'uppercase', letterSpacing: 1 }}
                  >
                    Historial reciente
                  </Txt>
                  <Tap
                    onPress={() => setTab('history')}
                    hitSlop={10}
                    accessibilityLabel="Ver todo el historial"
                  >
                    <Txt variant="labelMd" color={colors.primary}>
                      Ver todos
                    </Txt>
                  </Tap>
                </Row>
                {history.slice(0, 2).map(({ order, status }) => (
                  <HistoryCard key={order.id} order={order} status={status} />
                ))}
              </>
            )}
          </>
        ) : history.length === 0 ? (
          <EmptyState
            icon="receipt-text-outline"
            title="Aún no tienes historial"
            message="Cuando completes un pedido aparecerá aquí."
          />
        ) : (
          history.map(({ order, status }) => <HistoryCard key={order.id} order={order} status={status} />)
        )}

        <Tap
          onPress={() => router.push('/perfil/ayuda')}
          style={styles.help}
          accessibilityLabel="Ayuda con tu pedido"
        >
          <View style={styles.helpIcon}>
            <Icon name="help-box-outline" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="labelLg">¿Tienes dudas con tu pedido?</Txt>
            <Txt variant="bodySm" color={colors.textMuted}>
              Chatea con soporte Tambo al instante
            </Txt>
          </View>
          <Txt variant="labelMd" color={colors.primary}>
            Ayuda
          </Txt>
        </Tap>
      </ScrollView>
    </View>
  );
}

function Thumbs({ order }: { order: Order }) {
  return (
    <Row style={{ gap: 0 }}>
      {order.items.slice(0, 3).map((i, idx) => {
        const p = getProduct(i.productId);
        return p ? (
          <View key={i.productId} style={[styles.thumb, { marginLeft: idx ? -12 : 0 }]}>
            <ProductImage product={p} size={44} rounded={radius.md} />
          </View>
        ) : null;
      })}
    </Row>
  );
}

function ActiveOrderCard({ order, status }: { order: Order; status: OrderStatus }) {
  const store = getStore(order.storeId);
  const count = order.items.reduce((n, i) => n + i.qty, 0);
  const delivery = order.fulfillment === 'delivery';
  return (
    <Animated.View entering={FadeIn}>
      <Card style={{ overflow: 'hidden' }}>
        <LinearGradient
          colors={[colors.gold, colors.magenta, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ height: 6 }}
        />
        <View style={styles.cardBody}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Txt variant="headlineMd">Pedido #{order.id}</Txt>
              <Txt variant="bodySm" color={colors.textMuted}>
                {friendlyDate(order.createdAt)}
              </Txt>
            </View>
            <Badge label={status.shortLabel} tone="success" icon="circle-medium" />
          </Row>
          <Row style={{ gap: 6 }}>
            <Icon
              name={delivery ? 'storefront-outline' : 'shopping-outline'}
              size={16}
              color={colors.textMuted}
            />
            <Txt variant="bodySm" color={colors.textMuted}>
              {delivery ? `${store.name} - ${store.district}` : `Para llevar • ${store.name}`}
            </Txt>
          </Row>
          <Divider />
          <Row style={{ gap: space.md }}>
            <Thumbs order={order} />
            <View style={{ flex: 1 }}>
              <Txt variant="labelMd" numberOfLines={1}>
                {order.items[0]?.name}
              </Txt>
              <Txt variant="bodySm" color={colors.textMuted}>
                {pluralize(count, 'producto', 'productos')} • {delivery ? 'Entrega' : 'Recojo'}
              </Txt>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Txt variant="bodySm" color={colors.textMuted}>
                Total
              </Txt>
              <Txt variant="headlineMd" color={colors.primaryDark}>
                {money(order.totals.total)}
              </Txt>
            </View>
          </Row>
          <View style={styles.progressBox}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row style={{ gap: 6 }}>
                <Icon name={delivery ? 'moped-outline' : 'chef-hat'} size={16} color={colors.text} />
                <Txt variant="labelMd">{status.steps[status.step].title}</Txt>
              </Row>
              <Txt variant="labelSm" color={colors.textMuted}>
                {Math.round(status.progress * 100)}% completado
              </Txt>
            </Row>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${status.progress * 100}%` }]} />
            </View>
          </View>
          <Row>
            <Button
              label="Rastrear pedido"
              icon="navigation-variant-outline"
              full={false}
              style={{ flex: 1 }}
              onPress={() => router.push(`/pedido/seguimiento/${order.id}`)}
            />
            <Button
              label="Ver detalle"
              variant="soft"
              full={false}
              style={{ flex: 1 }}
              onPress={() => router.push(`/pedido/${order.id}`)}
            />
          </Row>
        </View>
      </Card>
    </Animated.View>
  );
}

function HistoryCard({ order, status }: { order: Order; status: OrderStatus }) {
  const store = getStore(order.storeId);
  const replace = useCart((s) => s.replace);
  const count = order.items.reduce((n, i) => n + i.qty, 0);
  const cancelled = status.phase === 'cancelled';
  const first = order.items[0];
  const firstProduct = first && getProduct(first.productId);

  const reorder = () => {
    const available = order.items.filter((i) => getProduct(i.productId));
    replace(available.map((i) => ({ productId: i.productId, qty: i.qty })));
    toast(`${pluralize(available.length, 'producto agregado', 'productos agregados')} al carrito`, {
      icon: 'restore',
    });
    router.push('/carrito');
  };

  return (
    <Card>
      <Tap
        onPress={() => router.push(`/pedido/${order.id}`)}
        style={styles.cardBody}
        pressedStyle={{ opacity: 0.85 }}
        accessibilityLabel={`Pedido ${order.id}, ${status.shortLabel}`}
      >
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Txt variant="headlineMd">Pedido #{order.id}</Txt>
            <Txt variant="bodySm" color={colors.textMuted}>
              {pluralize(count, 'artículo', 'artículos')}
            </Txt>
          </View>
          <Badge
            label={`${status.shortLabel} • ${shortDate(order.createdAt)}`}
            tone={cancelled ? 'danger' : 'neutral'}
            icon={cancelled ? 'close-circle-outline' : 'check-circle-outline'}
          />
        </Row>
        <Row style={{ gap: 6 }}>
          <Icon
            name={order.fulfillment === 'delivery' ? 'storefront-outline' : 'shopping-outline'}
            size={16}
            color={colors.textMuted}
          />
          <Txt variant="bodySm" color={colors.textMuted}>
            {order.fulfillment === 'delivery'
              ? `${store.name} - ${store.district}`
              : `Para llevar • ${store.name}`}
          </Txt>
        </Row>
        <Divider />
        <Row style={{ gap: space.md }}>
          {firstProduct && <ProductImage product={firstProduct} size={48} rounded={radius.md} />}
          <View style={{ flex: 1 }}>
            <Txt variant="labelMd" numberOfLines={1}>
              {first?.name}
              {order.items.length > 1 ? ` +${order.items.length - 1}` : ''}
            </Txt>
            <Txt variant="bodySm" color={colors.textMuted} numberOfLines={1}>
              {order.fulfillment === 'pickup'
                ? 'Retiro express en tienda'
                : `Pagado con ${order.payment.label}`}
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt variant="bodySm" color={colors.textMuted}>
              Total
            </Txt>
            <Txt
              variant="headlineMd"
              color={cancelled ? colors.textSubtle : colors.primaryDark}
              style={cancelled && { textDecorationLine: 'line-through' }}
            >
              {money(order.totals.total)}
            </Txt>
          </View>
        </Row>
      </Tap>
      <Row style={styles.historyFooter}>
        <Tap
          onPress={() => router.push(`/pedido/${order.id}`)}
          style={styles.receipt}
          accessibilityLabel="Ver boleta electrónica"
        >
          <Icon name="receipt-text-outline" size={18} color={colors.text} />
          <Txt variant="labelMd">{cancelled ? 'Ver detalle' : 'Boleta electrónica'}</Txt>
        </Tap>
        <Button
          label="Volver a pedir"
          icon="restore"
          variant="brand"
          size="sm"
          full={false}
          onPress={reorder}
        />
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  tabs: {
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    gap: space.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primaryDark },
  count: {
    minWidth: 24,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.surfaceMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  cardBody: { padding: space.lg, gap: space.md },
  thumb: { borderWidth: 2, borderColor: colors.white, borderRadius: radius.md + 2 },
  progressBox: {
    backgroundColor: colors.surfaceLow,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.sm,
  },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  historyFooter: {
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  receipt: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40 },
  help: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceMid,
    borderWidth: 1,
    borderColor: colors.border,
  },
  helpIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
