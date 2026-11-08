import places from './places.json';
import { normalize } from './products';
import type { Address, Coupon, LatLng, SavedCard, Store } from './types';

/** Coordenadas de OSM (ver places.json) sin campos extra. */
const ll = (p: { lat: number; lng: number }): LatLng => ({ lat: p.lat, lng: p.lng });

export const stores: Store[] = [
  {
    id: 'aliaga',
    coords: ll(places.stores.aliaga),
    name: 'Tambo Juan de Aliaga',
    district: 'Magdalena del Mar',
    address: 'Av. Juan de Aliaga 400, Magdalena del Mar',
    eta: '15-25 min',
    distanceKm: 0.6,
    lockers: { total: 36, free: 4 },
  },
  {
    id: 'larco',
    coords: ll(places.stores.larco),
    name: 'Tambo Larco 400',
    district: 'Miraflores',
    address: 'Av. José Larco 400, Miraflores',
    eta: '20-30 min',
    distanceKm: 1.2,
    lockers: { total: 36, free: 7 },
  },
  {
    id: 'benavides',
    coords: ll(places.stores.benavides),
    name: 'Tambo Benavides',
    district: 'Miraflores',
    address: 'Av. Alfredo Benavides 1180, Miraflores',
    eta: '25-35 min',
    distanceKm: 2.4,
    lockers: { total: 24, free: 2 },
  },
  {
    id: 'sanisidro',
    coords: ll(places.stores.sanisidro),
    name: 'Tambo Camino Real',
    district: 'San Isidro',
    address: 'Av. Camino Real 390, San Isidro',
    eta: '25-35 min',
    distanceKm: 3.1,
    lockers: { total: 36, free: 11 },
  },
  // Sedes demo (direcciones reales de OSM; no corresponden necesariamente a una tienda Tambo).
  {
    id: 'losolivos',
    name: 'Tambo Antúnez de Mayolo',
    district: 'Los Olivos',
    address: 'Av. Antúnez de Mayolo 800, Los Olivos',
    eta: '20-30 min',
    distanceKm: 14.2,
    coords: ll(places.stores.losolivos),
    lockers: { total: 24, free: 6 },
  },
  {
    id: 'surco',
    name: 'Tambo Primavera',
    district: 'Santiago de Surco',
    address: 'Av. Primavera 1200, Santiago de Surco',
    eta: '20-30 min',
    distanceKm: 7.4,
    coords: ll(places.stores.surco),
    lockers: { total: 36, free: 9 },
  },
];

export const getStore = (id: string) => stores.find((s) => s.id === id) ?? stores[0];

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

/** Ubicación de demo del usuario (Parque Kennedy, Miraflores). */
export const DEMO_USER_LOCATION: LatLng = ll(places.demoUser);

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
