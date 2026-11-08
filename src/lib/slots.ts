import type { Fulfillment } from '@/data/types';

export type Slot = {
  id: string;
  day: 'hoy' | 'manana';
  start: number;
  end: number;
  /** Ej. "04:00 - 04:20 PM". */
  label: string;
};

/** Duración de cada bloque: el recojo es más preciso que la entrega. */
export const SLOT_MINUTES: Record<Fulfillment, number> = { pickup: 20, delivery: 30 };
/** Margen mínimo entre "ahora" y el inicio del primer bloque (preparación / trayecto). */
const LEAD_MINUTES: Record<Fulfillment, number> = { pickup: 20, delivery: 35 };
/** Último bloque del día termina a esta hora. */
const CLOSE_HOUR = 23;
/** Bloques de mañana: desde las 7:00 hasta las 11:00. */
const MORNING = { from: 7, to: 11 };
const MAX_PER_DAY = 8;

/** Cuánto tiempo guarda la tienda / Smart Locker un pedido listo. */
export const HOLD_MINUTES = 45;

const MINUTE = 60_000;

const hm = (d: Date) => {
  const h = d.getHours() % 12 || 12;
  return `${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const period = (d: Date) => (d.getHours() < 12 ? 'AM' : 'PM');

export function slotLabel(start: number, end: number) {
  const a = new Date(start);
  const b = new Date(end);
  return period(a) === period(b)
    ? `${hm(a)} - ${hm(b)} ${period(b)}`
    : `${hm(a)} ${period(a)} - ${hm(b)} ${period(b)}`;
}

/**
 * Bloques dinámicos de entrega/recojo calculados desde la hora actual: el primero empieza
 * después del margen de preparación, redondeado al siguiente múltiplo del bloque
 * (ej. 15:52 + 20 min = 16:12 → 16:20 - 16:40 en recojo).
 */
export function buildSlots(now: Date, fulfillment: Fulfillment): Slot[] {
  const step = SLOT_MINUTES[fulfillment];
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const tomorrow = new Date(midnight);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const make = (day: Slot['day'], base: Date, minute: number): Slot => {
    const start = base.getTime() + minute * MINUTE;
    const end = start + step * MINUTE;
    return { id: `${day}-${start}`, day, start, end, label: slotLabel(start, end) };
  };

  const slots: Slot[] = [];
  const minutesNow = (now.getTime() - midnight.getTime()) / MINUTE + LEAD_MINUTES[fulfillment];
  for (
    let m = Math.ceil(minutesNow / step) * step;
    m + step <= CLOSE_HOUR * 60 && slots.length < MAX_PER_DAY;
    m += step
  ) {
    slots.push(make('hoy', midnight, m));
  }
  let tomorrowCount = 0;
  for (let m = MORNING.from * 60; m + step <= MORNING.to * 60 && tomorrowCount < MAX_PER_DAY; m += step) {
    slots.push(make('manana', tomorrow, m));
    tomorrowCount++;
  }
  return slots;
}

/** Texto que se guarda en el pedido y se muestra en la boleta. */
export const slotDisplay = (s: Slot) => `${s.day === 'hoy' ? 'Hoy' : 'Mañana'}: ${s.label}`;
