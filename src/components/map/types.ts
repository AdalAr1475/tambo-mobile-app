import type { LatLng } from '@/data/types';

export type MapMarker = {
  id: string;
  /** home/office/place: direcciones guardadas (casa, oficina u otra). */
  kind: 'store' | 'home' | 'office' | 'place' | 'user' | 'rider';
  position: LatLng;
  /**
   * Texto del marcador. En tiendas solo se muestra si están seleccionadas (píldora con nombre y ★);
   * en "user" el valor por defecto es "Estás aquí".
   */
  label?: string;
  /** Mini badge (ej. casilleros libres). */
  badge?: string;
  /** Estrellas de Google (solo tiendas; se muestran en la píldora de la seleccionada). */
  rating?: number;
  selected?: boolean;
};

export type MapLine = {
  id: string;
  points: LatLng[];
  /** route: pendiente (punteada) • travelled: recorrido (sólida) • walk: a pie (punteada fina). */
  style: 'route' | 'travelled' | 'walk';
};

/** brand: cobertura de una tienda • user: alrededor del punto de referencia. */
export type MapCircle = { id: string; center: LatLng; radius: number; tone?: 'brand' | 'user' };

export type MapData = {
  markers: MapMarker[];
  lines?: MapLine[];
  circles?: MapCircle[];
  /** Puntos que deben quedar visibles (se encuadran, con animación, al cambiar). */
  fit?: LatLng[];
  /** Margen (px) arriba/abajo al encuadrar `fit`, para no quedar bajo barras o carruseles. */
  fitPadding?: { top: number; bottom: number };
  /** Vuelo suave a un punto; cambia `key` para repetirlo (ej. "Centrar en mí"). */
  focus?: { point: LatLng; zoom?: number; key: string | number };
};

export type MapProps = MapData & {
  height: number;
  /** Arrastrar y hacer zoom (desactivar dentro de listas con scroll). */
  interactive?: boolean;
  /** Separación inferior (px) del zoom y la atribución (ej. sobre un carrusel). */
  controlsInset?: number;
  onMarkerPress?: (id: string) => void;
  /** Doble toque sobre un marcador (en tiendas: abrir la ficha en Google Maps). */
  onMarkerDoublePress?: (id: string) => void;
  /** No hay internet o el mapa no cargó: el padre debe mostrar el respaldo. */
  onFail?: () => void;
};
