import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReferenceChips } from '@/components/delivery';
import { Icon, type IconName } from '@/components/Icon';
import { addressMarker, ADDRESS_MARKER_PREFIX, storeIdOf, storeMarker, userMarker } from '@/components/map/markers';
import { SmartMap } from '@/components/map/SmartMap';
import type { MapCircle, MapMarker } from '@/components/map/types';
import { DoubleTapHint, openStoreInMaps, StarRating, StoreMeta } from '@/components/store';
import { Badge, Button, IconButton, Row, Tap, Txt } from '@/components/ui';
import { DEMO_USER_LABEL, getStore, isCurrentStore, MY_LOCATION_ADDRESS_ID } from '@/data/stores';
import type { Address, LatLng, Store } from '@/data/types';
import { haptic } from '@/lib/feedback';
import {
  addressCoords,
  COVERAGE_METERS,
  DELIVERY_RANGE_METERS,
  deliveryStoreFor,
  formatDistance,
  haversine,
  storesByDistance,
  walkingMinutes,
  walkingRoute,
} from '@/lib/geo';
import { addressKind, myLocationLabel, usePickupReference, type PickupReference } from '@/lib/pickupReference';
import { useContentWidth } from '@/lib/useContentWidth';
import { useDoubleTap } from '@/lib/useDoubleTap';
import { useUserLocation, type UserLocation } from '@/lib/useUserLocation';
import { useSession } from '@/store/session';
import { toast } from '@/store/ui';
import { colors, elevation, radius, space } from '@/theme/tokens';

const CARD_GAP = space.md;
const CAROUSEL_HEIGHT = 236;

type Focus = { point: LatLng; zoom?: number; key: number };

/**
 * Mapa a pantalla completa (se abre con "Ampliar mapa"). Para llevar: tiendas reales alrededor del
 * punto de "Recoger cerca de…", con carrusel sincronizado. Delivery: tus direcciones, la tienda que
 * atiende cada una y su radio de cobertura. Elegir actualiza la sesión y cierra, igual que el sheet.
 */
export default function MapaScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const width = useContentWidth();
  const cardWidth = width - space.xxl * 2 - CARD_GAP;
  const [focus, setFocus] = useState<Focus>();
  const user = useUserLocation();

  const flyTo = (point: LatLng, zoom?: number) => setFocus((f) => ({ point, zoom, key: (f?.key ?? 0) + 1 }));

  const shared = {
    cardWidth,
    focus,
    flyTo,
    mapHeight: height,
    topInset: insets.top,
    user,
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {mode === 'delivery' ? <DeliveryMap {...shared} /> : <PickupMap {...shared} />}
    </View>
  );
}

type SharedProps = {
  cardWidth: number;
  focus?: Focus;
  flyTo: (point: LatLng, zoom?: number) => void;
  mapHeight: number;
  topInset: number;
  user: UserLocation;
};

/** Carrusel con snap: desplazar a una tarjeta e índice de la tarjeta visible. */
function useCarousel<T>(cardWidth: number) {
  const list = useRef<FlatList<T>>(null);
  const step = cardWidth + CARD_GAP;
  const scrollTo = (index: number) => list.current?.scrollToOffset({ offset: index * step, animated: true });
  const indexOf = (e: NativeSyntheticEvent<NativeScrollEvent>) => Math.round(e.nativeEvent.contentOffset.x / step);
  return { list, scrollTo, indexOf, step };
}

/* ——— Para llevar ——— */

