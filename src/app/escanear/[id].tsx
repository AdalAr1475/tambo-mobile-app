import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DemoOnly } from '@/components/DemoOnly';
import { Icon, type IconName } from '@/components/Icon';
import { Button, IconButton, Row, Txt } from '@/components/ui';
import { getStore, stores } from '@/data/stores';
import { time12 } from '@/lib/format';
import { haptic } from '@/lib/feedback';
import { DEMO_LOCKER_PAYLOAD, validateLockerQr, type LockerQrResult } from '@/lib/lockerQr';
import { assignLockers } from '@/lib/lockers';
import { DEMO_TIMELINE, getOrderStatus, orderClock } from '@/lib/orderProgress';
import { useContentWidth } from '@/lib/useContentWidth';
import { useOrder, useOrders } from '@/store/orders';
import { colors, radius, space } from '@/theme/tokens';

type ScanState = { kind: 'scanning' } | { kind: 'error'; title: string; message: string; icon: IconName };

const isWeb = Platform.OS === 'web';

/**
 * Escáner del QR del casillero Tambo Smart Locker. En el casillero el cliente toca "Recoger pedido",
 * la pantalla muestra un QR (`TAMBO-LOCKER:v1:<tienda>`) y la app lo lee con la cámara. Si es válido,
 * verifica el retiro por la misma vía que el tótem (`useOrders.verify` → `verifiedAt`).
 */
export default function LockerScannerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrder(id);
  const verify = useOrders((s) => s.verify);
  const fastForward = useOrders((s) => s.fastForward);
  const insets = useSafeAreaInsets();
  const width = useContentWidth();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraFailed, setCameraFailed] = useState(false);
  const [state, setState] = useState<ScanState>({ kind: 'scanning' });
  // Evita procesar el mismo QR varias veces: la cámara emite lecturas en ráfaga.
  const locked = useRef(false);

  if (!order) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top + space.xl }]}>
        <Txt variant="headlineMd" color={colors.onDark}>
          Pedido no encontrado
        </Txt>
        <Button label="Cerrar" variant="ghost" full={false} onPress={() => router.back()} />
      </View>
    );
  }

  const store = getStore(order.storeId);
  const lockerCodes = assignLockers(order, store)
    .map((s) => `#${s.code}`)
    .join(' y ');
  const { verifiedAt } = order;
  const done = verifiedAt !== undefined;

  const handleScan = (text: string) => {
    if (locked.current || done) return;
    locked.current = true;
    const result = validateLockerQr(text, order, getOrderStatus(order, Date.now()));
    if (result.ok) {
      verify(order.id);
      haptic.success();
      return;
    }
    haptic.warning();
    setState({ kind: 'error', ...errorCopy(result, order.storeId) });
  };

  const retry = () => {
    locked.current = false;
    setState({ kind: 'scanning' });
  };

  const onBarcodeScanned = ({ data }: BarcodeScanningResult) => handleScan(data);

  const cameraReady = !!permission?.granted && !cameraFailed;
  const scanning = !done && state.kind === 'scanning';
  const frame = Math.min(width * 0.68, 280);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {cameraReady && !done && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          active={scanning}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanning ? onBarcodeScanned : undefined}
          onMountError={() => setCameraFailed(true)}
        />
      )}

      <Row style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <View style={{ flex: 1 }}>
          <Txt variant="labelSm" color={colors.gold}>
            ESCANEAR CASILLERO
          </Txt>
          <Txt variant="headlineMd" color={colors.onDark} numberOfLines={1}>
            {store.name}
          </Txt>
        </View>
        <IconButton icon="close" label="Cerrar escáner" color={colors.onDark} onPress={() => router.back()} />
      </Row>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xl }]}
        style={{ flex: 1 }}
      >
        {verifiedAt !== undefined ? (
          <Animated.View entering={ZoomIn.springify().damping(14)} style={[styles.card, styles.center]}>
            <View style={styles.okIcon}>
              <Icon name="check-decagram" size={48} color={colors.white} />
            </View>
            <Txt variant="headlineLg" align="center">
              ¡Recojo validado!
            </Txt>
            <Txt variant="bodyMd" color={colors.textMuted} align="center">
              Casillero {lockerCodes} abierto en {store.name}. Retira tu bolsa y cierra la puerta.
            </Txt>
            <Row style={styles.meta}>
              <Icon name="clock-check-outline" size={18} color={colors.primary} />
              <Txt variant="labelMd">Validado a las {time12(verifiedAt)}</Txt>
            </Row>
            <Button
              label="Volver a mi pedido"
              icon="arrow-left"
              onPress={() => router.replace(`/pedido/seguimiento/${order.id}`)}
            />
          </Animated.View>
        ) : !permission ? (
          <View style={[styles.center, { flex: 1 }]}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ) : !permission.granted || cameraFailed ? (
          <View style={[styles.card, styles.center]}>
            <View style={styles.permIcon}>
              <Icon name={cameraFailed ? 'camera-off-outline' : 'camera-outline'} size={32} color={colors.primary} />
            </View>
            <Txt variant="headlineMd" align="center">
              {cameraFailed ? 'No pudimos abrir la cámara' : 'Necesitamos tu cámara'}
            </Txt>
            <Txt variant="bodyMd" color={colors.textMuted} align="center">
              {cameraFailed
                ? 'Revisa que ninguna otra app la esté usando e inténtalo de nuevo.'
                : 'La usamos solo para leer el QR que aparece en la pantalla del casillero.'}
            </Txt>
            {!cameraFailed &&
              (permission.canAskAgain ? (
                <Button
                  label="Permitir cámara"
                  icon="camera-outline"
                  onPress={() => requestPermission().catch(() => {})}
                />
              ) : isWeb ? (
                <Txt variant="bodySm" color={colors.textMuted} align="center">
                  Habilita la cámara en la configuración del navegador y recarga la página.
                </Txt>
              ) : (
                <Button
                  label="Abrir ajustes"
                  icon="cog-outline"
                  onPress={() => Linking.openSettings().catch(() => {})}
                />
              ))}
          </View>
        ) : (
          <View style={[styles.center, { flex: 1, gap: space.lg }]}>
            <Txt variant="labelLg" color={colors.onDark} align="center">
              En el casillero toca &quot;Recoger pedido&quot; y escanea el código que aparece en la pantalla
            </Txt>
            <View style={[styles.frame, { width: frame, height: frame }]}>
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />
              {state.kind === 'scanning' && <Icon name="qrcode-scan" size={40} color={colors.glassBorder} />}
            </View>
            {state.kind === 'scanning' && (
              <Txt variant="labelMd" color={colors.gold}>
                Buscando el QR del casillero…
              </Txt>
            )}
          </View>
        )}

        {state.kind === 'error' && !done && (
          <Animated.View entering={FadeIn} style={[styles.card, styles.center]}>
            <View style={styles.errIcon}>
              <Icon name={state.icon} size={30} color={colors.error} />
            </View>
            <Txt variant="headlineMd" align="center">
              {state.title}
            </Txt>
            <Txt variant="bodyMd" color={colors.textMuted} align="center">
              {state.message}
            </Txt>
            <Button label="Volver a escanear" icon="qrcode-scan" onPress={retry} />
          </Animated.View>
        )}

        {isWeb && !done && (
          <Row style={styles.notice}>
            <Icon name="information-outline" size={18} color={colors.onDark} />
            <Txt variant="bodySm" color={colors.onDark} style={{ flex: 1 }}>
              En la web la cámara puede no estar disponible. Para la demo, escanea desde tu celular con Expo Go.
            </Txt>
          </Row>
        )}

        {!done && (
          <DemoOnly>
            <Button
              label="Simular escaneo del casillero"
              icon="qrcode-scan"
              variant="outline"
              size="sm"
              disabled={state.kind === 'error'}
              onPress={() => handleScan(DEMO_LOCKER_PAYLOAD)}
            />
            <Button
              label="Adelantar a listo para retirar"
              icon="fast-forward"
              variant="outline"
              size="sm"
              onPress={() => fastForward(order.id, DEMO_TIMELINE.pickupReady - orderClock(order, Date.now()).t)}
            />
          </DemoOnly>
        )}
      </ScrollView>
    </View>
  );
}

