import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/layout';
import { Badge, Button, Card, Divider, IconButton, Row, Tap, Txt } from '@/components/ui';
import { getStore } from '@/data/stores';
import { money } from '@/lib/format';
import { haptic } from '@/lib/feedback';
import { useOrder } from '@/store/orders';
import { toast } from '@/store/ui';
import { colors, radius, space } from '@/theme/tokens';

export default function OrderConfirmedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrder(id);
  const insets = useSafeAreaInsets();
  const [showItems, setShowItems] = useState(false);
  const goHome = () => router.dismissTo('/');

  if (!order) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <EmptyState
          icon="receipt-text-remove-outline"
          title="Pedido no encontrado"
          message="Revisa tus pedidos en la pestaña Órdenes."
          action="Ir al inicio"
          onAction={goHome}
        />
      </View>
    );
  }

  const store = getStore(order.storeId);
  const delivery = order.fulfillment === 'delivery';
  const paidOnline = order.payment.method !== 'cash';
  const itemsSummary = order.items.map((i) => i.name).join(' + ');
  const eta =
    order.schedule.type === 'scheduled'
      ? order.schedule.slot
      : delivery
        ? '25 - 35 minutos'
        : `Listo en ${store.eta.replace('-', ' - ')}`;

  const copy = async () => {
    await Clipboard.setStringAsync(order.id);
    haptic.success();
    toast(`Código ${order.id} copiado`, { icon: 'content-copy' });
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Row style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Row style={{ flex: 1, gap: 6 }}>
          <View style={styles.brandDot} />
          <Txt variant="headlineLg" weight="extrabold" color={colors.white}>
            Tambo+
          </Txt>
        </Row>
        <IconButton
          icon="close"
          label="Cerrar e ir al inicio"
          color={colors.white}
          bg="rgba(255,255,255,0.14)"
          onPress={goHome}
        />
      </Row>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.hero}>
          <Animated.View entering={FadeIn.delay(300)} style={[styles.spark, { left: '22%', top: 4 }]}>
            <Icon name="star-four-points" size={22} color={colors.gold} />
          </Animated.View>
          <Animated.View entering={FadeIn.delay(400)} style={[styles.spark, { right: '24%', top: 0 }]}>
            <Icon name="triangle" size={16} color={colors.primary} />
          </Animated.View>
          <Animated.View entering={FadeIn.delay(500)} style={[styles.spark, { right: '18%', top: 50 }]}>
            <Icon name="circle" size={14} color={colors.goldText} />
          </Animated.View>
          <Animated.View entering={FadeIn.delay(600)} style={[styles.spark, { left: '26%', top: 120 }]}>
            <Icon name="star" size={18} color={colors.onPrimaryContainer} />
          </Animated.View>
          <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.checkOuter}>
            <View style={styles.checkInner}>
              <Icon name="check-circle-outline" size={56} color={colors.white} />
            </View>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInUp.delay(200)} style={{ alignItems: 'center', gap: space.sm }}>
          <Badge label="CONFIRMADO" tone="soft" icon="check-decagram-outline" />
          <Txt
            variant="headlineXl"
            align="center"
            color={colors.primaryDark}
            style={{ fontSize: 32, lineHeight: 38 }}
          >
            ¡Tu pedido está confirmado!
          </Txt>
          <Txt variant="bodyLg" align="center" color={colors.textMuted}>
            Estamos preparando tus antojos en{' '}
            <Txt variant="bodyLg" weight="bold">
              {store.name}
            </Txt>
          </Txt>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300)} style={{ gap: space.md }}>
          <Card style={styles.etaCard}>
            <View style={styles.etaIcon}>
              <Icon name="timer-outline" size={30} color={colors.goldText} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyMd" color={colors.textMuted}>
                {order.schedule.type === 'scheduled' ? 'Entrega programada' : 'Tiempo estimado'}
              </Txt>
              <Txt variant="headlineMd" style={{ fontSize: 20 }}>
                {eta}
              </Txt>
            </View>
          </Card>

          <Card style={{ padding: space.lg, gap: space.md }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Txt variant="bodyMd" color={colors.textMuted}>
                  Código de pedido
                </Txt>
                <Txt variant="headlineMd" color={colors.primaryDark} style={{ letterSpacing: 1.5 }}>
                  #{order.id}
                </Txt>
              </View>
              <Tap onPress={copy} style={styles.copy} accessibilityLabel="Copiar código de pedido">
                <Icon name="content-copy" size={16} color={colors.text} />
                <Txt variant="labelMd">Copiar</Txt>
              </Tap>
            </Row>
            <Divider />
            <Row style={{ alignItems: 'flex-start', gap: space.md }}>
              <View style={styles.rowIcon}>
                <Icon name={delivery ? 'moped' : 'storefront-outline'} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Row style={{ flexWrap: 'wrap' }}>
                  <Txt variant="labelLg" weight="bold">
                    {delivery ? 'Delivery Express' : 'Para llevar'}
                  </Txt>
                  <Badge label={delivery ? 'EN CAMINO PRONTO' : 'EN PREPARACIÓN'} tone="warning" />
                </Row>
                <Txt variant="bodyMd" color={colors.textMuted}>
                  {delivery ? order.address?.line1 : store.name}
                </Txt>
                <Txt variant="bodySm" color={colors.textSubtle}>
                  {delivery ? order.address?.district : store.address}
                </Txt>
              </View>
            </Row>
            <Divider />
            <Row style={{ gap: space.md }}>
              <View style={styles.rowIcon}>
                <Icon name="cash-multiple" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="labelLg" weight="bold">
                  Método de pago
                </Txt>
                <Txt variant="bodyMd" color={colors.textMuted}>
                  {order.payment.label}
                </Txt>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Badge label={paidOnline ? 'Pagado' : 'Por pagar'} tone={paidOnline ? 'soft' : 'warning'} />
                <Txt variant="headlineMd">{money(order.totals.total)}</Txt>
              </View>
            </Row>
          </Card>

          <Tap
            onPress={() => setShowItems((s) => !s)}
            style={styles.items}
            accessibilityState={{ expanded: showItems }}
            accessibilityLabel="Resumen de productos"
          >
            <Row style={{ gap: space.md }}>
              <View style={[styles.rowIcon, { backgroundColor: colors.white }]}>
                <Icon name="shopping-outline" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="labelLg" weight="bold">
                  Resumen de productos ({order.items.reduce((n, i) => n + i.qty, 0)})
                </Txt>
                <Txt variant="bodySm" color={colors.textMuted} numberOfLines={1}>
                  {itemsSummary}
                </Txt>
              </View>
              <Icon name={showItems ? 'chevron-up' : 'chevron-right'} size={22} color={colors.text} />
            </Row>
            {showItems && (
              <Animated.View entering={FadeIn} style={{ gap: space.sm, marginTop: space.md }}>
                {order.items.map((i) => (
                  <Row key={i.productId} style={{ justifyContent: 'space-between' }}>
                    <Txt variant="bodyMd" style={{ flex: 1 }} numberOfLines={1}>
                      {i.qty} x {i.name}
                    </Txt>
                    <Txt variant="labelMd">{money(i.lineTotal)}</Txt>
                  </Row>
                ))}
              </Animated.View>
            )}
          </Tap>

          <Button
            label="Seguir mi pedido"
            icon="navigation-variant-outline"
            size="lg"
            onPress={() => router.replace(`/pedido/seguimiento/${order.id}`)}
          />
          <Button
            label="Ir al Inicio"
            icon="storefront-outline"
            variant="outline"
            size="lg"
            onPress={goHome}
          />
          <Tap
            onPress={() => router.push('/perfil/ayuda')}
            style={styles.help}
            accessibilityLabel="Contactar soporte"
          >
            <Icon name="help-circle-outline" size={18} color={colors.textMuted} />
            <Txt variant="bodyMd" color={colors.textMuted}>
              ¿Tienes dudas con tu entrega? Contáctanos
            </Txt>
          </Tap>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.primary, paddingHorizontal: space.lg, paddingBottom: space.md },
  brandDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.gold },
  body: { padding: space.lg, gap: space.lg },
  hero: { height: 170, alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute' },
  checkOuter: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaCard: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg },
  etaIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceMid,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    height: 36,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  items: {
    padding: space.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceMid,
    borderWidth: 1,
    borderColor: colors.border,
  },
  help: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44 },
});