function PickupMap({ cardWidth, focus, flyTo, mapHeight, topInset, user }: SharedProps) {
  const storeId = useSession((s) => s.storeId);
  const addresses = useSession((s) => s.addresses);
  const selectStore = useSession((s) => s.selectStore);
  const setFulfillment = useSession((s) => s.setFulfillment);
  const ref = usePickupReference();
  const refAddress = addresses.find((a) => a.id === ref.id);
  const nearby = useMemo(
    () =>
      storesByDistance(ref.coords).map((n) => ({ ...n, walk: walkingRoute(ref.coords, n.store).meters })),
    [ref.coords],
  );
  const [focusedId, setFocusedId] = useState(isCurrentStore(storeId) ? storeId : nearby[0].store.id);
  const { list, scrollTo, indexOf, step } = useCarousel<(typeof nearby)[number]>(cardWidth);

  const focusStore = (id: string, scroll: boolean) => {
    const index = nearby.findIndex((n) => n.store.id === id);
    if (index < 0) return;
    setFocusedId(id);
    flyTo(nearby[index].store.coords);
    if (scroll) scrollTo(index);
  };
  const cardTaps = useDoubleTap(
    () => {},
    (id) => openStoreInMaps(getStore(id)),
  );

  const choose = (store: Store) => {
    selectStore(store.id);
    setFulfillment('pickup');
    haptic.success();
    toast(`Recogerás en ${store.name}`, { tone: 'success' });
    router.back();
  };

  const markers: MapMarker[] = [
    userMarker(user.coords),
    ...(refAddress ? [addressMarker(refAddress)] : []),
    ...nearby.map((n) => storeMarker(n.store, n.store.id === focusedId)),
  ];

  return (
    <>
      <SmartMap
        height={mapHeight}
        markers={markers}
        circles={[{ id: 'coverage', center: ref.coords, radius: COVERAGE_METERS, tone: 'user' }]}
        fit={[ref.coords, ...nearby.slice(0, 3).map((n) => n.store.coords)]}
        fitPadding={{ top: topInset + 110, bottom: CAROUSEL_HEIGHT + 24 }}
        focus={focus}
        controlsInset={CAROUSEL_HEIGHT + 8}
        onMarkerPress={(id) => {
          const sid = storeIdOf(id);
          if (sid) focusStore(sid, true);
        }}
        onMarkerDoublePress={(id) => {
          const sid = storeIdOf(id);
          if (sid) openStoreInMaps(getStore(sid));
        }}
        fallback={<MapFallback />}
      />
      <TopBar topInset={topInset} title="Tiendas Tambo cerca">
        <ReferenceChips
          onChange={(r: PickupReference) => {
            setFocusedId(storesByDistance(r.coords)[0].store.id);
            scrollTo(0);
          }}
        />
      </TopBar>
      <CenterButton
        onPress={() => flyTo(ref.coords, 16)}
        label={ref.id === 'me' ? 'Centrar en mí' : `Centrar en ${ref.label}`}
      />
      <View style={styles.carousel} pointerEvents="box-none">
        <DoubleTapHint style={styles.hint} />
        <FlatList
          ref={list}
          data={nearby}
          horizontal
          keyExtractor={(n) => n.store.id}
          showsHorizontalScrollIndicator={false}
          snapToInterval={step}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: space.xxl, gap: CARD_GAP }}
          onMomentumScrollEnd={(e) => {
            const n = nearby[indexOf(e)];
            if (n && n.store.id !== focusedId) focusStore(n.store.id, false);
          }}
          renderItem={({ item: { store, walk } }) => {
            const focused = store.id === focusedId;
            return (
              <Tap
                hasNestedControls
                onPress={() => {
                  focusStore(store.id, true);
                  cardTaps.tap(store.id);
                }}
                pressedStyle={{ opacity: 0.95 }}
                style={[styles.card, { width: cardWidth }, focused && styles.cardFocused]}
                accessibilityLabel={`${store.name}, a ${formatDistance(walk)} de ${ref.fromText}`}
                accessibilityHint="Doble toque para ver en Google Maps"
              >
                <Row style={{ gap: space.sm }}>
                  <View style={[styles.cardIcon, focused && { backgroundColor: colors.primary }]}>
                    <Icon name="storefront-outline" size={18} color={focused ? colors.white : colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="labelLg" weight="bold" numberOfLines={1}>
                      {store.name}
                    </Txt>
                    <Txt variant="bodySm" color={colors.textMuted} numberOfLines={1}>
                      {store.address}
                    </Txt>
                  </View>
                  {store.id === storeId && <Icon name="check-circle" size={20} color={colors.primary} />}
                </Row>
                <StoreMeta store={store} />
                <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                  <Badge
                    label={`${formatDistance(walk)} • ${walkingMinutes(walk)} min a pie`}
                    tone="soft"
                    icon="walk"
                  />
                  {store.lockers && (
                    <Badge
                      label={store.lockers.free ? `${store.lockers.free} lockers libres` : 'Sin lockers libres'}
                      tone={store.lockers.free ? 'success' : 'neutral'}
                      icon="locker-multiple"
                    />
                  )}
                </Row>
                <Row style={{ gap: space.sm }}>
                  <Button
                    label="Elegir para recoger"
                    size="sm"
                    style={{ flex: 1 }}
                    onPress={() => choose(store)}
                  />
                  <MapsLink onPress={() => openStoreInMaps(store)} />
                </Row>
              </Tap>
            );
          }}
        />
      </View>
    </>
  );
}

/* ——— Delivery ——— */

type DropItem = {
  id: string;
  label: string;
  line: string;
  coords: LatLng;
  icon: IconName;
  store: Store;
  meters: number;
  /** undefined = "Mi ubicación" aún no guardada como dirección. */
  address?: Address;
};

const ICONS = { home: 'home-outline', office: 'briefcase-outline', place: 'map-marker-outline' } as const;

