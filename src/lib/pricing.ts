import { findCoupon } from '@/data/stores';
import type { Coupon, Fulfillment, OrderTotals, Product } from '@/data/types';
import { money, round2 } from './format';

export const DELIVERY_FEE = 4.5;
export const FREE_SHIPPING_MIN = 40;

export type CartLine = { product: Product; qty: number };

/** Total de una línea aplicando precios por paquete (2 x S/ 13.90, 2x1). */
export const lineTotal = (product: Product, qty: number) => {
  const mb = product.multiBuy;
  if (!mb) return round2(product.price * qty);
  const packs = Math.floor(qty / mb.qty);
  return round2(packs * mb.price + (qty % mb.qty) * product.price);
};

export const lineRegular = (product: Product, qty: number) =>
  round2((product.regularPrice ?? product.price) * qty);

export type CouponCheck = { ok: true; coupon: Coupon } | { ok: false; error: string };

export const checkCoupon = (code: string, subtotal: number): CouponCheck => {
  if (!code.trim()) return { ok: false, error: 'Ingresa un código.' };
  const coupon = findCoupon(code);
  if (!coupon) return { ok: false, error: 'El código no existe o ya venció.' };
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
    return {
      ok: false,
      error: `Válido en compras desde ${money(coupon.minSubtotal)}. Te faltan ${money(coupon.minSubtotal - subtotal)}.`,
    };
  }
  return { ok: true, coupon };
};

export type CartTotals = OrderTotals & {
  subtotal: number;
  itemCount: number;
  freeShippingGap: number;
  coupon?: Coupon;
  couponError?: string;
};

export const computeTotals = (
  lines: CartLine[],
  fulfillment: Fulfillment,
  couponCode?: string,
): CartTotals => {
  const regularSubtotal = round2(lines.reduce((s, l) => s + lineRegular(l.product, l.qty), 0));
  const subtotal = round2(lines.reduce((s, l) => s + lineTotal(l.product, l.qty), 0));
  const productDiscount = round2(regularSubtotal - subtotal);
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);

  let coupon: Coupon | undefined;
  let couponError: string | undefined;
  if (couponCode) {
    const check = checkCoupon(couponCode, subtotal);
    if (check.ok) coupon = check.coupon;
    else couponError = check.error;
  }

  let couponDiscount = 0;
  if (coupon?.kind === 'fixed') couponDiscount = Math.min(coupon.value, subtotal);
  if (coupon?.kind === 'percent') {
    couponDiscount = Math.min(round2((subtotal * coupon.value) / 100), coupon.maxDiscount ?? Infinity);
  }

  const freeByAmount = subtotal >= FREE_SHIPPING_MIN;
  const shipping =
    fulfillment === 'pickup' || itemCount === 0 || freeByAmount || coupon?.kind === 'shipping'
      ? 0
      : DELIVERY_FEE;

  return {
    regularSubtotal,
    productDiscount,
    subtotal,
    couponDiscount: round2(couponDiscount),
    shipping,
    total: round2(Math.max(0, subtotal - couponDiscount) + shipping),
    itemCount,
    freeShippingGap: fulfillment === 'delivery' && !freeByAmount ? round2(FREE_SHIPPING_MIN - subtotal) : 0,
    coupon,
    couponError,
  };
};
