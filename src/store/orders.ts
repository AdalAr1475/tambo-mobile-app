import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createSeedOrders } from '@/data/seedOrders';
import type { Order } from '@/data/types';
import { getOrderStatus } from '@/lib/orderProgress';
import { persistStorage } from './storage';

type OrdersState = {
  orders: Order[];
  place: (order: Order) => void;
  cancel: (id: string) => void;
  complete: (id: string) => void;
  rate: (id: string, rating: number) => void;
};

export const useOrders = create<OrdersState>()(
  persist(
    (set) => ({
      orders: createSeedOrders(),
      place: (order) => set((s) => ({ orders: [order, ...s.orders] })),
      cancel: (id) =>
        set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, cancelledAt: Date.now() } : o)) })),
      complete: (id) =>
        set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, completedAt: Date.now() } : o)) })),
      rate: (id, rating) =>
        set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, rating } : o)) })),
    }),
    { name: 'tambo-orders', storage: persistStorage },
  ),
);

export const useOrder = (id: string | undefined) => useOrders((s) => s.orders.find((o) => o.id === id));

export const newOrderId = () => `TB-${Math.floor(10000 + Math.random() * 89999)}`;

/** Código aleatorio corto para canjes y reclamos. */
export const randomCode = (prefix: string, digits = 4) =>
  `${prefix}-${Math.floor(10 ** (digits - 1) + Math.random() * 9 * 10 ** (digits - 1))}`;

export const timestamp = () => Date.now();

/** Reloj que se actualiza cada `ms` para animar estados simulados. */
export function useNow(ms = 1000, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms, enabled]);
  return now;
}

export function useActiveOrders(now: number) {
  const orders = useOrders((s) => s.orders);
  return orders.filter((o) => getOrderStatus(o, now).phase === 'active');
}
