// Precalcula las rutas de la demo con OSRM (servidor público de FOSSGIS: routing.openstreetmap.de).
// Se corre a mano UNA vez (o cuando cambien las coordenadas):  node scripts/build-routes.mjs
// La app nunca llama a una API de ruteo en tiempo de ejecución: usa src/data/routes.json.
//  - car:  cada tienda → cada dirección semilla (telemetría del delivery)
//  - foot: ubicación demo del usuario → cada tienda (ruta peatonal "Cómo llegar")
import { readFileSync, writeFileSync } from 'node:fs';

const places = JSON.parse(readFileSync(new URL('../src/data/places.json', import.meta.url), 'utf8'));
const BASE = 'https://routing.openstreetmap.de';
const MAX_POINTS = 90;

const simplify = (coords) => {
  if (coords.length <= MAX_POINTS) return coords;
  const step = (coords.length - 1) / (MAX_POINTS - 1);
  return Array.from({ length: MAX_POINTS }, (_, i) => coords[Math.round(i * step)]);
};

const SIDE = { left: 'a la izquierda', right: 'a la derecha', 'slight left': 'ligeramente a la izquierda', 'slight right': 'ligeramente a la derecha', 'sharp left': 'a la izquierda', 'sharp right': 'a la derecha', straight: 'de frente', uturn: 'en U' };
const instruction = (s) => {
  const m = s.maneuver;
  const on = s.name ? ` por ${s.name}` : '';
  if (m.type === 'depart') return `Sal${on}`;
  if (m.type === 'arrive') return 'Llegas a la tienda';
  if (m.type === 'roundabout' || m.type === 'rotary') return `Toma la rotonda${on}`;
  if (m.modifier === 'straight') return `Sigue de frente${on}`;
  return `Gira ${SIDE[m.modifier] ?? ''}${on}`.replace(/\s+/g, ' ').trim();
};

async function route(profile, from, to) {
  const service = profile === 'car' ? 'routed-car/route/v1/driving' : 'routed-foot/route/v1/foot';
  const url = `${BASE}/${service}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=${profile === 'foot'}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'tambo-plus-prototype/1.0 (university demo)' } });
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error(`${profile} ${data.code}`);
  const r = data.routes[0];
  const out = {
    meters: Math.round(r.distance),
    seconds: Math.round(r.duration),
    points: simplify(r.geometry.coordinates.map(([lng, lat]) => [+lat.toFixed(6), +lng.toFixed(6)])),
  };
  if (profile === 'foot') {
    out.steps = r.legs[0].steps
      .filter((s) => s.distance > 5 || s.maneuver.type === 'arrive')
      .map((s) => ({ text: instruction(s), meters: Math.round(s.distance) }));
  }
  return out;
}

const routes = { _source: 'OSRM (routing.openstreetmap.de) sobre datos © OpenStreetMap contributors. Generado por scripts/build-routes.mjs.' };
const jobs = [
  ...Object.entries(places.stores).flatMap(([storeId, store]) =>
    Object.entries(places.addresses).map(([addressId, address]) => [`car:${storeId}:${addressId}`, 'car', store, address]),
  ),
  ...Object.entries(places.stores).map(([storeId, store]) => [`foot:demo:${storeId}`, 'foot', places.demoUser, store]),
];

for (const [key, profile, from, to] of jobs) {
  try {
    routes[key] = await route(profile, from, to);
    console.log(key, `${routes[key].meters} m`, `${routes[key].points.length} pts`);
  } catch (e) {
    console.log(key, 'ERROR', e.message);
  }
  await new Promise((r) => setTimeout(r, 1100));
}
writeFileSync(new URL('../src/data/routes.json', import.meta.url), JSON.stringify(routes));
console.log('Listo: src/data/routes.json');
