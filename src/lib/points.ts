import { round2 } from './format';

/**
 * Reglas del programa Tambo Lover Puntos (parámetros de negocio en un solo lugar).
 * Ojo: 10 pts por S/ 1 con 1 pt = S/ 0.01 devuelve 10 % del gasto; los programas reales en
 * Perú devuelven 1-3 %. Se deja alto para la demo.
 */
export const EARN_PER_SOL = 10;
/** Valor de un punto en soles (100 pts = S/ 1). */
export const POINT_VALUE = 0.01;
/** Saldo con el que arranca la demo (Reiniciar demo lo restaura). */
export const DEMO_START_BALANCE = 1200;
export const DEMO_TOP_UP = 1000;
/** Los pedidos Auto-Pilot acumulan puntos dobles. */
export const ROUTINE_POINTS_MULTIPLIER = 2;

export const LEVELS = [
  { id: 'fan', name: 'Tambo Fan', min: 0 },
  { id: 'lover', name: 'Tambo Lover', min: 1000 },
  { id: 'gold', name: 'Tambo Gold', min: 5000 },
  { id: 'pro', name: 'Tambo Pro', min: 15000 },
] as const;

export type Level = (typeof LEVELS)[number];

/** Puntos ganados por los soles pagados en productos (sin envío). Evita errores de coma flotante. */
export const earnFor = (cash: number, multiplier = 1) =>
  Math.floor((Math.round(Math.max(0, cash) * 100) * EARN_PER_SOL * multiplier) / 100);

export const pointsValue = (points: number) => round2(points * POINT_VALUE);

/** Máximo de puntos que cubren `soles` (redondeado hacia abajo). */
export const pointsForSoles = (soles: number) => Math.floor(Math.round(Math.max(0, soles) * 100) / (POINT_VALUE * 100));

/** El nivel depende de los puntos históricos ganados, no del saldo: canjear no te baja de nivel. */
export function levelFor(lifetime: number) {
  const index = LEVELS.reduce((acc, l, i) => (lifetime >= l.min ? i : acc), 0);
  const level = LEVELS[index];
  const next: Level | undefined = LEVELS[index + 1];
  const progress = next ? (lifetime - level.min) / (next.min - level.min) : 1;
  return { level, next, progress: Math.min(1, Math.max(0, progress)), toNext: next ? next.min - lifetime : 0 };
}

/** 1200 → "1,200". */
export const formatPoints = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const pts = (n: number) => `${formatPoints(n)} pts`;
