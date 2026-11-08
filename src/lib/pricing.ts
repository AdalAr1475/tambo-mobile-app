import { findCoupon } from '@/data/stores';
import type { Coupon, Fulfillment, OrderTotals, Product, RedeemMode } from '@/data/types';
import { money, round2 } from './format';
import { earnFor, pointsForSoles, pointsValue } from './points';

export const DELIVERY_FEE = 4.5;
export const FREE_SHIPPING_MIN = 40;

/** Línea del carrito. Con `redeem` se paga con puntos (o puntos + soles). */
export type CartLine = { product: Product; qty: number; redeem?: RedeemMode };

/** Total de una línea aplicando precios por paquete (2 x S/ 13.90, 2x1). */
export const lineTotal = (product: Product, qty: number) => {
  const mb = product.multiBuy;
  if (!mb) return round2(product.price * qty);
  const packs = Math.floor(qty / mb.qty);
  return round2(packs * mb.price + (qty % mb.qty) * product.price);
};

export const lineRegular = (product: Product, qty: number) =>
  round2((product.regularPrice ?? product.price) * qty);

/** Precio unitario de canje: `points` (S/ 0.00) o `mixed` (puntos + soles). */
export const redeemOption = (product: Product, mode: RedeemMode) => {
  if (mode === 'points') {
    return product.redeem?.points ? { points: product.redeem.points, cash: 0 } : undefined;
  }
  return product.redeem?.mixed;
};

/** Una línea solo cuenta como canje si el producto ofrece esa modalidad. */
const activeRedeem = (l: CartLine) => (l.redeem ? redeemOption(l.product, l.redeem) : undefined);

/** Soles que se pagan por la línea. */
export const lineCash = (l: CartLine) => {
  const opt = activeRedeem(l);
  return opt ? round2(opt.cash * l.qty) : lineTotal(l.product, l.qty);
};

/** Puntos que se canjean en la línea. */
export const linePoints = (l: CartLine) => (activeRedeem(l)?.points ?? 0) * l.qty;

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
  /** Soles a pagar por productos (sin envío ni cupón). El cupón y el envío gratis se miden sobre esto. */
  subtotal: number;
  itemCount: number;
  freeShippingGap: number;
  coupon?: Coupon;
  couponError?: string;
  /** Soles cubiertos por las líneas canjeadas. */
  pointsLinesValue: number;
  /** Puntos de las líneas canjeadas. */
  pointsFromLines: number;
  /** Puntos usados como descuento libre ("Usar mis puntos"). */
  pointsUsed: number;
  pointsUsedValue: number;
  /** Puntos totales que se descuentan del saldo. */
  pointsToRedeem: number;
  /** Puntos que se ganan con esta compra. */
  pointsEarned: number;
  pointsDiscount: number;
  routineDiscount: number;
};

export type TotalsOptions = {
  /** Puntos que el usuario quiere usar como descuento (se limitan a lo que cubre el pedido). */
  pointsToUse?: number;
  /** Multiplicador de acumulación (Auto-Pilot = 2). */
  earnMultiplier?: number;
  /** Pedido recurrente Auto-Pilot: 10 % en productos + envío gratis. */
  routine?: boolean;
};

/** Beneficio fijo de los pedidos Auto-Pilot sobre los productos pagados en soles. */
export const ROUTINE_DISCOUNT_RATE = 0.1;

export const computeTotals = (
  lines: CartLine[],
  fulfillment: Fulfillment,
  couponCode?: string,
  opts: TotalsOptions = {},
): CartTotals => {
  const regularSubtotal = round2(lines.reduce((s, l) => s + lineRegular(l.product, l.qty), 0));
  const promoSubtotal = round2(lines.reduce((s, l) => s + lineTotal(l.product, l.qty), 0));
  const subtotal = round2(lines.reduce((s, l) => s + lineCash(l), 0));
  const productDiscount = round2(regularSubtotal - promoSubtotal);
  const pointsLinesValue = round2(promoSubtotal - subtotal);
  const pointsFromLines = lines.reduce((s, l) => s + linePoints(l), 0);
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
  couponDiscount = round2(couponDiscount);
  const afterCoupon = round2(Math.max(0, subtotal - couponDiscount));
  const routineDiscount = opts.routine ? round2(afterCoupon * ROUTINE_DISCOUNT_RATE) : 0;
  const afterRoutine = round2(afterCoupon - routineDiscount);

  // "Usar mis puntos": solo cubre productos (no el envío).
  const pointsUsed = Math.min(Math.max(0, Math.floor(opts.pointsToUse ?? 0)), pointsForSoles(afterRoutine));
  const pointsUsedValue = Math.min(pointsValue(pointsUsed), afterRoutine);
  const productsCash = round2(afterRoutine - pointsUsedValue);

  const freeByAmount = subtotal >= FREE_SHIPPING_MIN;
  const shipping =
    fulfillment === 'pickup' ||
    itemCount === 0 ||
    freeByAmount ||
    coupon?.kind === 'shipping' ||
    opts.routine
      ? 0
      : DELIVERY_FEE;

  return {
    regularSubtotal,
    productDiscount,
    subtotal,
    couponDiscount,
    routineDiscount,
    shipping,
    total: round2(productsCash + shipping),
    itemCount,
    freeShippingGap: fulfillment === 'delivery' && !freeByAmount ? round2(FREE_SHIPPING_MIN - subtotal) : 0,
    coupon,
    couponError,
    pointsLinesValue,
    pointsFromLines,
    pointsUsed,
    pointsUsedValue,
    pointsToRedeem: pointsFromLines + pointsUsed,
    pointsEarned: earnFor(productsCash, opts.earnMultiplier),
    pointsDiscount: round2(pointsLinesValue + pointsUsedValue),
  };
};