function DeliveryMap({ cardWidth, focus, flyTo, mapHeight, topInset, user }: SharedProps) {
  const addresses = useSession((s) => s.addresses);
  const addressId = useSession((s) => s.addressId);
  const selectAddress = useSession((s) => s.selectAddress);
  const saveAddress = useSession((s) => s.saveAddress);
  const setFulfillment = useSession((s) => s.setFulfillment);

  const items = useMemo<DropItem[]>(() => {
    const fromAddress = (a: Address): DropItem => {
      const store = deliveryStoreFor(a);
      const coords = addressCoords(a);
      return {
        id: a.id,
        label: a.label,
        line: `${a.line1}, ${a.district}`,
        coords,
        icon: ICONS[addressKind(a)],
        store,
        meters: haversine(coords, store.coords),
        address: a,
      };
    };
    const saved = addresses.map(fromAddress);
    if (addresses.some((a) => a.id === MY_LOCATION_ADDRESS_ID)) return saved;
    const store = storesByDistance(user.coords)[0].store;
    const me: DropItem = {
      id: MY_LOCATION_ADDRESS_ID,
      label: myLocationLabel(user),
      line: user.source === 'gps' ? 'Ubicación GPS actual' : `${DEMO_USER_LABEL}, Rímac`,
      coords: user.coords,
      icon: 'crosshairs-gps',
      store,
      meters: haversine(user.coords, store.coords),
    };
    return [...saved, me];
  }, [addresses, user]);

  const [focusedId, setFocusedId] = useState(items.find((i) => i.id === addressId)?.id ?? items[0]?.id);
  const focused = items.find((i) => i.id === focusedId);
  const { list, scrollTo, indexOf, step } = useCarousel<DropItem>(cardWidth);

  const focusItem = (id: string, scroll: boolean) => {
    const index = items.findIndex((i) => i.id === id);
    if (index < 0) return;
    setFocusedId(id);
    flyTo(items[index].coords, 15);
    if (scroll) scrollTo(index);
  };

  const deliverHere = (item: DropItem) => {
    let id = item.id;
    if (!item.address) {
      // "Mi ubicación" se guarda como dirección para poder despachar ahí (sin geocodificar).
      const a: Address = {
        id: MY_LOCATION_ADDRESS_ID,
        label: 'Mi ubicación',
        line1:
          user.source === 'gps'
            ? 'Ubicación GPS actual'
            : `${DEMO_USER_LABEL} (Facultad de Ingeniería Industrial y de Sistemas)`,
        district: user.source === 'gps' ? 'Lima' : 'Rímac, Lima',
        coords: user.coords,
      };
      saveAddress(a);
      id = a.id;
    }
    selectAddress(id);
    setFulfillment('delivery');
    haptic.success();
    toast(`Entregaremos en ${item.label}`, { tone: 'success' });
    router.back();
  };

  // Tiendas que atienden alguna dirección (sin repetir) y su radio de delivery.
  const serving = [...new Map(items.map((i) => [i.store.id, i.store])).values()];
  const circles: MapCircle[] = serving.map((s) => ({
    id: `range:${s.id}`,
    center: s.coords,
    radius: DELIVERY_RANGE_METERS,
  }));
  const markers: MapMarker[] = [
    userMarker(user.coords),
    ...items.flatMap((i) => (i.address ? [addressMarker(i.address)] : [])),
    ...serving.map((s) => storeMarker(s, s.id === focused?.store.id)),
  ];

  return (
    <>
      <SmartMap
        height={mapHeight}
        markers={markers}
        circles={circles}
        fit={items.map((i) => i.coords)}
        fitPadding={{ top: topInset + 80, bottom: CAROUSEL_HEIGHT + 24 }}
        focus={focus}
        controlsInset={CAROUSEL_HEIGHT + 8}
        onMarkerPress={(id) => {
          if (id === 'user') return focusItem(items.find((i) => !i.address)?.id ?? MY_LOCATION_ADDRESS_ID, true);
          if (id.startsWith(ADDRESS_MARKER_PREFIX)) return focusItem(id.slice(ADDRESS_MARKER_PREFIX.length), true);
          const sid = storeIdOf(id);
          const served = sid && items.find((i) => i.store.id === sid);
          if (served) focusItem(served.id, true);
        }}
        onMarkerDoublePress={(id) => {
          const sid = storeIdOf(id);
          if (sid) openStoreInMaps(getStore(sid));
        }}
        fallback={<MapFallback />}
      />
      <TopBar topInset={topInset} title="¿Dónde te lo llevamos?">
        <Txt variant="bodySm" color={colors.textMuted}>
          Cada dirección la atiende la tienda más cercana (radio de {formatDistance(DELIVERY_RANGE_METERS)})
        </Txt>
      </TopBar>
      <CenterButton onPress={() => flyTo(user.coords, 16)} label="Centrar en mí" />
      <View style={styles.carousel} pointerEvents="box-none">
        <FlatList
          ref={list}
          data={items}
          horizontal
          keyExtractor={(i) => i.id}
          showsHorizontalScrollIndicator={false}
          snapToInterval={step}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: space.xxl, gap: CARD_GAP }}
          onMomentumScrollEnd={(e) => {
            const item = items[indexOf(e)];
            if (item && item.id !== focusedId) focusItem(item.id, false);
          }}
          renderItem={({ item }) => {
            const isFocused = item.id === focusedId;
            const covered = item.meters <= DELIVERY_RANGE_METERS;
            return (
              <Tap
                hasNestedControls
                onPress={() => focusItem(item.id, true)}
                pressedStyle={{ opacity: 0.95 }}
                style={[styles.card, { width: cardWidth }, isFocused && styles.cardFocused]}
                accessibilityLabel={`${item.label}, ${item.line}`}
              >
                <Row style={{ gap: space.sm }}>
                  <View style={[styles.cardIcon, isFocused && { backgroundColor: colors.primary }]}>
                    <Icon name={item.icon} size={18} color={isFocused ? colors.white : colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="labelLg" weight="bold" numberOfLines={1}>
                      {item.label}
                    </Txt>
                    <Txt variant="bodySm" color={colors.textMuted} numberOfLines={1}>
                      {item.line}
                    </Txt>
                  </View>
                  {item.id === addressId && <Icon name="check-circle" size={20} color={colors.primary} />}
                </Row>
                <Row style={{ gap: 4 }}>
                  <Icon
                    name={covered ? 'storefront-outline' : 'map-marker-off-outline'}
                    size={14}
                    color={covered ? colors.success : colors.error}
                  />
                  <Txt
                    variant="bodySm"
                    color={covered ? colors.success : colors.error}
                    numberOfLines={1}
                    style={{ flex: 1 }}
                  >
                    {covered
                      ? `Te atiende ${item.store.name} (${formatDistance(item.meters)})`
                      : 'Fuera de cobertura delivery'}
                  </Txt>
                </Row>
                <StarRating rating={item.store.rating} reviews={item.store.reviews} />
                <Row style={{ gap: space.sm }}>
                  <Button label="Entregar aquí" size="sm" style={{ flex: 1 }} onPress={() => deliverHere(item)} />
                  <MapsLink onPress={() => openStoreInMaps(item.store)} />
                </Row>
              </Tap>
            );
          }}
        />
      </View>
    </>
  );
}

