import type { Address, LatLng, Store } from '@/data/types';
import { addressCoords } from '@/lib/geo';
import { addressKind } from '@/lib/pickupReference';
import type { MapMarker } from './types';

export const STORE_MARKER_PREFIX = 'store:';
export const ADDRESS_MARKER_PREFIX = 'addr:';

/** Pin de tienda: la seleccionada muestra la píldora con nombre y ★. */
export const storeMarker = (store: Store, selected = false): MapMarker => ({
  id: `${STORE_MARKER_PREFIX}${store.id}`,
  kind: 'store',
  position: store.coords,
  label: store.name,
  rating: store.rating,
  badge: store.lockers ? `🔒${store.lockers.free}` : undefined,
  selected,
});

/** Pin de dirección guardada (casa, oficina u otra). */
export const addressMarker = (a: Address, label: string = a.label): MapMarker => ({
  id: `${ADDRESS_MARKER_PREFIX}${a.id}`,
  kind: addressKind(a),
  position: addressCoords(a),
  label,
});

export const userMarker = (position: LatLng, label?: string): MapMarker => ({
  id: 'user',
  kind: 'user',
  position,
  label,
});

/** Id de tienda desde el id del marcador (`store:uni-puerta-5` → `uni-puerta-5`). */
export const storeIdOf = (markerId: string) =>
  markerId.startsWith(STORE_MARKER_PREFIX) ? markerId.slice(STORE_MARKER_PREFIX.length) : undefined;
