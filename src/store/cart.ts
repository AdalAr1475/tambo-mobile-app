import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getProduct } from '@/data/products';
import type { RedeemMode } from '@/data/types';
import { computeTotals, type CartLine, type TotalsOptions } from '@/lib/pricing';
import { persistStorage } from './storage';
import { useSession } from './session';

/**
 * Un mismo producto puede estar dos veces: una línea normal y otra canjeada con puntos.
 * La identidad de la línea es `productId + redeem`.
 */
export type CartItem = { productId: string; qty: number; redeem?: RedeemMode };

type CartState = {
  items: CartItem[];
  couponCode?: string;
  add: (productId: string, qty?: number, redeem?: RedeemMode) => void;
  setQty: (productId: string, qty: number, redeem?: RedeemMode) => void;
  remove: (productId: string, redeem?: RedeemMode) => void;
  restore: (item: CartItem, index: number) => void;
  replace: (items: CartItem[]) => void;
  clear: () => void;
  setCoupon: (code?: string) => void;
};

export const MAX_QTY = 20;

export const sameLine = (i: CartItem, productId: string, redeem?: RedeemMode) =>
  i.productId === productId && i.redeem === redeem;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      couponCode: undefined,
      add: (productId, qty = 1, redeem) =>
        set((s) => {
          const found = s.items.find((i) => sameLine(i, productId, redeem));
          if (found) {
            return {
              items: s.items.map((i) =>
                sameLine(i, productId, redeem) ? { ...i, qty: Math.min(MAX_QTY, i.qty + qty) } : i,
              ),
            };
          }
          const item: CartItem = { productId, qty: Math.min(MAX_QTY, qty) };
          if (redeem) item.redeem = redeem;
          return { items: [...s.items, item] };
        }),
      setQty: (productId, qty, redeem) =>
        set((s) => ({
          items:
            qty <= 0
              ? s.items.filter((i) => !sameLine(i, productId, redeem))
              : s.items.map((i) =>
                  sameLine(i, productId, redeem) ? { ...i, qty: Math.min(MAX_QTY, qty) } : i,
                ),
        })),
      remove: (productId, redeem) =>
        set((s) => ({ items: s.items.filter((i) => !sameLine(i, productId, redeem)) })),
      restore: (item, index) =>
        set((s) => {
          const items = s.items.filter((i) => !sameLine(i, item.productId, item.redeem));
          items.splice(Math.min(index, items.length), 0, item);
          return { items };
        }),
      // Un carrito nuevo no hereda el cupón del anterior.
      replace: (items) => set({ items, couponCode: undefined }),
      clear: () => set({ items: [], couponCode: undefined }),
      setCoupon: (couponCode) => set({ couponCode }),
    }),
    {
      name: 'tambo-cart',
      storage: persistStorage,
      // v2 (It. 2): CartItem.redeem opcional; los datos v1 son compatibles tal cual.
      version: 2,
      migrate: (persisted) => persisted as CartState,
    },
  ),
);

/** Cantidad de la línea normal (sin canje) de un producto. */
export const useCartQty = (productId: string) =>
  useCart((s) => s.items.find((i) => sameLine(i, productId, undefined))?.qty ?? 0);

export const useCartCount = () => useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));

export const toCartLines = (items: CartItem[]): CartLine[] =>
  items.flatMap((i) => {
    const product = getProduct(i.productId);
    return product ? [{ product, qty: i.qty, redeem: i.redeem }] : [];
  });

export function useCartLines(): CartLine[] {
  const items = useCart((s) => s.items);
  return useMemo(() => toCartLines(items), [items]);
}

/** Totales del carrito. `pointsToUse` = puntos aplicados como descuento en el checkout. */
export function useCartTotals(opts: TotalsOptions = {}) {
  const lines = useCartLines();
  const couponCode = useCart((s) => s.couponCode);
  const fulfillment = useSession((s) => s.fulfillment);
  const { pointsToUse, earnMultiplier } = opts;
  return useMemo(
    () => computeTotals(lines, fulfillment, couponCode, { pointsToUse, earnMultiplier }),
    [lines, fulfillment, couponCode, pointsToUse, earnMultiplier],
  );
}
