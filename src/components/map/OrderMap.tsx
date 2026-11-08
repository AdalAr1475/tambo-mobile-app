import { useMemo } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { getStore, rider } from '@/data/stores';
import type { Order } from '@/data/types';
import {
  addressCoords,
  cardinal,
  deliveryRoute,
  formatDistance,
  googleMapsUrl,
  splitRoute,
  walkingMinutes,
  walkingRoute,
  wazeUrl,
  type GeoRoute,
} from '@/lib/geo';
import type { OrderStatus } from '@/lib/orderProgress';
import { useUserLocation } from '@/lib/useUserLocation';
import { toast } from '@/store/ui';
import { colors, elevation, radius, space } from '@/theme/tokens';
import { Icon } from '../Icon';
import { Sheet } from '../Sheet';
import { TrackingMap } from '../tracking';
import { Button, Row, Tap, Txt } from '../ui';
import { SmartMap } from './SmartMap';
import type { MapLine, MapMarker } from './types';

/** Telemetría del delivery: posición de la moto y metros restantes sobre la ruta real. */
export function useDeliveryTelemetry(order: Order, live: OrderStatus) {
  const route = useMemo(() => deliveryRoute(order), [order]);
  const progress = live.phase === 'completed' ? 1 : live.route;
  const split = splitRoute(route.points, progress);
  return { route, progress, ...split, remainingMeters: Math.max(0, route.meters * (1 - progress)) };
}

/** Mapa del seguimiento: moto en vivo (delivery) o ruta a pie a la tienda (para llevar). */
export function OrderMap({
  order,
  live,
  height = 280,
  onDirections,
}: {
  order: Order;
  live: OrderStatus;
  height?: number;
  onDirections?: () => void;
}) {
  const store = getStore(order.storeId);
  const user = useUserLocation();
  const telemetry = useDeliveryTelemetry(order, live);
  const walk = useMemo(() => walkingRoute(user.coords, store), [user.coords, store]);
  const delivery = order.fulfillment === 'delivery';
  const enRoute = delivery && live.phase === 'active' && live.step >= 2;
  const firstName = rider.name.split(' ')[0];

  let markers: MapMarker[];
  let lines: MapLine[];
  let fit;
  let pill: string | undefined;
  if (delivery) {
    const home = addressCoords(order.address);
    markers = [
      { id: 'store', kind: 'store', position: store.coords, label: store.name },
      { id: 'home', kind: 'home', position: home, label: order.address?.label ?? 'Tu dirección' },
      ...(enRoute ? [{ id: 'rider', kind: 'rider' as const, position: telemetry.point }] : []),
    ];
    lines = enRoute
      ? [
          { id: 'travelled', points: telemetry.travelled, style: 'travelled' },
          { id: 'remaining', points: telemetry.remaining, style: 'route' },
        ]
      : [{ id: 'remaining', points: telemetry.route.points, style: live.phase === 'completed' ? 'travelled' : 'route' }];
    fit = [store.coords, home];
    if (live.arrived) pill = `${firstName} llegó a tu puerta`;
    else if (enRoute) pill = `${firstName} • a ${formatDistance(telemetry.remainingMeters)} • ${live.etaMin} min`;
  } else {
    markers = [
      {
        id: 'store',
        kind: 'store',
        position: store.coords,
        label: store.name,
        badge: store.lockers ? `🔒${store.lockers.free}` : undefined,
      },
      { id: 'user', kind: 'user', position: user.coords },
    ];
    lines = [{ id: 'walk', points: walk.points, style: 'walk' }];
    fit = [user.coords, store.coords];
    pill = `A ${formatDistance(walk.meters)} de ti • ${walkingMinutes(walk.meters)} min caminando`;
  }

  return (
    <SmartMap
      height={height}
      interactive={false}
      markers={markers}
      lines={lines}
      fit={fit}
      fallback={
        <TrackingMap
          progress={live.phase === 'completed' ? 1 : live.route}
          showRider={enRoute}
          storeLabel={store.name}
          pickup={!delivery}
          riderLabel={`${firstName} en moto`}
          height={height}
        />
      }
      overlay={
        pill ? (
          <Row style={styles.overlay} pointerEvents="box-none">
            <Row style={styles.pill}>
              <Icon name={delivery ? 'moped' : 'walk'} size={16} color={colors.primary} />
              <Txt variant="labelMd" numberOfLines={1} style={{ flexShrink: 1 }}>
                {pill}
              </Txt>
            </Row>
            {!delivery && onDirections && (
              <Tap onPress={onDirections} style={styles.directions} accessibilityLabel="Cómo llegar a la tienda">
                <Icon name="directions" size={16} color={colors.white} />
                <Txt variant="labelMd" color={colors.white}>
                  Cómo llegar
                </Txt>
              </Tap>
            )}
          </Row>
        ) : undefined
      }
    />
  );
}

/** Indicaciones a pie in-app + enlaces a Google Maps / Waze. */
export function DirectionsSheet({
  visible,
  onClose,
  storeId,
}: {
  visible: boolean;
  onClose: () => void;
  storeId: string;
}) {
  const store = getStore(storeId);
  const user = useUserLocation();
  const route: GeoRoute = useMemo(() => walkingRoute(user.coords, store), [user.coords, store]);
  const steps =
    route.steps && route.steps.length > 0
      ? route.steps
      : [
          { text: `Camina hacia ${cardinal(user.coords, store.coords)}`, meters: route.meters },
          { text: 'Llegas a la tienda', meters: 0 },
        ];
  const open = (url: string) => Linking.openURL(url).catch(() => toast('No pudimos abrir el mapa', { tone: 'error' }));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Cómo llegar"
      subtitle={`${store.name} • ${formatDistance(route.meters)} • ${walkingMinutes(route.meters)} min a pie`}
    >
      <View style={{ gap: space.md }}>
        {steps.map((s, i) => (
          <Row key={i} style={{ gap: space.md, alignItems: 'flex-start' }}>
            <View style={styles.stepDot}>
              <Txt variant="labelSm" color={colors.white}>
                {i + 1}
              </Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="labelMd">{s.text}</Txt>
              {s.meters > 0 && (
                <Txt variant="bodySm" color={colors.textMuted}>
                  {formatDistance(s.meters)}
                </Txt>
              )}
            </View>
          </Row>
        ))}
        {!route.real && (
          <Txt variant="bodySm" color={colors.textMuted}>
            Indicaciones aproximadas: para la ruta exacta ábrela en Google Maps o Waze.
          </Txt>
        )}
        <Button label="Abrir en Google Maps" icon="google-maps" onPress={() => open(googleMapsUrl(store.coords))} />
        <Button label="Abrir en Waze" icon="waze" variant="outline" onPress={() => open(wazeUrl(store.coords))} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: space.xl + space.md,
    gap: space.sm,
    justifyContent: 'center',
  },
  pill: {
    flexShrink: 1,
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    ...elevation.float,
  },
  directions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    ...elevation.float,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
