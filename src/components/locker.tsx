import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { Order, Store } from '@/data/types';
import { time12 } from '@/lib/format';
import { haptic } from '@/lib/feedback';
import {
  assignLockers,
  lockerPin,
  lockerWindow,
  useLockerTelemetry,
  ZONE_META,
  type LockerSlot,
} from '@/lib/lockers';
import { scanAndVerify, TOKEN_WINDOW_MS, useDynamicQr, VERIFY_MESSAGE } from '@/lib/token';
import { useNow } from '@/store/orders';
import { toast } from '@/store/ui';
import { colors, radius, space } from '@/theme/tokens';
import { DemoOnly } from './DemoOnly';
import { Icon } from './Icon';
import { CountdownRing, QrCode } from './qr';
import { Badge, Button, Card, Divider, Row, Txt } from './ui';

/** QR dinámico + cuenta regresiva + PIN de respaldo. */
export function DynamicQr({ order, size = 184 }: { order: Order; size?: number }) {
  const { payload, secondsLeft } = useDynamicQr(order);
  return (
    <View style={{ alignItems: 'center', gap: space.sm }}>
      <View style={[styles.qrFrame, { width: size + space.lg, height: size + space.lg }]}>
        {payload ? (
          <Animated.View key={payload} entering={FadeIn.duration(250)}>
            <QrCode value={payload} size={size} color={colors.primaryDark} />
          </Animated.View>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
      <Row style={{ gap: 6 }}>
        <CountdownRing value={secondsLeft} total={TOKEN_WINDOW_MS / 1000} size={20} />
        <Txt variant="bodySm" color={colors.textMuted}>
          Código dinámico: cambia en {secondsLeft} s
        </Txt>
      </Row>
      <Row style={styles.pin}>
        <Txt variant="labelSm" color={colors.textMuted}>
          PIN DE RESPALDO
        </Txt>
        <Txt variant="headlineMd" color={colors.primaryDark} style={{ letterSpacing: 6 }}>
          {lockerPin(order)}
        </Txt>
      </Row>
    </View>
  );
}

/** Mini gráfico de barras con las últimas lecturas de temperatura. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (
    <Row style={{ gap: 2, alignItems: 'flex-end', height: 18 }}>
      {values.map((v, i) => (
        <View
          key={i}
          style={{
            width: 3,
            borderRadius: 1,
            height: 4 + (max === min ? 7 : ((v - min) / (max - min)) * 14),
            backgroundColor: color,
            opacity: 0.35 + (i / values.length) * 0.65,
          }}
        />
      ))}
    </Row>
  );
}

function CompartmentRow({ slot }: { slot: LockerSlot }) {
  const meta = ZONE_META[slot.zone];
  const { temp, history } = useLockerTelemetry(slot.zone);
  const tint = slot.zone === 'cold' ? colors.primary : slot.zone === 'hot' ? colors.magenta : colors.textMuted;
  return (
    <Row style={styles.compartment}>
      <View style={styles.lockerCode}>
        <Txt variant="labelSm" color={colors.gold}>
          CASILLERO
        </Txt>
        <Txt variant="headlineLg" weight="extrabold" color={colors.white}>
          #{slot.code}
        </Txt>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Row style={{ gap: 4 }}>
          <Icon name={meta.icon} size={16} color={tint} />
          <Txt variant="labelMd">
            {meta.label} • {temp.toFixed(1)} °C
          </Txt>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Sparkline values={history} color={tint} />
          <Row style={{ gap: 4 }}>
            <Icon name="lock" size={14} color={colors.success} />
            <Txt variant="labelSm" color={colors.success}>
              CERRADO
            </Txt>
          </Row>
        </Row>
      </View>
    </Row>
  );
}

/** Panel del pedido listo en Tambo Smart Locker (seguimiento "Para llevar"). */
export function LockerPanel({ order, store }: { order: Order; store: Store }) {
  const now = useNow(30_000);
  const slots = assignLockers(order, store);
  const { holdUntil } = lockerWindow(order, now);
  const minutesLeft = Math.max(0, Math.round((holdUntil - now) / 60_000));
  return (
    <Card style={styles.panel}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ gap: 6, flexShrink: 1 }}>
          <Icon name="locker-multiple" size={22} color={colors.primary} />
          <Txt variant="headlineMd" style={{ fontSize: 16 }}>
            Tambo Smart Locker asignado
          </Txt>
        </Row>
        <Badge label="IoT en vivo" tone="success" icon="access-point" />
      </Row>
      {slots.map((s) => (
        <CompartmentRow key={s.code} slot={s} />
      ))}
      {slots.length > 1 && (
        <Txt variant="bodySm" color={colors.textMuted}>
          Tu pedido tiene productos fríos y calientes: los separamos en dos compartimentos contiguos.
        </Txt>
      )}
      <Row style={styles.hold}>
        <Icon name="timer-sand" size={18} color={colors.goldText} />
        <Txt variant="bodySm" color={colors.goldText} style={{ flex: 1 }}>
          Guardado hasta las {time12(holdUntil)} ({minutesLeft} min) en {store.name}.
        </Txt>
      </Row>
      <Divider />
      <Txt variant="labelLg" align="center">
        Escanea este QR en el tótem del casillero
      </Txt>
      <DynamicQr order={order} />
      <Button
        label="Abrir casillero"
        icon="lock-open-variant-outline"
        size="lg"
        onPress={() => router.push(`/locker/${order.id}`)}
      />
    </Card>
  );
}

