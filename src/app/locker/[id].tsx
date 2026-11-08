import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DemoOnly } from '@/components/DemoOnly';
import { Icon } from '@/components/Icon';
import { QrCode } from '@/components/qr';
import { Badge, Button, IconButton, Row, Txt } from '@/components/ui';
import { getStore } from '@/data/stores';
import { haptic } from '@/lib/feedback';
import {
  assignLockers,
  LOCKER_COLUMNS,
  lockerCapacity,
  lockerCode,
  occupiedLockers,
  ZONE_META,
  type LockerSlot,
} from '@/lib/lockers';
import { DEMO_TIMELINE, getOrderStatus, orderClock } from '@/lib/orderProgress';
import { payloadFor, TOKEN_WINDOW_MS, useDynamicQr, verifyPayload, VERIFY_MESSAGE } from '@/lib/token';
import { useContentWidth } from '@/lib/useContentWidth';
import { useNow, useOrder, useOrders } from '@/store/orders';
import { colors, radius, space } from '@/theme/tokens';

type Phase = 'idle' | 'scanning' | 'open' | 'weight' | 'done' | 'error';

const SCAN_MS = 1400;
const DOOR_MS = 1600;
const VIEWPORT = 156;

/**
 * Simulador del tótem Tambo Smart Locker para la demo: el lector "escanea" el QR dinámico
 * que muestra la app, lo valida de verdad (token SHA-256 por ventana de 30 s), abre la puerta
 * del casillero y el sensor de peso confirma el retiro.
 */
