import { haversine } from '@/lib/haversine';
import places from './places.json';
import { normalize } from './products';
import realStores from './realStores.json';
import type { Address, Coupon, LatLng, SavedCard, Store } from './types';

/** Coordenadas (places.json / realStores.json) sin campos extra. */
const ll = (p: { lat: number; lng: number }): LatLng => ({ lat: p.lat, lng: p.lng });

/** Ubicación de demo del usuario (FIIS - UNI). No pide permisos ni llama APIs. */
export const DEMO_USER_LOCATION: LatLng = ll(realStores.demoUser);
export const DEMO_USER_LABEL = realStores.demoUser.name;

/** Ficha de Google Maps a partir del `cid` capturado (se abre con Linking, sin API). */
const mapsUrlForCid = (cid: string) => `https://www.google.com/maps?cid=${cid}`;
const mapsSearchUrl = (p: LatLng) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;

/** Casilleros de demo (las tiendas reales no publican este dato): algunas con 0 para ver el retiro en caja. */
const DEMO_LOCKERS_FREE = [5, 8, 3, 6, 2, 0, 9, 4, 7];

/** Tiempo "Listo en" de demo: preparación + un margen según qué tan lejos está del punto de su zona. */
function demoEta(meters: number) {
  const from = meters < 500 ? 10 : meters < 1500 ? 15 : 20;
  return `${from}-${from + 10} min`;
}

type RealStore = (typeof realStores.stores)[number];

const areaAnchor = (area: RealStore['area']): LatLng =>
  area === 'casa' ? ll(places.addresses.casa) : area === 'oficina' ? ll(places.addresses.oficina) : DEMO_USER_LOCATION;

/**
 * Catálogo de tiendas: 25 Tambos reales capturados una vez de Google Maps (ver realStores.json).
 * El primero (Tambo UNI puerta 5) es el más cercano a la FIIS y la tienda por defecto.
 */
export const stores: Store[] = realStores.stores.map((s, i) => {
  const coords = ll(s);
  return {
    id: s.id,
    name: s.name,
    district: s.district,
    address: `${s.address}, ${s.district}`,
    coords,
    eta: demoEta(haversine(coords, areaAnchor(s.area))),
    lockers: { total: i % 2 ? 24 : 36, free: DEMO_LOCKERS_FREE[i % DEMO_LOCKERS_FREE.length] },
    rating: s.rating ?? undefined,
    reviews: s.reviews ?? undefined,
    hours: s.hours,
    mapsUrl: mapsUrlForCid(s.cid),
  };
});

export const DEFAULT_STORE_ID = stores[0].id;

/**
 * Tiendas de las iteraciones 1–9 (antes de las reales). Solo se resuelven para pedidos o rutinas
 * ya guardados en el teléfono; no aparecen en listas ni mapas.
 */
const LEGACY: [keyof typeof places.stores, string, string, string, number][] = [
  ['aliaga', 'Tambo Juan de Aliaga', 'Magdalena del Mar', 'Av. Juan de Aliaga 400, Magdalena del Mar', 4],
  ['larco', 'Tambo Larco 400', 'Miraflores', 'Av. José Larco 400, Miraflores', 7],
  ['benavides', 'Tambo Benavides', 'Miraflores', 'Av. Alfredo Benavides 1180, Miraflores', 2],
  ['sanisidro', 'Tambo Camino Real', 'San Isidro', 'Av. Camino Real 390, San Isidro', 11],
  ['losolivos', 'Tambo Antúnez de Mayolo', 'Los Olivos', 'Av. Antúnez de Mayolo 800, Los Olivos', 6],
  ['surco', 'Tambo Primavera', 'Santiago de Surco', 'Av. Primavera 1200, Santiago de Surco', 9],
];
const legacyStores: Store[] = LEGACY.map(([id, name, district, address, free]) => {
  const coords = ll(places.stores[id]);
  return {
    id,
    name,
    district,
    address,
    coords,
    eta: '20-30 min',
    lockers: { total: 36, free },
    mapsUrl: mapsSearchUrl(coords),
  };
});

export const isCurrentStore = (id: string) => stores.some((s) => s.id === id);

/** Tienda por id (incluye las antiguas para pedidos guardados); si no existe, la tienda por defecto. */
export const getStore = (id: string) =>
  stores.find((s) => s.id === id) ?? legacyStores.find((s) => s.id === id) ?? stores[0];

export const seedAddresses: Address[] = [
  {
    id: 'casa',
    label: 'Casa',
    line1: 'Calle Berlín 245, Dpto 502',
    district: 'Miraflores, Lima',
    reference: 'Dejar en recepción con portero',
    coords: ll(places.addresses.casa),
  },
  {
    id: 'oficina',
    label: 'Oficina',
    line1: 'Av. Rivera Navarrete 641, Piso 8',
    district: 'San Isidro, Lima',
    coords: ll(places.addresses.oficina),
  },
];

/** Direcciones semilla anteriores a la It. 6 (coincidían con la puerta de dos tiendas). */
export const LEGACY_SEED_LINES: Record<string, string> = {
  casa: 'Av. Larco 400, Dpto 502',
  oficina: 'Av. Juan de Aliaga 400, Dpto 502',
};

/** Id de la dirección que se crea al elegir "Entregar aquí" sobre tu ubicación (FIIS-UNI en la demo). */
export const MY_LOCATION_ADDRESS_ID = 'mi-ubicacion';

/** Centroide aproximado del distrito, para direcciones creadas a mano (sin geocodificar). */
export function districtCentroid(district: string): LatLng | undefined {
  const target = normalize(district);
  const match = Object.entries(places.districts).find(([name]) => target.includes(normalize(name)));
  return match ? ll(match[1]) : undefined;
}

export const seedCards: SavedCard[] = [
  { id: 'visa-4092', brand: 'Visa', last4: '4092', holder: 'RODRIGO VEGA', expiry: '08/28' },
];

export const coupons: Coupon[] = [
  {
    code: 'TAMBOYA10',
    title: '-S/ 10.00 en tu compra',
    description: 'Cupón de bienvenida en compras mayores a S/ 30 por la app.',
    kind: 'fixed',
    value: 10,
    minSubtotal: 30,
    expires: '31/12',
  },
  {
    code: 'TAMBOAPP',
    title: '10% de descuento',
    description: 'Descuento de 10% hasta S/ 8 en cualquier pedido.',
    kind: 'percent',
    value: 10,
    maxDiscount: 8,
    expires: '30/11',
  },
  {
    code: 'ENVIOGRATIS',
    title: 'Delivery gratis',
    description: 'Envío sin costo en pedidos desde S/ 15.',
    kind: 'shipping',
    value: 0,
    minSubtotal: 15,
    expires: '15/11',
  },
];

export const findCoupon = (code: string) => coupons.find((c) => c.code === code.trim().toUpperCase());

export const user = {
  name: 'Rodrigo Vega',
  firstName: 'Rodrigo',
  email: 'rodrigo.vega@email.com',
  phone: '+51 987 654 321',
  avatar: require('../../assets/images/avatar-rodrigo.jpg'),
};

export const rider = {
  name: 'Carlos Mendoza',
  rating: 4.9,
  vehicle: 'Honda CB 125F',
  plate: '8421-5B',
  phone: '+51987123456',
  photo: require('../../assets/images/rider-carlos.jpg'),
};