function errorCopy(result: Exclude<LockerQrResult, { ok: true }>, orderStoreId: string) {
  const storeName = (id: string) => stores.find((s) => s.id === id)?.name;
  switch (result.reason) {
    case 'wrong-store': {
      const other = result.qr ? storeName(result.qr.storeId) : undefined;
      return {
        title: 'Casillero de otro Tambo',
        message: `Este QR es de ${other ?? 'otro Tambo'}. Tu pedido te espera en ${getStore(orderStoreId).name}.`,
        icon: 'store-alert-outline' as IconName,
      };
    }
    case 'not-ready':
      return {
        title: 'Tu pedido aún no está listo',
        message: 'Te avisaremos cuando la tienda lo deje en el casillero. Vuelve a escanear en unos minutos.',
        icon: 'chef-hat' as IconName,
      };
    case 'already-picked':
      return {
        title: 'Este pedido ya fue recogido',
        message: 'El retiro ya está verificado. Si tienes un problema, escríbenos desde Ayuda.',
        icon: 'shopping-outline' as IconName,
      };
    case 'not-pickup':
      return {
        title: 'Este pedido no va al casillero',
        message: 'Solo los pedidos "Para llevar" con Smart Locker se retiran escaneando el casillero.',
        icon: 'locker-multiple' as IconName,
      };
    default:
      return {
        title: 'QR no reconocido',
        message: 'Este código no es de un Tambo Smart Locker. Escanea el QR que aparece en la pantalla del casillero.',
        icon: 'qrcode-remove' as IconName,
      };
  }
}

const CORNER = 28;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primaryDark },
  center: { alignItems: 'center', justifyContent: 'center' },
  top: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    gap: space.sm,
    backgroundColor: colors.glassDark,
  },
  body: { flexGrow: 1, padding: space.lg, gap: space.lg },
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  frame: { alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: colors.gold },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: radius.md },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: radius.md },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: radius.md },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: radius.md },
  okIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.errorSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.full,
    backgroundColor: colors.primaryTint,
  },
  notice: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
});
