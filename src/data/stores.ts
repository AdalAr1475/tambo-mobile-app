import type { Address, Coupon, SavedCard, Store } from './types';

export const stores: Store[] = [
  {
    id: 'aliaga',
    name: 'Tambo Juan de Aliaga',
    district: 'Magdalena del Mar',
    address: 'Av. Juan de Aliaga 400, Magdalena del Mar',
    eta: '15-25 min',
    distanceKm: 0.6,
  },
  {
    id: 'larco',
    name: 'Tambo Larco 400',
    district: 'Miraflores',
    address: 'Av. José Larco 400, Miraflores',
    eta: '20-30 min',
    distanceKm: 1.2,
  },
  {
    id: 'benavides',
    name: 'Tambo Benavides',
    district: 'Miraflores',
    address: 'Av. Alfredo Benavides 1180, Miraflores',
    eta: '25-35 min',
    distanceKm: 2.4,
  },
  {
    id: 'sanisidro',
    name: 'Tambo Camino Real',
    district: 'San Isidro',
    address: 'Av. Camino Real 390, San Isidro',
    eta: '25-35 min',
    distanceKm: 3.1,
  },
];

export const getStore = (id: string) => stores.find((s) => s.id === id) ?? stores[0];

export const seedAddresses: Address[] = [
  {
    id: 'casa',
    label: 'Casa',
    line1: 'Av. Larco 400, Dpto 502',
    district: 'Miraflores, Lima',
    reference: 'Dejar en recepción con portero',
  },
  {
    id: 'oficina',
    label: 'Oficina',
    line1: 'Av. Juan de Aliaga 400, Dpto 502',
    district: 'Magdalena del Mar, Lima',
  },
];

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
