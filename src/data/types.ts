import type { IconName } from '@/components/Icon';

export type CategoryId =
  'bebidas' | 'snacks' | 'comida' | 'cafeteria' | 'lacteos' | 'abarrotes' | 'limpieza' | 'cuidado';

export type Category = {
  id: CategoryId;
  name: string;
  title: string;
  icon: IconName;
  subcategories: string[];
  promo?: string;
};

export type BadgeTone = 'discount' | 'popular' | 'combo' | 'promo' | 'new';

export type PromoTag = 'combos' | '2x1' | 'descuentos';

export type Product = {
  id: string;
  name: string;
  brand: string;
  categoryId: CategoryId;
  subcategory: string;
  subtitle: string;
  description: string;
  price: number;
  regularPrice?: number;
  /** Resultado de require() de un asset local. */
  image?: number;
  gallery?: number[];
  /** Si no hay foto se muestra un ícono sobre un fondo de color. */
  icon?: IconName;
  tint?: string;
  badge?: { label: string; tone: BadgeTone };
  priceNote?: string;
  /** Precio por paquete, ej. 2 x S/ 13.90 o 2x1. */
  multiBuy?: { qty: number; price: number };
  alcoholic?: boolean;
  details?: string;
  warnings?: string;
  promoTags?: PromoTag[];
  pairsWith?: string[];
  popularity: number;
  /** Canje Tambo Lover (estilo CMR): 100% puntos y/o puntos + soles. */
  redeem?: { points?: number; mixed?: { points: number; cash: number } };
};

/** Cómo se paga una línea canjeada: solo con puntos o con puntos + soles. */
export type RedeemMode = 'points' | 'mixed';

export type LatLng = { lat: number; lng: number };

export type Store = {
  id: string;
  name: string;
  district: string;
  address: string;
  eta: string;
  /** Distancia de referencia (la real se calcula con `haversine` desde la ubicación del usuario). */
  distanceKm: number;
  coords: LatLng;
  /** Tambo Smart Lockers de la tienda (casilleros inteligentes para retiro autónomo). */
  lockers?: { total: number; free: number };
};

/** Cómo se retira un pedido "Para llevar". */
export type PickupMethod = 'locker' | 'counter';

export type Address = {
  id: string;
  label: string;
  line1: string;
  district: string;
  reference?: string;
  /** Coordenadas (semilla: OSM; nuevas: centroide del distrito). */
  coords?: LatLng;
};

/** `points`: pedido 100% canjeado (total S/ 0.00), no pasa por pasarela. */
export type PaymentMethodType = 'yape' | 'plin' | 'card' | 'cash' | 'points';

export type SavedCard = {
  id: string;
  brand: 'Visa' | 'Mastercard' | 'Amex' | 'Diners';
  last4: string;
  holder: string;
  expiry: string;
};

export type Fulfillment = 'delivery' | 'pickup';

export type Coupon = {
  code: string;
  title: string;
  description: string;
  kind: 'fixed' | 'percent' | 'shipping';
  value: number;
  maxDiscount?: number;
  minSubtotal?: number;
  expires: string;
};

export type OrderItem = {
  productId: string;
  name: string;
  subtitle: string;
  qty: number;
  price: number;
  regularPrice?: number;
  /** En líneas canjeadas `price` y `lineTotal` son solo la parte en soles. */
  lineTotal: number;
  redeem?: RedeemMode;
  /** Puntos por unidad de una línea canjeada. */
  points?: number;
};

export type OrderTotals = {
  regularSubtotal: number;
  productDiscount: number;
  couponDiscount: number;
  /** Soles cubiertos con Tambo Lover Puntos (canjes + "usar mis puntos"). */
  pointsDiscount?: number;
  /** Beneficio Auto-Pilot (10 % en productos) de los pedidos recurrentes. */
  routineDiscount?: number;
  shipping: number;
  total: number;
};

export type Order = {
  id: string;
  createdAt: number;
  items: OrderItem[];
  fulfillment: Fulfillment;
  storeId: string;
  address?: Address;
  /** `start`/`end` (timestamps) solo existen en pedidos programados desde la It. 1. */
  schedule: { type: 'asap' } | { type: 'scheduled'; slot: string; start?: number; end?: number };
  payment: { method: PaymentMethodType; label: string; cashAmount?: number };
  couponCode?: string;
  totals: OrderTotals;
  /** Pedidos de ejemplo del historial: ya entregados. */
  seeded?: boolean;
  cancelledAt?: number;
  /** Legado (hasta la It. 2): el cliente confirmaba a mano que recogió. Hoy se usa `verifiedAt`. */
  completedAt?: number;
  /** "Para llevar": Smart Locker (por defecto) o mostrador. Sin valor = mostrador (pedidos antiguos). */
  pickupMethod?: PickupMethod;
  /** Retiro verificado escaneando el QR dinámico (tótem del locker o caja). */
  verifiedAt?: number;
  rating?: number;
  /** Puntos Tambo Lover sumados con esta compra. */
  pointsEarned?: number;
  /** Puntos Tambo Lover canjeados en esta compra. */
  pointsRedeemed?: number;
  /** Adelanto del reloj de este pedido (Modo Presentador), en ms de la demo. */
  clockOffsetMs?: number;
  /** Pedido generado automáticamente por una rutina Tambo Auto-Pilot. */
  routineId?: string;
  /** Delivery con entrega verificada por QR/PIN (Tambo SafeDrop). Los pedidos antiguos se entregan por tiempo. */
  safeDrop?: boolean;
  /** Reloj simulado del pedido ("Simular recorrido GPS"): en `at` el pedido iba en `t` y avanza a `rate`×. */
  sim?: { at: number; t: number; rate: number };
};
