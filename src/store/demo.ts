import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './storage';

/** Multiplicador del reloj de la simulación de pedidos. */
export type FastClock = 1 | 3;

type DemoState = {
  /** Muestra los controles "Simular…" (Modo Presentador). */
  enabled: boolean;
  fastClock: FastClock;
  /** Usar el GPS real del teléfono (si no, la ubicación de demo en Miraflores). */
  realLocation: boolean;
  setEnabled: (enabled: boolean) => void;
  setFastClock: (fastClock: FastClock) => void;
  setRealLocation: (realLocation: boolean) => void;
};

export const useDemo = create<DemoState>()(
  persist(
    (set) => ({
      enabled: false,
      fastClock: 1,
      realLocation: false,
      setEnabled: (enabled) => set({ enabled }),
      setFastClock: (fastClock) => set({ fastClock }),
      setRealLocation: (realLocation) => set({ realLocation }),
    }),
    { name: 'tambo-demo', storage: persistStorage, version: 1 },
  ),
);
