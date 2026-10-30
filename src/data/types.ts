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
};

export type Store = {
  id: string;
  name: string;
  district: string;
  address: string;
  eta: string;
  distanceKm: number;
};

export type Address = {
  id: string;
  label: string;
  line1: string;
  district: string;
  reference?: string;
};

export type PaymentMethodType = 'yape' | 'card' | 'cash';

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
  lineTotal: number;
};

export type OrderTotals = {
  regularSubtotal: number;
  productDiscount: number;
  couponDiscount: number;
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
  schedule: { type: 'asap' } | { type: 'scheduled'; slot: string };
  payment: { method: PaymentMethodType; label: string; cashAmount?: number };
  couponCode?: string;
  totals: OrderTotals;
  /** Pedidos de ejemplo del historial: ya entregados. */
  seeded?: boolean;
  cancelledAt?: number;
  /** Solo para "Para llevar": cuando el cliente confirma que recogió. */
  completedAt?: number;
  rating?: number;
};
