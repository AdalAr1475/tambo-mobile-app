import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import MapView, {
  Circle,
  Marker,
  Polyline,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  type MapStyleElement,
  type Region,
} from 'react-native-maps';
import type { LatLng } from '@/data/types';
import { DOUBLE_TAP_MS } from '@/lib/useDoubleTap';
import { colors } from '@/theme/tokens';
import { alpha } from './color';
import { pinLayout, PinView } from './pins';
import type { MapLine, MapMarker, MapProps } from './types';

/** Vista inicial: FIIS - UNI (se reemplaza al encuadrar `fit`). */
const INITIAL_REGION: Region = { latitude: -12.016, longitude: -77.0504, latitudeDelta: 0.012, longitudeDelta: 0.012 };
const FOCUS_ZOOM = 16;
const SINGLE_POINT_ZOOM = 16;
const SIDE_PADDING = 40;
/** Tiempo en que el pin sigue redibujándose tras montarse o cambiar (Android lo congela como bitmap). */
const TRACK_MS = 600;
const RIDER_ANIMATION_MS = 900;

/**
 * Estilo de Google Maps (solo Android) = el de siempre, pero sin los pines de otros negocios
 * para que destaquen los de Tambo. En iOS se usa Apple Maps y este estilo se ignora.
 */
const MAP_STYLE: MapStyleElement[] = [{ featureType: 'poi.business', stylers: [{ visibility: 'off' }] }];

const LINE_STYLE: Record<MapLine['style'], { color: string; width: number; dash?: number[] }> = {
  route: { color: alpha(colors.primary, 0.5), width: 5, dash: [10, 10] },
  travelled: { color: colors.primary, width: 5 },
  walk: { color: colors.userLocation, width: 4, dash: [2, 8] },
};

const CIRCLE_STYLE = {
  brand: { stroke: alpha(colors.primary, 0.45), fill: alpha(colors.primary, 0.06) },
  user: { stroke: alpha(colors.userLocation, 0.45), fill: alpha(colors.userLocation, 0.07) },
} as const;

const toCoord = (p: LatLng) => ({ latitude: p.lat, longitude: p.lng });

/** Delta de longitud que muestra `zoom` (escala web Mercator) en un ancho de `width` puntos. */
const deltaForZoom = (zoom: number, width: number) => (360 * (width / 256)) / 2 ** zoom;

const zIndexOf = (m: MapMarker) => (m.kind === 'rider' ? 1000 : m.selected ? 600 : m.kind === 'user' ? 400 : 1);

/**
 * Mapa nativo con react-native-maps: Google Maps en Android y Apple Maps en iOS (incluido en
 * Expo Go, sin API key). Mismo contrato `MapProps` que el mapa Leaflet de web.
 */
