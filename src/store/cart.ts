import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getProduct } from '@/data/products';
import { computeTotals, type CartLine } from '@/lib/pricing';
import { persistStorage } from './storage';
import { useSession } from './session';

export type CartItem = { productId: string; qty: number };

type CartState = {
  items: CartItem[];
  couponCode?: string;
  add: (productId: string, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  restore: (item: CartItem, index: number) => void;
  replace: (items: CartItem[]) => void;
  clear: () => void;
  setCoupon: (code?: string) => void;
};

export const MAX_QTY = 20;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      couponCode: undefined,
      add: (productId, qty = 1) =>
        set((s) => {
          const found = s.items.find((i) => i.productId === productId);
          if (found) {
            return {
              items: s.items.map((i) =>
                i.productId === productId ? { ...i, qty: Math.min(MAX_QTY, i.qty + qty) } : i,
              ),
            };
          }
          return { items: [...s.items, { productId, qty: Math.min(MAX_QTY, qty) }] };
        }),
      setQty: (productId, qty) =>
        set((s) => ({
          items:
            qty <= 0
              ? s.items.filter((i) => i.productId !== productId)
              : s.items.map((i) => (i.productId === productId ? { ...i, qty: Math.min(MAX_QTY, qty) } : i)),
        })),
      remove: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      restore: (item, index) =>
        set((s) => {
          const items = s.items.filter((i) => i.productId !== item.productId);
          items.splice(Math.min(index, items.length), 0, item);
          return { items };
        }),
      replace: (items) => set({ items }),
      clear: () => set({ items: [], couponCode: undefined }),
      setCoupon: (couponCode) => set({ couponCode }),
    }),
    { name: 'tambo-cart', storage: persistStorage },
  ),
);

export const useCartQty = (productId: string) =>
  useCart((s) => s.items.find((i) => i.productId === productId)?.qty ?? 0);

export const useCartCount = () => useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));

export function useCartLines(): CartLine[] {
  const items = useCart((s) => s.items);
  return useMemo(
    () =>
      items.flatMap((i) => {
        const product = getProduct(i.productId);
        return product ? [{ product, qty: i.qty }] : [];
      }),
    [items],
  );
}

export function useCartTotals() {
  const lines = useCartLines();
  const couponCode = useCart((s) => s.couponCode);
  const fulfillment = useSession((s) => s.fulfillment);
  return useMemo(() => computeTotals(lines, fulfillment, couponCode), [lines, fulfillment, couponCode]);
}