/* ——— Piezas comunes ——— */

function TopBar({ topInset, title, children }: { topInset: number; title: string; children: React.ReactNode }) {
  return (
    <View style={[styles.topBar, { paddingTop: topInset + space.sm }]}>
      <Row style={{ gap: space.sm }}>
        <IconButton icon="arrow-left" label="Volver" onPress={() => router.back()} bg={colors.surfaceMid} size={40} />
        <Txt variant="headlineMd" style={{ flex: 1 }} numberOfLines={1}>
          {title}
        </Txt>
      </Row>
      {children}
    </View>
  );
}

function CenterButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Tap onPress={onPress} style={styles.center} accessibilityLabel={label}>
      <Icon name="crosshairs-gps" size={18} color={colors.userLocation} />
      <Txt variant="labelMd" weight="bold" numberOfLines={1}>
        {label}
      </Txt>
    </Tap>
  );
}

function MapsLink({ onPress }: { onPress: () => void }) {
  return (
    <Tap onPress={onPress} style={styles.mapsLink} accessibilityLabel="Ver en Google Maps" hitSlop={6}>
      <Icon name="google-maps" size={18} color={colors.primary} />
      <Txt variant="labelMd" weight="bold" color={colors.primary}>
        Ver en Google Maps
      </Txt>
    </Tap>
  );
}

function MapFallback() {
  return (
    <View style={styles.fallback}>
      <Icon name="map-outline" size={32} color={colors.textMuted} />
      <Txt variant="bodySm" color={colors.textMuted}>
        Mapa no disponible sin conexión: elige en las tarjetas
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMid },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    backgroundColor: colors.background,
    borderBottomLeftRadius: radius.sheet,
    borderBottomRightRadius: radius.sheet,
    ...elevation.float,
  },
  center: {
    position: 'absolute',
    right: space.lg,
    bottom: CAROUSEL_HEIGHT + space.md,
    maxWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    ...elevation.float,
  },
  carousel: { position: 'absolute', left: 0, right: 0, bottom: space.lg },
  hint: {
    alignSelf: 'center',
    marginBottom: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.white,
  },
  card: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    ...elevation.float,
  },
  cardFocused: { borderColor: colors.primary },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapsLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.xs },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingHorizontal: space.xl,
    backgroundColor: colors.surfaceMid,
  },
});
