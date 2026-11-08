import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { Address, Order } from '@/data/types';
import { toCartLines } from '@/store/cart';
import { useRoutines, type Routine } from '@/store/routines';
import { useSession } from '@/store/session';
import { toast } from '@/store/ui';
import { balanceOf, useWallet } from '@/store/wallet';
import { round2 } from './format';
import { placeOrder } from './placeOrder';
import { computeTotals } from './pricing';

/**
 * Tambo Auto-Pilot: pedidos programados y recurrentes.
 * En producción la ejecución vive en el servidor (cron por rutina + cobro tokenizado); en el
 * prototipo se dispara con "Simular" o cuando la app está abierta a la hora programada.
 */

const DAY = 24 * 60 * 60 * 1000;
/** Ventana tras la hora programada en la que el runner todavía ejecuta la rutina. */
const RUN_WINDOW_MS = 10 * 60 * 1000;

export const DAY_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const DAY_PRESETS = [
  { label: 'Lunes a viernes', days: [1, 2, 3, 4, 5] },
  { label: 'Todos los días', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Fines de semana', days: [0, 6] },
];

/** Horas elegibles: de 06:00 a 22:00 cada 30 min. */
export const TIME_OPTIONS = Array.from({ length: 33 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

const pad = (n: number) => String(n).padStart(2, '0');
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "07:00" → "7:00 AM". */
export function timeLabel(time: string) {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

export function runAt(day: Date, time: string) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}

export function daysLabel(days: number[]) {
  const set = [...days].sort().join(',');
  const preset = DAY_PRESETS.find((p) => [...p.days].sort().join(',') === set);
  if (preset) return preset.label;
  if (days.length === 1) return `Cada ${DAY_NAMES[days[0]].toLowerCase()}`;
  return DAY_ORDER.filter((d) => days.includes(d))
    .map((d) => DAY_NAMES[d].slice(0, 3))
    .join(', ');
}

/** Próxima ejecución (respeta días, fechas saltadas y si ya corrió hoy). */
export function nextRun(r: Pick<Routine, 'days' | 'time' | 'skipDates' | 'lastRunDate' | 'active'>, now: number) {
  if (!r.active || r.days.length === 0) return null;
  for (let i = 0; i < 15; i++) {
    const day = new Date(now + i * DAY);
    const key = dateKey(day);
    const at = runAt(day, r.time);
    if (!r.days.includes(day.getDay()) || r.skipDates.includes(key) || r.lastRunDate === key) continue;
    if (at.getTime() > now) return at;
  }
  return null;
}

export function nextRunLabel(date: Date, now: number) {
  const today = dateKey(new Date(now));
  const tomorrow = dateKey(new Date(now + DAY));
  const key = dateKey(date);
  const day = key === today ? 'Hoy' : key === tomorrow ? 'Mañana' : DAY_NAMES[date.getDay()];
  return `${day} ${timeLabel(`${pad(date.getHours())}:${pad(date.getMinutes())}`)}`;
}

export function countdownLabel(date: Date, now: number) {
  const mins = Math.max(0, Math.round((date.getTime() - now) / 60_000));
  if (mins < 60) return `en ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `en ${hours} h ${mins % 60} min`;
  const days = Math.round(hours / 24);
  return `en ${days} ${days === 1 ? 'día' : 'días'}`;
}

/** Totales de una entrega con el beneficio Auto-Pilot (10 % + envío gratis + puntos dobles). */
export const routineTotals = (r: Pick<Routine, 'items' | 'fulfillment'>) =>
  computeTotals(toCartLines(r.items), r.fulfillment, undefined, { routine: true, earnMultiplier: 2 });

/** Entregas en los próximos 30 días y gasto estimado. */
export function monthlyEstimate(r: Routine, now: number) {
  let deliveries = 0;
  for (let i = 0; i < 30; i++) {
    const day = new Date(now + i * DAY);
    if (r.days.includes(day.getDay()) && !r.skipDates.includes(dateKey(day))) deliveries++;
  }
  const perDelivery = routineTotals(r).total;
  return { deliveries, perDelivery, total: round2(perDelivery * deliveries) };
}

/* ——— Plantillas en 1 toque ——— */

export type RoutineTemplate = {
  key: string;
  label: string;
  build: (ctx: { addresses: Address[]; storeId: string }) => Omit<Routine, 'id' | 'createdAt' | 'skipDates' | 'active'>;
};

const addressByLabel = (addresses: Address[], label: string) =>
  (addresses.find((a) => a.label === label) ?? addresses[0])?.id;

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    key: 'desayuno',
    label: 'Desayuno oficina',
    build: ({ addresses, storeId }) => ({
      name: 'Desayuno oficina 7 AM',
      icon: 'briefcase-outline',
      items: [
        { productId: 'pan-chicharron', qty: 1 },
        { productId: 'agua-sanluis', qty: 1 },
      ],
      days: [1, 2, 3, 4, 5],
      time: '07:00',
      fulfillment: 'delivery',
      addressId: addressByLabel(addresses, 'Oficina'),
      storeId,
      payment: 'yape',
    }),
  },
  {
    key: 'hidratacion',
    label: 'Hidratación diaria',
    build: ({ storeId }) => ({
      name: 'Hidratación diaria',
      icon: 'water-outline',
      items: [{ productId: 'agua-sanluis', qty: 2 }],
      days: [0, 1, 2, 3, 4, 5, 6],
      time: '08:00',
      fulfillment: 'pickup',
      storeId,
      pickupMethod: 'locker',
      payment: 'yape',
    }),
  },
  {
    key: 'estudio',
    label: 'Noche de estudio',
    build: ({ addresses, storeId }) => ({
      name: 'Noche de estudio',
      icon: 'book-open-variant',
      items: [
        { productId: 'monster', qty: 2 },
        { productId: 'morochas', qty: 1 },
      ],
      days: [1, 2, 3, 4],
      time: '20:00',
      fulfillment: 'delivery',
      addressId: addressByLabel(addresses, 'Casa'),
      storeId,
      payment: 'yape',
    }),
  },
  {
    key: 'viernes',
    label: 'Viernes de patas',
    build: ({ addresses, storeId }) => ({
      name: 'Viernes de patas',
      icon: 'party-popper',
      items: [
        { productId: 'fourloko-gold-pack', qty: 1 },
        { productId: 'hielo-2kg', qty: 1 },
        { productId: 'piqueo-snax', qty: 1 },
      ],
      days: [5],
      time: '19:00',
      fulfillment: 'delivery',
      addressId: addressByLabel(addresses, 'Casa'),
      storeId,
      payment: 'yape',
    }),
  },
];

/* ——— Ejecución ——— */

const PAYMENT_LABEL = {
  yape: 'Yape Auto-Pay (Auto-Pilot)',
  points: 'Tambo Lover Puntos + Yape Auto-Pay',
};

/** Crea el pedido de la rutina ahora mismo. No toca el carrito del usuario. */
export function runRoutine(r: Routine, now = Date.now()): Order {
  const session = useSession.getState();
  const address = session.addresses.find((a) => a.id === r.addressId) ?? session.addresses[0];
  if (r.fulfillment === 'delivery' && !address) {
    throw new Error('La rutina no tiene una dirección de entrega válida.');
  }
  const card = session.cards[0];
  const payment: Order['payment'] =
    r.payment === 'card' && card
      ? { method: 'card', label: `Tarjeta ${card.brand} •••• ${card.last4} (Auto-Pilot)` }
      : { method: 'yape', label: PAYMENT_LABEL[r.payment === 'points' ? 'points' : 'yape'] };
  const order = placeOrder({
    items: r.items,
    fulfillment: r.fulfillment,
    storeId: r.storeId,
    address,
    pickupMethod: r.pickupMethod,
    schedule: { type: 'asap' },
    payment,
    // Pago con puntos: usa todo el saldo que haga falta; el resto va por Yape Auto-Pay.
    pointsToUse: r.payment === 'points' ? balanceOf(useWallet.getState().ledger) : undefined,
    routineId: r.id,
    clearCart: false,
  });
  useRoutines.getState().markRun(r.id, dateKey(new Date(now)));
  return order;
}

/** Rutinas cuya hora de hoy ya llegó (hace menos de 10 min) y aún no corrieron. */
export function dueRoutines(routines: Routine[], now: number) {
  const today = new Date(now);
  const key = dateKey(today);
  return routines.filter((r) => {
    if (!r.active || r.lastRunDate === key || r.skipDates.includes(key) || !r.days.includes(today.getDay())) {
      return false;
    }
    const at = runAt(today, r.time).getTime();
    return now >= at && now - at < RUN_WINDOW_MS && r.createdAt <= at;
  });
}

/** Ejecuta una rutina y avisa con un banner in-app (las push requieren development build). */
export function runRoutineWithNotice(r: Routine, opts: { simulated?: boolean } = {}) {
  try {
    const order = runRoutine(r);
    toast(`${opts.simulated ? 'Simulación: ' : ''}tu rutina "${r.name}" generó el pedido #${order.id}`, {
      icon: 'autorenew',
      tone: 'success',
      action: { label: 'Ver pedido', onPress: () => router.push(`/pedido/seguimiento/${order.id}`) },
    });
    return order;
  } catch (e) {
    toast(e instanceof Error ? e.message : 'No pudimos ejecutar tu rutina', { tone: 'error' });
    return undefined;
  }
}

/** Revisa cada minuto (y al volver a primer plano) si hay rutinas por ejecutar. */
export function useRoutineRunner(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const check = () => {
      for (const r of dueRoutines(useRoutines.getState().routines, Date.now())) runRoutineWithNotice(r);
    };
    check();
    const timer = setInterval(check, 60_000);
    const sub = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [enabled]);
}