/** Pedido en preparación con retiro por Smart Locker. */
export function LockerPendingCard({ children }: { children?: ReactNode }) {
  return (
    <Card style={[styles.panel, { alignItems: 'center' }]}>
      <View style={styles.pendingIcon}>
        <Icon name="locker-multiple" size={28} color={colors.primary} />
      </View>
      <Txt variant="labelLg" align="center">
        Retiro en Tambo Smart Locker
      </Txt>
      <Txt variant="bodySm" color={colors.textMuted} align="center">
        Te asignaremos un casillero climatizado cuando tu pedido esté listo. Sin colas: solo escaneas tu QR.
      </Txt>
      {children}
    </Card>
  );
}

/** Retiro en mostrador: el cajero escanea el QR (o pide el código). */
export function CounterPickupCard({ order, ready }: { order: Order; ready: boolean }) {
  const [scanning, setScanning] = useState(false);
  const simulate = async () => {
    setScanning(true);
    const result = await scanAndVerify(order);
    setScanning(false);
    if (result.ok) {
      haptic.success();
      toast('Retiro verificado en caja', { tone: 'success', icon: 'check-decagram' });
    } else {
      haptic.warning();
      toast(VERIFY_MESSAGE[result.reason], { tone: 'error' });
    }
  };
  return (
    <Card style={[styles.panel, { alignItems: 'center' }]}>
      <Txt variant="bodyMd" color={colors.textMuted}>
        {ready ? 'Muestra este QR en caja' : 'Tu código de retiro'}
      </Txt>
      <Txt variant="headlineXl" color={colors.primary} style={{ letterSpacing: 4 }}>
        {order.id}
      </Txt>
      {ready ? (
        <>
          <DynamicQr order={order} size={160} />
          <DemoOnly style={{ alignSelf: 'stretch' }}>
            <Button
              label={scanning ? 'Escaneando…' : 'Simular escaneo en caja'}
              icon="barcode-scan"
              variant="outline"
              size="sm"
              disabled={scanning}
              onPress={simulate}
            />
          </DemoOnly>
        </>
      ) : (
        <Txt variant="bodySm" color={colors.textMuted} align="center">
          Te avisaremos cuando esté listo para recoger.
        </Txt>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  panel: { padding: space.lg, gap: space.md },
  qrFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.primarySoft,
    backgroundColor: colors.white,
  },
  pin: {
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMid,
  },
  compartment: {
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceLow,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lockerCode: {
    minWidth: 92,
    alignItems: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.primaryDark,
  },
  hold: {
    gap: 6,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.goldSoft,
  },
  pendingIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