export function NativeMap({
  height,
  interactive = true,
  controlsInset = 0,
  markers,
  lines,
  circles,
  fit,
  fitPadding,
  focus,
  onMarkerPress,
  onMarkerDoublePress,
}: MapProps) {
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const width = useRef(360);
  const region = useRef<Region>(INITIAL_REGION);
  const fitKey = useRef('');
  const focusKey = useRef('');
  const lastTap = useRef<{ id: string; at: number } | undefined>(undefined);
  // Los callbacks cambian en cada render del padre: se leen desde una ref.
  const handlers = useRef({ onMarkerPress, onMarkerDoublePress });
  useEffect(() => {
    handlers.current = { onMarkerPress, onMarkerDoublePress };
  });

  // Encuadre de `fit`: sin animación la primera vez, con animación cuando cambia.
  const fitJson = fit && fit.length > 0 ? JSON.stringify(fit) : '';
  useEffect(() => {
    if (!ready || !fitJson || fitJson === fitKey.current) return;
    const first = !fitKey.current;
    fitKey.current = fitJson;
    const points = JSON.parse(fitJson) as LatLng[];
    if (points.length === 1) {
      const delta = deltaForZoom(SINGLE_POINT_ZOOM, width.current);
      map.current?.animateToRegion(
        { ...toCoord(points[0]), latitudeDelta: delta, longitudeDelta: delta },
        first ? 1 : 800,
      );
      return;
    }
    const pad = fitPadding ?? { top: SIDE_PADDING, bottom: SIDE_PADDING };
    map.current?.fitToCoordinates(points.map(toCoord), {
      // mapPadding ya reserva `controlsInset` abajo (en Android se suman).
      edgePadding: {
        top: Math.round(pad.top),
        bottom: Math.round(Math.max(SIDE_PADDING / 2, pad.bottom - controlsInset)),
        left: SIDE_PADDING,
        right: SIDE_PADDING,
      },
      animated: !first,
    });
  }, [ready, fitJson, fitPadding, controlsInset]);

  // Vuelo a `focus` (selección en el carrusel o "Centrar en mí"); sin alejar si ya estás más cerca.
  const focusJson = focus ? JSON.stringify(focus) : '';
  useEffect(() => {
    if (!ready || !focusJson || focusJson === focusKey.current) return;
    focusKey.current = focusJson;
    const { point, zoom } = JSON.parse(focusJson) as NonNullable<MapProps['focus']>;
    const target = deltaForZoom(zoom ?? FOCUS_ZOOM, width.current);
    const delta = zoom ? target : Math.min(target, region.current.longitudeDelta);
    map.current?.animateToRegion({ ...toCoord(point), latitudeDelta: delta, longitudeDelta: delta }, 700);
  }, [ready, focusJson]);

  // Toque simple → onMarkerPress; dos toques en menos de DOUBLE_TAP_MS sobre el mismo pin → doble.
  const handleMarkerPress = useCallback((id: string) => {
    const now = Date.now();
    const prev = lastTap.current;
    if (prev && prev.id === id && now - prev.at < DOUBLE_TAP_MS) {
      lastTap.current = undefined;
      handlers.current.onMarkerDoublePress?.(id);
    } else {
      lastTap.current = { id, at: now };
      handlers.current.onMarkerPress?.(id);
    }
  }, []);

  return (
    <View style={{ height, backgroundColor: colors.surfaceMid }}>
      <MapView
        ref={map}
        style={{ flex: 1 }}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={INITIAL_REGION}
        customMapStyle={Platform.OS === 'android' ? MAP_STYLE : undefined}
        mapPadding={{ top: 0, left: 0, right: 0, bottom: controlsInset }}
        onLayout={(e) => {
          width.current = e.nativeEvent.layout.width || width.current;
        }}
        onMapReady={() => setReady(true)}
        onRegionChangeComplete={(r) => {
          region.current = r;
        }}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsPointsOfInterests
        showsBuildings
        showsIndoors={false}
        showsTraffic={false}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
      >
        {circles?.map((c) => {
          const st = CIRCLE_STYLE[c.tone ?? 'brand'];
          return (
            <Circle
              key={c.id}
              center={toCoord(c.center)}
              radius={c.radius}
              strokeColor={st.stroke}
              strokeWidth={1}
              fillColor={st.fill}
              zIndex={0}
            />
          );
        })}
        {lines?.map((l) => {
          const st = LINE_STYLE[l.style];
          return (
            <Polyline
              key={l.id}
              coordinates={l.points.map(toCoord)}
              strokeColor={st.color}
              strokeWidth={st.width}
              lineDashPattern={st.dash}
              lineCap="round"
              lineJoin="round"
              zIndex={l.style === 'travelled' ? 3 : 2}
            />
          );
        })}
        {markers.map((m) => (
          <MapPin key={m.id} marker={m} onPress={handleMarkerPress} />
        ))}
      </MapView>
    </View>
  );
}

/** Firma visual del pin: si cambia, el marcador vuelve a redibujarse un instante. */
const visualKey = (m: MapMarker) => [m.kind, m.label, m.badge, m.selected, m.rating].join('|');

const MapPin = memo(
  function MapPin({ marker, onPress }: { marker: MapMarker; onPress: (id: string) => void }) {
    const key = visualKey(marker);
    // tracksViewChanges solo un momento tras montar o cambiar: evita parpadeo y consumo en Android.
    const [settledKey, setSettledKey] = useState<string>();
    const tracks = settledKey !== key;
    useEffect(() => {
      const t = setTimeout(() => setSettledKey(key), TRACK_MS);
      return () => clearTimeout(t);
    }, [key]);
    const coordinate = useAnimatedCoordinate(marker.position, marker.kind === 'rider');
    const layout = pinLayout(marker);

    return (
      <Marker
        identifier={marker.id}
        coordinate={coordinate}
        anchor={{ x: 0.5, y: layout.anchorY / layout.height }}
        centerOffset={{ x: 0, y: layout.height / 2 - layout.anchorY }}
        tracksViewChanges={tracks}
        zIndex={zIndexOf(marker)}
        onPress={(e) => {
          e.stopPropagation?.();
          onPress(marker.id);
        }}
      >
        <PinView marker={marker} />
      </Marker>
    );
  },
  (a, b) =>
    a.onPress === b.onPress &&
    visualKey(a.marker) === visualKey(b.marker) &&
    a.marker.position.lat === b.marker.position.lat &&
    a.marker.position.lng === b.marker.position.lng,
);

/** Interpola la posición (la moto avanza suave entre ticks); el resto de pines salta directo. */
function useAnimatedCoordinate(target: LatLng, animate: boolean) {
  const [coord, setCoord] = useState(() => toCoord(target));
  const current = useRef(coord);
  useEffect(() => {
    const to = toCoord(target);
    if (!animate) {
      current.current = to;
      return;
    }
    const from = current.current;
    const t0 = Date.now();
    let raf = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / RIDER_ANIMATION_MS);
      const next = {
        latitude: from.latitude + (to.latitude - from.latitude) * k,
        longitude: from.longitude + (to.longitude - from.longitude) * k,
      };
      current.current = next;
      setCoord(next);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target.lat, target.lng, animate]); // eslint-disable-line react-hooks/exhaustive-deps
  return animate ? coord : toCoord(target);
}
