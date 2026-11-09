import type { LatLng } from '@/data/types';

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distancia en metros entre dos coordenadas (sin red). Vive aparte para que `src/data` la use sin ciclos. */
export function haversine(a: LatLng, b: LatLng) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