export default function LockerTotemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrder(id);
  const insets = useSafeAreaInsets();
  const width = useContentWidth();
  const verify = useOrders((s) => s.verify);
  const fastForward = useOrders((s) => s.fastForward);
  const now = useNow(1000, !!order && !order.verifiedAt);
  const [phase, setPhase] = useState<Phase>(order?.verifiedAt ? 'done' : 'idle');
  const [error, setError] = useState<string>();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { payload } = useDynamicQr(order, phase === 'idle' || phase === 'scanning' || phase === 'error');

  // Láser del lector y parpadeo del casillero asignado.
  const laser = useSharedValue(0);
  const blink = useSharedValue(1);
  useEffect(() => {
    blink.value = withRepeat(withSequence(withTiming(0.35, { duration: 550 }), withTiming(1, { duration: 550 })), -1);
    return () => cancelAnimation(blink);
  }, [blink]);
  useEffect(() => {
    if (phase === 'scanning') {
      laser.value = 0;
      laser.value = withRepeat(withTiming(VIEWPORT - 4, { duration: 450 }), -1, true);
    } else {
      cancelAnimation(laser);
    }
  }, [phase, laser]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const laserStyle = useAnimatedStyle(() => ({ transform: [{ translateY: laser.value }] }));
  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  if (!order) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + space.xl, alignItems: 'center' }]}>
        <Txt variant="headlineMd" color={colors.white}>
          Pedido no encontrado
        </Txt>
        <Button label="Cerrar" variant="ghost" full={false} onPress={() => router.back()} />
      </View>
    );
  }

  const store = getStore(order.storeId);
  const slots = assignLockers(order, store);
  const occupied = occupiedLockers(store, slots);
  const total = lockerCapacity(store);
  const status = getOrderStatus(order, now);
  const ready = status.phase === 'completed' || (status.phase === 'active' && status.step === 2);
  const opened = phase === 'open' || phase === 'weight' || phase === 'done';
  const codes = slots.map((s) => `#${s.code}`).join(' y ');
  const cell = (width - space.lg * 2 - space.sm * (LOCKER_COLUMNS - 1)) / LOCKER_COLUMNS;

  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));

  const scan = async (ageWindows = 0) => {
    setError(undefined);
    setPhase('scanning');
    haptic.tap();
    const t0 = Date.now();
    // El lector lee el QR que la app muestra ahora (o uno viejo, para demostrar la seguridad).
    const read = await payloadFor(order, Date.now() - ageWindows * TOKEN_WINDOW_MS);
    const result = await verifyPayload(read, order, Date.now());
    later(Math.max(0, SCAN_MS - (Date.now() - t0)), () => {
      if (!result.ok) {
        haptic.warning();
        setError(VERIFY_MESSAGE[result.reason]);
        setPhase('error');
        return;
      }
      haptic.success();
      setPhase('open');
      later(DOOR_MS, () => {
        setPhase('weight');
        later(DOOR_MS, () => {
          verify(order.id);
          haptic.success();
          setPhase('done');
        });
      });
    });
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Row style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <View style={{ flex: 1 }}>
          <Txt variant="labelSm" color={colors.gold}>
            TÓTEM TAMBO SMART LOCKER
          </Txt>
          <Txt variant="headlineMd" color={colors.white} numberOfLines={1}>
            {store.name}
          </Txt>
        </View>
        <Badge label="Simulador IoT" tone="promo" icon="access-point" />
        <IconButton icon="close" label="Cerrar tótem" color={colors.white} onPress={() => router.back()} />
      </Row>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xl }]}>
        {/* Casilleros físicos */}
        <View style={styles.grid}>
          {Array.from({ length: total }, (_, index) => {
            const slot = slots.find((s) => s.index === index);
            const busy = occupied.has(index);
            return (
              <LockerCell
                key={index}
                size={cell}
                index={index}
                slot={slot}
                busy={busy}
                opened={!!slot && opened}
                blinkStyle={slot && !opened && ready ? blinkStyle : undefined}
              />
            );
          })}
        </View>
        <Row style={{ justifyContent: 'center', gap: space.lg }}>
          <Legend color={colors.gold} label="Tu casillero" />
          <Legend color="rgba(255,255,255,0.25)" label="Ocupado" />
          <Legend color="rgba(255,255,255,0.08)" label="Libre" />
        </Row>

        {/* Lector */}
        <View style={styles.reader}>
          {!ready ? (
            <View style={{ alignItems: 'center', gap: space.sm }}>
              <Icon name="chef-hat" size={36} color={colors.gold} />
              <Txt variant="headlineMd" color={colors.white} align="center">
                Tu pedido aún se está preparando
              </Txt>
              <Txt variant="bodySm" color="rgba(255,255,255,0.75)" align="center">
                El casillero se activará cuando la tienda lo deje listo.
              </Txt>
              <DemoOnly style={{ alignSelf: 'stretch' }}>
                <Button
                  label="Adelantar a listo"
                  icon="fast-forward"
                  variant="outline"
                  size="sm"
                  onPress={() => fastForward(order.id, DEMO_TIMELINE.pickupReady - orderClock(order, Date.now()).t)}
                />
              </DemoOnly>
            </View>
          ) : phase === 'done' ? (
            <Animated.View entering={ZoomIn.springify().damping(14)} style={{ alignItems: 'center', gap: space.sm }}>
              <View style={styles.doneIcon}>
                <Icon name="check-decagram" size={44} color={colors.white} />
              </View>
              <Txt variant="headlineLg" color={colors.white} align="center">
                Retiro verificado por IoT
              </Txt>
              <Txt variant="bodyMd" color="rgba(255,255,255,0.8)" align="center">
                Casillero {codes} cerrado y liberado. ¡Buen provecho!
              </Txt>
              <Button label="Volver a mi pedido" icon="arrow-left" onPress={() => router.back()} />
            </Animated.View>
          ) : (
            <View style={{ alignItems: 'center', gap: space.md }}>
              <Txt variant="labelLg" color={colors.white}>
                {phase === 'open' || phase === 'weight' ? 'Puerta abierta' : 'Acerca tu QR al lector'}
              </Txt>
              <View style={styles.viewport}>
                {payload ? (
                  <QrCode value={payload} size={VIEWPORT - 20} color={colors.primaryDark} />
                ) : (
                  <Icon name="qrcode" size={64} color={colors.borderStrong} />
                )}
                {phase === 'scanning' && <Animated.View style={[styles.laser, laserStyle]} />}
                {(phase === 'open' || phase === 'weight') && (
                  <Animated.View entering={FadeIn} style={styles.viewportOk}>
                    <Icon name="lock-open-variant" size={56} color={colors.white} />
                  </Animated.View>
                )}
              </View>
              {phase === 'scanning' && (
                <Txt variant="labelMd" color={colors.gold}>
                  Leyendo código y validando token…
                </Txt>
              )}
              {(phase === 'open' || phase === 'weight') && (
                <Animated.View entering={FadeInDown} style={{ alignItems: 'center', gap: 4 }}>
                  <Txt variant="headlineMd" color={colors.white} align="center">
                    Casillero {codes} abierto
                  </Txt>
                  {phase === 'weight' && (
                    <Animated.View entering={FadeIn}>
                      <Row style={{ gap: 6 }}>
                        <Icon name="scale" size={18} color={colors.gold} />
                        <Txt variant="bodyMd" color={colors.gold}>
                          Sensor de peso: se detectó el retiro de tu bolsa
                        </Txt>
                      </Row>
                    </Animated.View>
                  )}
                </Animated.View>
              )}
              {phase === 'error' && error && (
                <Animated.View entering={FadeIn} style={styles.error}>
                  <Icon name="alert-circle-outline" size={18} color={colors.white} />
                  <Txt variant="labelMd" color={colors.white} style={{ flex: 1 }}>
                    {error}
                  </Txt>
                </Animated.View>
              )}
              {(phase === 'idle' || phase === 'error' || phase === 'scanning') && (
                <Button
                  label={phase === 'scanning' ? 'Escaneando…' : 'Escanear QR en el casillero'}
                  icon="qrcode-scan"
                  size="lg"
                  loading={phase === 'scanning'}
                  onPress={() => scan()}
                />
              )}
              <DemoOnly style={{ alignSelf: 'stretch' }} label="Modo demo · seguridad">
                <Button
                  label="Probar con un QR vencido (captura vieja)"
                  icon="clock-alert-outline"
                  variant="outline"
                  size="sm"
                  disabled={phase === 'scanning' || phase === 'open' || phase === 'weight'}
                  onPress={() => scan(3)}
                />
              </DemoOnly>
            </View>
          )}
        </View>
        <Txt variant="bodySm" color="rgba(255,255,255,0.6)" align="center">
          Token dinámico SHA-256 por ventana de 30 s • Cerradura y sensores simulados
        </Txt>
      </ScrollView>
    </View>
  );
}

