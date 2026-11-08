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
  /** Adelanta el reloj de un pedido (Modo Presentador). */
  fastForward: (id: string, ms: number) => void;
  /** Marca el retiro como verificado (QR escaneado en el tótem o en caja). */
  verify: (id: string) => void;
  /** Reloj simulado: desde ahora el pedido avanza `rate`× partiendo de `t` ms de demo. */
  simulate: (id: string, t: number, rate: number) => void;
};

const patch = (orders: Order[], id: string, fn: (o: Order) => Partial<Order>) =>
  orders.map((o) => (o.id === id ? { ...o, ...fn(o) } : o));

export const useOrders = create<OrdersState>()(
  persist(
    (set) => ({
      orders: createSeedOrders(),
      place: (order) => set((s) => ({ orders: [order, ...s.orders] })),
      cancel: (id) => set((s) => ({ orders: patch(s.orders, id, () => ({ cancelledAt: Date.now() })) })),
      complete: (id) => set((s) => ({ orders: patch(s.orders, id, () => ({ completedAt: Date.now() })) })),
      rate: (id, rating) => set((s) => ({ orders: patch(s.orders, id, () => ({ rating })) })),
      fastForward: (id, ms) =>
        set((s) => ({ orders: patch(s.orders, id, (o) => ({ clockOffsetMs: (o.clockOffsetMs ?? 0) + ms })) })),
      verify: (id) =>
        set((s) => ({ orders: patch(s.orders, id, (o) => (o.verifiedAt ? {} : { verifiedAt: Date.now() })) })),
      simulate: (id, t, rate) =>
        set((s) => ({ orders: patch(s.orders, id, () => ({ sim: { at: Date.now(), t, rate }, clockOffsetMs: 0 })) })),
    }),
    {
      name: 'tambo-orders',
      storage: persistStorage,
      // v2 (It. 3): el retiro manual (`completedAt`) pasa a contar como retiro verificado.
      // v3 (It. 8): split es opcional; los pedidos anteriores se conservan sin reparto.
      version: 3,
      migrate: (persisted, version) => {
        const state = persisted as OrdersState;
        if (version < 2) {
          state.orders = state.orders.map((o) =>
            o.fulfillment === 'pickup' && o.completedAt && !o.verifiedAt ? { ...o, verifiedAt: o.completedAt } : o,
          );
        }
        return state;
      },
    },
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
