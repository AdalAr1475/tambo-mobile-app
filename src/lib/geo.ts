import routesJson from '@/data/routes.json';
import { DEMO_USER_LOCATION, districtCentroid, getStore, stores } from '@/data/stores';
import type { Address, LatLng, Order, Store } from '@/data/types';

/**
 * Utilidades geográficas (sin red). Las rutas reales se precalculan con
 * scripts/build-routes.mjs (OSRM sobre OpenStreetMap) y se guardan en src/data/routes.json.
 */

/** Radio de cobertura inmediata que se dibuja en el mapa de tiendas. */
export const COVERAGE_METERS = 1500;
/** Distancia máxima de delivery desde la tienda que atiende la dirección. */
export const DELIVERY_RANGE_METERS = 4000;
/** Velocidad a pie (metros por minuto). */
const WALK_M_PER_MIN = 75;

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversine(a: LatLng, b: LatLng) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function polylineLength(points: LatLng[]) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversine(points[i - 1], points[i]);
  return total;
}

/** Corta la ruta en la fracción `t` (por distancia): tramo recorrido, tramo restante y posición. */
export function splitRoute(points: LatLng[], t: number) {
  const progress = Math.min(1, Math.max(0, t));
  if (points.length < 2) return { point: points[0], travelled: points, remaining: points };
  const target = polylineLength(points) * progress;
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const seg = haversine(points[i - 1], points[i]);
    if (acc + seg >= target) {
      const f = seg === 0 ? 0 : (target - acc) / seg;
      const point = {
        lat: points[i - 1].lat + (points[i].lat - points[i - 1].lat) * f,
        lng: points[i - 1].lng + (points[i].lng - points[i - 1].lng) * f,
      };
      return { point, travelled: [...points.slice(0, i), point], remaining: [point, ...points.slice(i)] };
    }
    acc += seg;
  }
  const last = points[points.length - 1];
  return { point: last, travelled: points, remaining: [last] };
}

/** Ruta en "L" cuando no hay una ruta precalculada para ese par. */
export const lShapeRoute = (a: LatLng, b: LatLng): LatLng[] => [a, { lat: a.lat, lng: b.lng }, b];

export const walkingMinutes = (meters: number) => Math.max(1, Math.ceil(meters / WALK_M_PER_MIN));

export const formatDistance = (meters: number) =>
  meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;

/** Coordenadas de una dirección (las creadas a mano usan el centroide del distrito). */
export const addressCoords = (a?: Pick<Address, 'coords' | 'district'>): LatLng =>
  a?.coords ?? (a && districtCentroid(a.district)) ?? DEMO_USER_LOCATION;

/** Tiendas ordenadas por distancia a un punto. */
export const storesByDistance = (from: LatLng) =>
  stores
    .map((store) => ({ store, meters: haversine(from, store.coords) }))
    .sort((a, b) => a.meters - b.meters);

/** Tienda que atiende el delivery de una dirección (la más cercana). */
export const deliveryStoreFor = (a?: Pick<Address, 'coords' | 'district'>): Store =>
  storesByDistance(addressCoords(a))[0].store;

/* ——— Rutas precalculadas ——— */

type RouteData = { meters: number; seconds: number; points: [number, number][]; steps?: { text: string; meters: number }[] };
const ROUTES = routesJson as unknown as Record<string, RouteData>;

export type GeoRoute = {
  points: LatLng[];
  meters: number;
  /** true si viene de OSRM (calles reales); false si es la ruta aproximada en "L". */
  real: boolean;
  steps?: { text: string; meters: number }[];
};

const toRoute = (data: RouteData): GeoRoute => ({
  points: data.points.map(([lat, lng]) => ({ lat, lng })),
  meters: data.meters,
  real: true,
  steps: data.steps,
});

const approx = (a: LatLng, b: LatLng): GeoRoute => {
  const points = lShapeRoute(a, b);
  return { points, meters: Math.round(polylineLength(points)), real: false };
};

const near = (a: LatLng, b: LatLng) => haversine(a, b) < 30;

/** Ruta del motorizado: tienda → dirección del pedido. */
export function deliveryRoute(order: Order): GeoRoute {
  const store = getStore(order.storeId);
  const to = addressCoords(order.address);
  const data = order.address && ROUTES[`car:${store.id}:${order.address.id}`];
  // Solo se usa la ruta guardada si la dirección sigue en el mismo lugar.
  if (data && near(toRoute(data).points.at(-1)!, to)) return toRoute(data);
  return approx(store.coords, to);
}

/** Ruta a pie del usuario a la tienda (precalculada solo desde la ubicación de demo). */
export function walkingRoute(from: LatLng, store: Store): GeoRoute {
  const data = ROUTES[`foot:demo:${store.id}`];
  if (data && near(from, DEMO_USER_LOCATION)) return toRoute(data);
  return approx(from, store.coords);
}

/** Dirección cardinal aproximada de `a` hacia `b` (para indicaciones sin ruta). */
export function cardinal(a: LatLng, b: LatLng) {
  const dy = b.lat - a.lat;
  const dx = (b.lng - a.lng) * Math.cos(rad(a.lat));
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const names = ['el este', 'el noreste', 'el norte', 'el noroeste', 'el oeste', 'el suroeste', 'el sur', 'el sureste'];
  return names[(Math.round(angle / 45) + 8) % 8];
}

/** Enlaces de navegación externa. */
export const googleMapsUrl = (to: LatLng, mode: 'walking' | 'driving' = 'walking') =>
  `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=${mode}`;
export const wazeUrl = (to: LatLng) => `https://waze.com/ul?ll=${to.lat},${to.lng}&navigate=yes`;
