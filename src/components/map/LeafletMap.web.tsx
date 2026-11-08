import { useEffect } from 'react';
import type { MapProps } from './types';

/**
 * En web no hay react-native-webview: SmartMap muestra el mapa de respaldo (SVG).
 * La demo oficial es en Expo Go; la web es solo respaldo.
 */
export function LeafletMap({ onFail }: MapProps) {
  useEffect(() => {
    onFail?.();
  }, [onFail]);
  return null;
}