function LockerCell({
  size,
  index,
  slot,
  busy,
  opened,
  blinkStyle,
}: {
  size: number;
  index: number;
  slot?: LockerSlot;
  busy: boolean;
  opened: boolean;
  blinkStyle?: ReturnType<typeof useAnimatedStyle>;
}) {
  const bg = slot
    ? opened
      ? colors.success
      : colors.gold
    : busy
      ? 'rgba(255,255,255,0.25)'
      : 'rgba(255,255,255,0.08)';
  const fg = slot ? (opened ? colors.white : colors.onGold) : 'rgba(255,255,255,0.7)';
  return (
    <Animated.View
      style={[styles.cell, { width: size, height: size * 0.92, backgroundColor: bg }, blinkStyle]}
      accessibilityLabel={`Casillero ${lockerCode(index)}${slot ? ', tu casillero' : busy ? ', ocupado' : ', libre'}`}
    >
      <Txt variant="labelSm" color={fg} style={{ fontSize: 10 }}>
        {lockerCode(index)}
      </Txt>
      {slot ? (
        <Icon name={opened ? 'lock-open-variant' : ZONE_META[slot.zone].icon} size={16} color={fg} />
      ) : (
        busy && <Icon name="lock" size={12} color={fg} />
      )}
    </Animated.View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Row style={{ gap: 4 }}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color }} />
      <Txt variant="bodySm" color="rgba(255,255,255,0.8)">
        {label}
      </Txt>
    </Row>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primaryDark },
  top: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.sm },
  body: { padding: space.lg, gap: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  reader: {
    padding: space.lg,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  viewport: {
    width: VIEWPORT,
    height: VIEWPORT,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.gold,
  },
  laser: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.magenta,
  },
  viewportOk: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.error,
    alignSelf: 'stretch',
  },
});
