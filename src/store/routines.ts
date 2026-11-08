import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IconName } from '@/components/Icon';
import type { Fulfillment, PickupMethod } from '@/data/types';
import type { CartItem } from './cart';
import { persistStorage } from './storage';

/** Cómo se cobra cada entrega automática. */
export type RoutinePayment = 'yape' | 'card' | 'points';

/** Rutina Tambo Auto-Pilot: un pedido que se repite solo (ej. desayuno L-V a las 7:00). */
export type Routine = {
  id: string;
  name: string;
  icon: IconName;
  items: CartItem[];
  /** Días de la semana: 0 = domingo … 6 = sábado. */
  days: number[];
  /** Hora de entrega/recojo "HH:mm". */
  time: string;
  fulfillment: Fulfillment;
  addressId?: string;
  storeId: string;
  pickupMethod?: PickupMethod;
  payment: RoutinePayment;
  active: boolean;
  /** Fechas "YYYY-MM-DD" que el usuario decidió saltar. */
  skipDates: string[];
  /** Último día en que se ejecutó (evita duplicados). */
  lastRunDate?: string;
  createdAt: number;
};

type RoutinesState = {
  routines: Routine[];
  save: (routine: Routine) => void;
  remove: (id: string) => void;
  toggle: (id: string) => void;
  skip: (id: string, date: string) => void;
  unskip: (id: string, date: string) => void;
  markRun: (id: string, date: string) => void;
};

const patch = (routines: Routine[], id: string, fn: (r: Routine) => Partial<Routine>) =>
  routines.map((r) => (r.id === id ? { ...r, ...fn(r) } : r));

export const useRoutines = create<RoutinesState>()(
  persist(
    (set) => ({
      routines: [],
      save: (routine) =>
        set((s) => ({
          routines: s.routines.some((r) => r.id === routine.id)
            ? patch(s.routines, routine.id, () => routine)
            : [routine, ...s.routines],
        })),
      remove: (id) => set((s) => ({ routines: s.routines.filter((r) => r.id !== id) })),
      toggle: (id) => set((s) => ({ routines: patch(s.routines, id, (r) => ({ active: !r.active })) })),
      skip: (id, date) =>
        set((s) => ({ routines: patch(s.routines, id, (r) => ({ skipDates: [...new Set([...r.skipDates, date])] })) })),
      unskip: (id, date) =>
        set((s) => ({ routines: patch(s.routines, id, (r) => ({ skipDates: r.skipDates.filter((d) => d !== date) })) })),
      markRun: (id, date) => set((s) => ({ routines: patch(s.routines, id, () => ({ lastRunDate: date })) })),
    }),
    { name: 'tambo-routines', storage: persistStorage, version: 1, migrate: (p) => p as RoutinesState },
  ),
);

export const useRoutine = (id: string | undefined) => useRoutines((s) => s.routines.find((r) => r.id === id));
