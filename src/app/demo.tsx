import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { ScreenHeader } from '@/components/layout';
import { Sheet } from '@/components/Sheet';
import { Button, Card, Chip, Divider, Row, Txt } from '@/components/ui';
import type { Fulfillment } from '@/data/types';
import { resetDemoData } from '@/lib/demo';
import { haptic } from '@/lib/feedback';
import { DEMO_TIMELINE, getOrderStatus } from '@/lib/orderProgress';
import { placeOrder } from '@/lib/placeOrder';
import { DEMO_TOP_UP, formatPoints, pts } from '@/lib/points';
import { POINTS_ICON } from '@/components/points';
import { useBalance, useWallet } from '@/store/wallet';
import { useDemo, type FastClock } from '@/store/demo';
import { useActiveOrders, useNow, useOrders } from '@/store/orders';
import { useSession } from '@/store/session';
import { toast } from '@/store/ui';
import { colors, radius, space } from '@/theme/tokens';

/** Productos de los pedidos de prueba (sin alcohol para no disparar el age gate). */
const TEST_ITEMS: Record<Fulfillment, { productId: string; qty: number }[]> = {
  delivery: [
    { productId: 'lays-clasicas', qty: 2 },
    { productId: 'incakola-zero', qty: 1 },
  ],
  pickup: [
    { productId: 'cafe-americano', qty: 1 },
    { productId: 'croissant', qty: 1 },
  ],
};

