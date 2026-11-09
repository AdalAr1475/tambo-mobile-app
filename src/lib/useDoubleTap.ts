import { useCallback, useEffect, useMemo, useRef } from 'react';

/** Ventana para considerar dos toques como doble toque (igual que en el mapa Leaflet). */
export const DOUBLE_TAP_MS = 300;

/**
 * Distingue toque simple y doble toque por id (filas de tiendas o pines del mapa).
 * `tap(id)`: el segundo toque sobre el mismo id dentro de la ventana dispara `onDouble`; si no
 * llega, `onSingle` se ejecuta al cerrar la ventana. `double(id)` fuerza el doble toque (el mapa
 * ya lo detecta por su cuenta) y cancela el simple pendiente.
 */
export function useDoubleTap(onSingle: (id: string) => void, onDouble: (id: string) => void) {
  const pending = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | undefined>(undefined);
  const callbacks = useRef({ onSingle, onDouble });
  useEffect(() => {
    callbacks.current = { onSingle, onDouble };
  });
  useEffect(() => () => clearTimeout(pending.current?.timer), []);

  const double = useCallback((id: string) => {
    clearTimeout(pending.current?.timer);
    pending.current = undefined;
    callbacks.current.onDouble(id);
  }, []);

  const tap = useCallback(
    (id: string) => {
      const prev = pending.current;
      if (prev?.id === id) return double(id);
      if (prev) clearTimeout(prev.timer);
      const timer = setTimeout(() => {
        pending.current = undefined;
        callbacks.current.onSingle(id);
      }, DOUBLE_TAP_MS);
      pending.current = { id, timer };
    },
    [double],
  );

  return useMemo(() => ({ tap, double }), [tap, double]);
}
