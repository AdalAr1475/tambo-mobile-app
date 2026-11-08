import { useEffect, useState } from 'react';
import type { IconName } from '@/components/Icon';
import { getProduct } from '@/data/products';
import type { CategoryId, Order, Store } from '@/data/types';
import { DEMO_TIMELINE, orderClock } from './orderProgress';
import { HOLD_MINUTES } from './slots';

/**
 * Tambo Smart Lockers (simulados). En producción cada casillero tendría cerradura
 * electromecánica, sensor de temperatura y de peso conectados al backend; aquí todo se deriva
 * de forma determinista del pedido para que la demo sea estable.
 */

export type LockerZone = 'cold' | 'hot' | 'ambient';

export type LockerSlot = { index: number; code: string; zone: LockerZone };

export const ZONE_META: Record<LockerZone, { label: string; icon: IconName; temp: number }> = {
  cold: { label: 'Cámara fría', icon: 'snowflake', temp: 4.2 },
  hot: { label: 'Cámara térmica', icon: 'fire', temp: 60 },
  ambient: { label: 'Ambiente', icon: 'thermometer', temp: 21 },
};

/** Columnas del tótem (A-F); las filas dependen de la capacidad de la tienda. */
export const LOCKER_COLUMNS = 6;
const COLUMN_LETTERS = 'ABCDEF';

const ZONE_BY_CATEGORY: Partial<Record<CategoryId, LockerZone>> = {
  bebidas: 'cold',
  lacteos: 'cold',
  cafeteria: 'hot',
  comida: 'hot',
};

/** Hash FNV-1a de 32 bits: suficiente para derivar casilleros y PIN de forma estable. */
export function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const lockerCode = (index: number) =>
  `${COLUMN_LETTERS[index % LOCKER_COLUMNS]}${String(Math.floor(index / LOCKER_COLUMNS) + 1).padStart(2, '0')}`;

export const lockerCapacity = (store: Store) => store.lockers?.total ?? 36;

/** Zonas de temperatura que necesita el pedido (un pedido frío + caliente usa dos compartimentos). */
export function zonesFor(order: Order): LockerZone[] {
  const zones = new Set<LockerZone>();
  for (const item of order.items) {
    const product = getProduct(item.productId);
    zones.add((product && ZONE_BY_CATEGORY[product.categoryId]) ?? 'ambient');
  }
  const climate = (['cold', 'hot'] as const).filter((z) => zones.has(z));
  return climate.length ? climate : ['ambient'];
}

/** Compartimentos asignados (contiguos) para un pedido. Siempre los mismos para el mismo pedido. */
export function assignLockers(order: Order, store: Store): LockerSlot[] {
  const total = lockerCapacity(store);
  const start = hash(order.id) % total;
  return zonesFor(order).map((zone, i) => {
    const index = (start + i) % total;
    return { index, code: lockerCode(index), zone };
  });
}

/** PIN de 4 dígitos de respaldo del QR (mismo para todo el pedido). */
export const lockerPin = (order: Order) => String(hash(`${order.id}:${order.createdAt}`) % 10000).padStart(4, '0');

/** Casilleros ocupados por otros clientes (para dibujar el tótem). */
export function occupiedLockers(store: Store, assigned: LockerSlot[]) {
  const total = lockerCapacity(store);
  const busy = Math.max(0, total - (store.lockers?.free ?? 0) - assigned.length);
  const taken = new Set(assigned.map((s) => s.index));
  const occupied = new Set<number>();
  for (let i = 0; occupied.size < busy && i < total * 4; i++) {
    const index = hash(`${store.id}:${i}`) % total;
    if (!taken.has(index)) occupied.add(index);
  }
  return occupied;
}

/** Hora real en que el pedido queda listo y hasta cuándo se guarda en el casillero. */
export function lockerWindow(order: Order, now: number) {
  const readyAt = orderClock(order, now).at(DEMO_TIMELINE.pickupReady);
  return { readyAt, holdUntil: readyAt + HOLD_MINUTES * 60_000 };
}

/** "Telemetría IoT" simulada: la temperatura oscila ±0.3 °C alrededor del valor de la cámara. */
export function useLockerTelemetry(zone: LockerZone, enabled = true) {
  const base = ZONE_META[zone].temp;
  const [history, setHistory] = useState(() =>
    Array.from({ length: 10 }, (_, i) => +(base + Math.sin(i * 1.3) * 0.2).toFixed(1)),
  );
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => {
      setHistory((h) => [...h.slice(1), +(base + (Math.random() - 0.5) * 0.6).toFixed(1)]);
    }, 2000);
    return () => clearInterval(t);
  }, [base, enabled]);
  return { temp: history[history.length - 1], history };
}
