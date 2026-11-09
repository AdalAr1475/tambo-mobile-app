import { useEffect, useMemo, useRef, useState } from 'react';
import { buildMapHtml, LOAD_TIMEOUT_MS, type MapMessage } from './leafletHtml';
import type { MapProps } from './types';

/**
 * Estado del puente app ↔ página Leaflet (iframe en web):
 * HTML memorizado, payload serializado, timeout de carga y despacho de mensajes.
 */
export function useMapBridge({
  interactive = true,
  controlsInset = 0,
  onMarkerPress,
  onMarkerDoublePress,
  onFail,
  markers,
  lines,
  circles,
  fit,
  fitPadding,
  focus,
}: MapProps) {
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const html = useMemo(() => buildMapHtml(interactive, controlsInset), [interactive, controlsInset]);
  const payload = JSON.stringify({ markers, lines, circles, fit, fitPadding, focus });
  // Los callbacks cambian en cada render del padre: se leen desde una ref.
  const handlers = useRef({ onMarkerPress, onMarkerDoublePress, onFail });
  useEffect(() => {
    handlers.current = { onMarkerPress, onMarkerDoublePress, onFail };
  });

  // Sin tiles en LOAD_TIMEOUT_MS → sin conexión: el padre muestra el mapa de respaldo.
  useEffect(() => {
    if (loaded) return;
    const t = setTimeout(() => handlers.current.onFail?.(), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [loaded]);

  const onMessage = (msg: MapMessage) => {
    if (msg.type === 'ready') setReady(true);
    else if (msg.type === 'tiles') setLoaded(true);
    else if (msg.type === 'error') handlers.current.onFail?.();
    else if (msg.type === 'marker' && msg.id) handlers.current.onMarkerPress?.(msg.id);
    else if (msg.type === 'markerDouble' && msg.id) handlers.current.onMarkerDoublePress?.(msg.id);
  };

  return { html, payload, ready, loaded, onMessage };
}
