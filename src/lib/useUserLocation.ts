import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { DEMO_USER_LOCATION } from '@/data/stores';
import type { LatLng } from '@/data/types';
import { useDemo } from '@/store/demo';
import { storesByDistance } from './geo';

/** Si el GPS real está a más de esto de toda tienda, se usa la ubicación de demo. */
const MAX_DISTANCE_TO_STORE = 15_000;

export type UserLocation = {
  coords: LatLng;
  /** demo: ubicación fija • gps: GPS del teléfono • approx: se pidió GPS pero se usó la de demo. */
  source: 'demo' | 'gps' | 'approx';
};

const DEMO: UserLocation = { coords: DEMO_USER_LOCATION, source: 'demo' };

/**
 * Ubicación del usuario. Por defecto la de demo (Parque Kennedy) para que la presentación sea
 * estable; con "Usar mi GPS real" (Modo Presentador) pide permiso con expo-location.
 */
export function useUserLocation(): UserLocation {
  const realLocation = useDemo((s) => s.realLocation);
  const [gps, setGps] = useState<UserLocation>();

  useEffect(() => {
    if (!realLocation) return;
    let alive = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('denied');
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const near = storesByDistance(coords)[0].meters <= MAX_DISTANCE_TO_STORE;
        if (alive) setGps(near ? { coords, source: 'gps' } : { ...DEMO, source: 'approx' });
      } catch {
        if (alive) setGps({ ...DEMO, source: 'approx' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [realLocation]);

  return realLocation && gps ? gps : DEMO;
}
