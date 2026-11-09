// Precalcula las rutas de la demo con OSRM (servidor público de FOSSGIS: routing.openstreetmap.de).
// Se corre a mano UNA vez (o cuando cambien las coordenadas):  node scripts/build-routes.mjs
// La app nunca llama a una API de ruteo en tiempo de ejecución: usa src/data/routes.json.
//  - car:  tienda → punto de entrega (casa, oficina y la ubicación de demo) si está en el radio de delivery
//  - foot: origen (demo = FIIS-UNI, casa, oficina) → tiendas de su zona (ruta peatonal "Cómo llegar")
// Cada ruta empieza y termina exactamente en los puntos pedidos (OSRM ajusta a la calle más cercana).
import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const places = read('../src/data/places.json');
const real = read('../src/data/realStores.json');
const BASE = 'https://routing.openstreetmap.de';
const MAX_POINTS = 90;
/** Mismo valor que DELIVERY_RANGE_METERS en src/lib/geo.ts. */
const DELIVERY_RANGE_METERS = 4000;

const R = 6_371_000;
const rad = (d) => (d * Math.PI) / 180;
const haversine = (a, b) => {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

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

const pt = (p) => [+p.lat.toFixed(6), +p.lng.toFixed(6)];

async function route(profile, from, to) {
  const service = profile === 'car' ? 'routed-car/route/v1/driving' : 'routed-foot/route/v1/foot';
  const url = `${BASE}/${service}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=${profile === 'foot'}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'tambo-plus-prototype/1.0 (university demo)' } });
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error(`${profile} ${data.code}`);
  const r = data.routes[0];
  const line = r.geometry.coordinates.map(([lng, lat]) => [+lat.toFixed(6), +lng.toFixed(6)]);
  const out = {
    meters: Math.round(r.distance),
    seconds: Math.round(r.duration),
    // Se anclan origen y destino exactos para que la app reconozca la ruta (tolerancia de 30 m).
    points: [pt(from), ...simplify(line), pt(to)],
  };
  if (profile === 'foot') {
    out.steps = r.legs[0].steps
      .filter((s) => s.distance > 5 || s.maneuver.type === 'arrive')
      .map((s) => ({ text: instruction(s), meters: Math.round(s.distance) }));
  }
  return out;
}

const stores = real.stores;
const origins = { demo: real.demoUser, casa: places.addresses.casa, oficina: places.addresses.oficina };
/** Puntos de entrega: direcciones semilla + "Mi ubicación" (FIIS-UNI) guardada como dirección. */
const dropoffs = { casa: places.addresses.casa, oficina: places.addresses.oficina, 'mi-ubicacion': real.demoUser };

const routes = { _source: 'OSRM (routing.openstreetmap.de) sobre datos © OpenStreetMap contributors. Generado por scripts/build-routes.mjs.' };
const jobs = [
  ...Object.entries(dropoffs).flatMap(([addressId, address]) =>
    stores
      .filter((s) => haversine(s, address) <= DELIVERY_RANGE_METERS)
      .map((s) => [`car:${s.id}:${addressId}`, 'car', s, address]),
  ),
  ...stores.map((s) => {
    const origin = s.area === 'uni' ? 'demo' : s.area;
    return [`foot:${origin}:${s.id}`, 'foot', origins[origin], s];
  }),
];

let failed = 0;
for (const [key, profile, from, to] of jobs) {
  try {
    routes[key] = await route(profile, from, to);
    console.log(key, `${routes[key].meters} m`, `${routes[key].points.length} pts`);
  } catch (e) {
    failed++;
    console.log(key, 'ERROR', e.message);
  }
  await new Promise((r) => setTimeout(r, 1100));
}
writeFileSync(new URL('../src/data/routes.json', import.meta.url), JSON.stringify(routes));
console.log(`Listo: src/data/routes.json (${jobs.length - failed}/${jobs.length} rutas)`);
