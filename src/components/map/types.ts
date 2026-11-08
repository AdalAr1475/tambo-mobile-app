import type { LatLng } from '@/data/types';

export type MapMarker = {
  id: string;
  kind: 'store' | 'home' | 'user' | 'rider';
  position: LatLng;
  /** Texto bajo el marcador (ej. nombre de la tienda). */
  label?: string;
  /** Mini badge (ej. casilleros libres). */
  badge?: string;
  selected?: boolean;
};

export type MapLine = {
  id: string;
  points: LatLng[];
  /** route: pendiente (punteada) • travelled: recorrido (sólida) • walk: a pie (punteada fina). */
  style: 'route' | 'travelled' | 'walk';
};

export type MapCircle = { id: string; center: LatLng; radius: number };

export type MapData = {
  markers: MapMarker[];
  lines?: MapLine[];
  circles?: MapCircle[];
  /** Puntos que deben quedar visibles (se encuadran al cambiar). */
  fit?: LatLng[];
};

export type MapProps = MapData & {
  height: number;
  /** Arrastrar y hacer zoom (desactivar dentro de listas con scroll). */
  interactive?: boolean;
  onMarkerPress?: (id: string) => void;
  /** No hay internet o el mapa no cargó: el padre debe mostrar el respaldo. */
  onFail?: () => void;
};
