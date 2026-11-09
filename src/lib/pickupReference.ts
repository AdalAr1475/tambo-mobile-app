import { useMemo } from 'react';
import { DEMO_USER_LABEL } from '@/data/stores';
import type { Address, LatLng } from '@/data/types';
import { useSession } from '@/store/session';
import { addressCoords } from './geo';
import { useUserLocation, type UserLocation } from './useUserLocation';

export type MarkerPlaceKind = 'home' | 'office' | 'place';

export type PickupReference = {
  /** 'me' o el id de la dirección. */
  id: string;
  /** Texto del chip (ej. "Mi ubicación (FIIS-UNI)", "Casa"). */
  label: string;
  /** Para frases: "a 300 m de ti" / "a 300 m de Casa". */
  fromText: string;
  coords: LatLng;
  kind: 'user' | MarkerPlaceKind;
};

/** Tipo de marcador para una dirección guardada según su etiqueta. */
export const addressKind = (a?: Pick<Address, 'label'>): MarkerPlaceKind =>
  a?.label === 'Casa' ? 'home' : a?.label === 'Oficina' ? 'office' : 'place';

/** Etiqueta de "mi ubicación": en la demo es la FIIS-UNI. */
export const myLocationLabel = (user: UserLocation) =>
  user.source === 'gps' ? 'Mi ubicación' : `Mi ubicación (${DEMO_USER_LABEL.replace(/\s/g, '')})`;

/** Opciones de "Recoger cerca de…": tu ubicación y cada dirección guardada. */
export function usePickupReferences(): PickupReference[] {
  const user = useUserLocation();
  const addresses = useSession((s) => s.addresses);
  return useMemo(
    () => [
      { id: 'me', label: myLocationLabel(user), fromText: 'ti', coords: user.coords, kind: 'user' as const },
      ...addresses.map((a) => ({
        id: a.id,
        label: a.label,
        fromText: a.label,
        coords: addressCoords(a),
        kind: addressKind(a),
      })),
    ],
    [user, addresses],
  );
}

/** Punto de referencia activo (persistido en useSession.pickupRef); si ya no existe, tu ubicación. */
export function usePickupReference(): PickupReference {
  const refs = usePickupReferences();
  const pickupRef = useSession((s) => s.pickupRef);
  return refs.find((r) => r.id === pickupRef) ?? refs[0];
}