export default function DemoScreen() {
  const insets = useSafeAreaInsets();
  const enabled = useDemo((s) => s.enabled);
  const setEnabled = useDemo((s) => s.setEnabled);
  const fastClock = useDemo((s) => s.fastClock);
  const setFastClock = useDemo((s) => s.setFastClock);
  const realLocation = useDemo((s) => s.realLocation);
  const setRealLocation = useDemo((s) => s.setRealLocation);
  const fastForward = useOrders((s) => s.fastForward);
  const balance = useBalance();
  const demoTopUp = useWallet((s) => s.demoTopUp);
  const now = useNow(1000);
  const active = useActiveOrders(now);
  const [resetOpen, setResetOpen] = useState(false);

  const createTestOrder = (fulfillment: Fulfillment) => {
    const s = useSession.getState();
    const address = s.addresses.find((a) => a.id === s.addressId) ?? s.addresses[0];
    if (fulfillment === 'delivery' && !address) {
      toast('Agrega una dirección para crear un delivery', { tone: 'error' });
      return;
    }
    const order = placeOrder({
      items: TEST_ITEMS[fulfillment],
      fulfillment,
      storeId: s.storeId,
      address,
      schedule: { type: 'asap' },
      payment: { method: 'yape', label: 'Yape · Código de aprobación' },
      pickupMethod: 'locker',
      clearCart: false,
    });
    if (fulfillment === 'pickup') fastForward(order.id, DEMO_TIMELINE.pickupReady);
    haptic.success();
    router.push(`/pedido/seguimiento/${order.id}`);
  };

  const reset = () => {
    resetDemoData();
    setResetOpen(false);
    haptic.success();
    toast('Demo reiniciada: la app quedó como recién instalada', { tone: 'success', icon: 'restart' });
    router.dismissTo('/');
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader kicker="Herramientas de presentación" title="Modo Presentador" />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxl }]}>
        <Card style={styles.block}>
          <Row style={{ gap: space.md }}>
            <Icon name="flask-outline" size={24} color={colors.goldText} />
            <View style={{ flex: 1 }}>
              <Txt variant="labelLg">Mostrar controles de simulación</Txt>
              <Txt variant="bodySm" color={colors.textMuted}>
                Botones “Simular…” para la demo en vivo (código Yape, avances del pedido, etc.).
              </Txt>
            </View>
            <Switch
              value={enabled}
              onValueChange={(v) => {
                setEnabled(v);
                haptic.tap();
              }}
              trackColor={{ true: colors.primary, false: colors.surfaceHigh }}
              thumbColor={colors.white}
              accessibilityLabel="Mostrar controles de simulación"
            />
          </Row>
        </Card>

        <Card style={styles.block}>
          <Row style={{ gap: space.md }}>
            <Icon name="crosshairs-gps" size={24} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Txt variant="labelLg">Usar mi GPS real</Txt>
              <Txt variant="bodySm" color={colors.textMuted}>
                Apagado: ubicación de demo fija (Parque Kennedy, Miraflores), con rutas a pie reales. Encendido:
                pide permiso; si estás lejos de las tiendas, vuelve a la de demo.
              </Txt>
            </View>
            <Switch
              value={realLocation}
              onValueChange={(v) => {
                setRealLocation(v);
                haptic.tap();
              }}
              trackColor={{ true: colors.primary, false: colors.surfaceHigh }}
              thumbColor={colors.white}
              accessibilityLabel="Usar mi GPS real"
            />
          </Row>
        </Card>

        <Card style={styles.block}>
          <SectionTitle icon="timer-sand" title="Velocidad de la simulación" />
          <Txt variant="bodySm" color={colors.textMuted}>
            Normal: preparado a los {DEMO_TIMELINE.prepared / 1000} s, en camino a los{' '}
            {DEMO_TIMELINE.onTheWay / 1000} s y entregado a los {DEMO_TIMELINE.delivered / 1000} s.
          </Txt>
          <Row>
            {([1, 3] as FastClock[]).map((v) => (
              <Chip
                key={v}
                label={v === 1 ? '×1 Normal' : '×3 Rápido'}
                active={fastClock === v}
                onPress={() => setFastClock(v)}
              />
            ))}
          </Row>
        </Card>

        <Card style={styles.block}>
          <SectionTitle icon={POINTS_ICON} title="Tambo Lover Puntos" />
          <Txt variant="bodySm" color={colors.textMuted}>
            Saldo actual: {pts(balance)}. Recarga para probar varios canjes seguidos.
          </Txt>
          <Button
            label={`Recargar ${formatPoints(DEMO_TOP_UP)} pts`}
            icon="plus-circle-outline"
            variant="outline"
            onPress={() => {
              demoTopUp();
              haptic.success();
              toast(`Sumamos ${pts(DEMO_TOP_UP)} de prueba`, { icon: POINTS_ICON, tone: 'success' });
            }}
          />
        </Card>

        <Card style={styles.block}>
          <SectionTitle icon="receipt-text-plus-outline" title="Pedidos de prueba" />
          <Txt variant="bodySm" color={colors.textMuted}>
            Crea un pedido sin pasar por el checkout (no toca tu carrito).
          </Txt>
          <Button
            label="Crear delivery en curso"
            icon="moped-outline"
            variant="outline"
            onPress={() => createTestOrder('delivery')}
          />
          <Button
            label="Crear pedido listo en Smart Locker"
            icon="storefront-outline"
            variant="outline"
            onPress={() => createTestOrder('pickup')}
          />
        </Card>

        <Card style={styles.block}>
          <SectionTitle icon="fast-forward-outline" title="Pedidos en curso" />
          {active.length === 0 ? (
            <Txt variant="bodySm" color={colors.textMuted}>
              No hay pedidos en curso.
            </Txt>
          ) : (
            active.map((o, i) => {
              const status = getOrderStatus(o, now);
              return (
                <View key={o.id} style={{ gap: space.sm }}>
                  {i > 0 && <Divider />}
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Txt variant="labelLg">#{o.id}</Txt>
                      <Txt variant="bodySm" color={colors.textMuted}>
                        {o.fulfillment === 'delivery' ? 'Delivery' : 'Para llevar'} • {status.shortLabel}
                      </Txt>
                    </View>
                    <Button
                      label="Ver"
                      size="sm"
                      variant="soft"
                      full={false}
                      onPress={() => router.push(`/pedido/seguimiento/${o.id}`)}
                    />
                  </Row>
                  <Row>
                    <Button
                      label="Adelantar 15 s"
                      icon="fast-forward"
                      size="sm"
                      variant="outline"
                      full={false}
                      onPress={() => fastForward(o.id, 15_000)}
                    />
                    <Button
                      label="Adelantar 60 s"
                      icon="fast-forward"
                      size="sm"
                      variant="outline"
                      full={false}
                      onPress={() => fastForward(o.id, 60_000)}
                    />
                  </Row>
                </View>
              );
            })
          )}
        </Card>

        <Card style={[styles.block, styles.danger]}>
          <SectionTitle icon="restart" title="Reiniciar demo" tone="danger" />
          <Txt variant="bodySm" color={colors.textMuted}>
            Vacía el carrito, restaura la sesión (direcciones, verificación de edad), deja solo los pedidos de
            ejemplo y vuelve el saldo a 1,200 puntos. Úsalo antes de cada ensayo.
          </Txt>
          <Button label="Reiniciar demo" icon="restart" variant="danger" onPress={() => setResetOpen(true)} />
        </Card>
      </ScrollView>

      <Sheet
        visible={resetOpen}
        onClose={() => setResetOpen(false)}
        title="¿Reiniciar la demo?"
        subtitle="No se puede deshacer"
      >
        <View style={{ gap: space.md }}>
          <Txt variant="bodyMd" color={colors.textMuted}>
            Se borrarán el carrito, los pedidos que creaste y los cambios de tu perfil.
          </Txt>
          <Button label="Sí, reiniciar" variant="danger" icon="restart" onPress={reset} />
          <Button label="Cancelar" variant="ghost" onPress={() => setResetOpen(false)} />
        </View>
      </Sheet>
    </View>
  );
}

function SectionTitle({ icon, title, tone }: { icon: IconName; title: string; tone?: 'danger' }) {
  return (
    <Row>
      <Icon name={icon} size={20} color={tone === 'danger' ? colors.error : colors.primary} />
      <Txt variant="headlineMd" style={{ fontSize: 16 }}>
        {title}
      </Txt>
    </Row>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md },
  block: { padding: space.lg, gap: space.md },
  danger: { borderColor: colors.errorSoft, borderRadius: radius.xl },
});
