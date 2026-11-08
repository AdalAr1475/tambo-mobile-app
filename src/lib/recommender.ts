import type { IconName } from '@/components/Icon';
import { discountPercent, getProduct, products } from '@/data/products';
import type { CategoryId, Order, Product } from '@/data/types';
import { round2 } from './format';
import { computeTotals, lineTotal, type CartLine } from './pricing';

/**
 * Tambo IA — motor de recomendación local (sin red ni API keys).
 *
 * Es un recomendador híbrido y explicable:
 *  - comportamiento: frecuencia y recencia de lo que el usuario compró (historial de pedidos);
 *  - contenido: categorías, `pairsWith` y promociones del catálogo;
 *  - contexto: franja horaria;
 *  - optimización: elegir la mejor combinación sin pasarse del presupuesto ("Arma tu plan").
 * Cada sugerencia devuelve las señales usadas para mostrar "¿Por qué veo esto?".
 */

export type ItemQty = { productId: string; qty: number };

export type Signal = { label: string; value: number };

/* ——— Contexto: franja horaria ——— */

export type Daypart = 'breakfast' | 'afternoon' | 'night' | 'late';

export const DAYPARTS: Record<Daypart, { label: string; moment: string; boost: Partial<Record<CategoryId, number>> }> =
  {
    breakfast: { label: 'Desayuno', moment: 'tu mañana', boost: { cafeteria: 1, lacteos: 0.8, comida: 0.6 } },
    afternoon: { label: 'Tarde', moment: 'tu tarde', boost: { comida: 1, snacks: 0.8, bebidas: 0.6 } },
    night: { label: 'Noche', moment: 'tu noche', boost: { bebidas: 1, snacks: 0.85, abarrotes: 0.5 } },
    late: { label: 'Madrugada', moment: 'tu madrugada', boost: { snacks: 1, bebidas: 0.7 } },
  };

export function daypartOf(date: Date): Daypart {
  const h = date.getHours();
  if (h >= 6 && h < 11) return 'breakfast';
  if (h >= 11 && h < 18) return 'afternoon';
  if (h >= 18) return 'night';
  return 'late';
}

/** Qué tan bien encaja un producto en la franja (0..1). El alcohol no se sugiere de día. */
export function timeFit(p: Product, daypart: Daypart) {
  if (p.alcoholic && (daypart === 'breakfast' || daypart === 'afternoon')) return 0;
  // Hielo y piqueos van con la noche; un helado no es desayuno.
  if (daypart === 'night' && (p.id === 'hielo-2kg' || p.subcategory === 'Papas y piqueos')) return 1;
  if (daypart === 'breakfast' && p.subcategory === 'Helados') return 0.2;
  return DAYPARTS[daypart].boost[p.categoryId] ?? 0.2;
}

/** Complementos que no tienen sentido como protagonista de un combo. */
const NOT_ANCHOR = new Set(['hielo-2kg', 'agua-sanluis']);
/** Mínimo encaje horario para que algo del historial se sugiera ahora. */
const MIN_FIT = 0.5;

const STOP = new Set(['de', 'del', 'en', 'con', 'y', 'la', 'el']);
/** Nombre corto: "Hielo en cubos 2 kg" → "Hielo en cubos"; "Combo Piqueo: …" → "Combo Piqueo". */
export function shortName(p: Product) {
  if (p.brand && !p.brand.includes('Tambo') && p.brand.length <= 14) return p.brand;
  if (p.name.includes(':')) return p.name.split(':')[0];
  const words: string[] = [];
  for (const w of p.name.split(' ')) {
    if (/\d/.test(w) || words.length === 3) break;
    words.push(w);
  }
  while (words.length > 1 && STOP.has(words[words.length - 1].toLowerCase())) words.pop();
  return words.join(' ');
}

const isPromo = (p: Product) => discountPercent(p) > 0 || !!p.multiBuy || !!p.promoTags?.length;

/* ——— Comportamiento: afinidad por historial ——— */

const DAY = 24 * 60 * 60 * 1000;
/** Vida media de la afinidad: lo comprado hace 14 días pesa ~37 %. */
const DECAY_DAYS = 14;

export function affinityFrom(orders: Order[], now: number) {
  const score = new Map<string, number>();
  const times = new Map<string, number>();
  for (const o of orders) {
    if (o.cancelledAt) continue;
    const w = Math.exp(-Math.max(0, now - o.createdAt) / DAY / DECAY_DAYS);
    for (const i of o.items) {
      score.set(i.productId, (score.get(i.productId) ?? 0) + i.qty * w);
      times.set(i.productId, (times.get(i.productId) ?? 0) + 1);
    }
  }
  const max = Math.max(0, ...score.values());
  return { score, times, max };
}

/* ——— 1. "Para ti": combos personalizados ——— */

export type ComboSuggestion = {
  id: string;
  title: string;
  items: ItemQty[];
  /** Afinidad 70..98 %. */
  match: number;
  reason: string;
  signals: Signal[];
  total: number;
  regular: number;
  hasAlcohol: boolean;
};

const comboTitle = (anchor: Product, daypart: Daypart) => {
  const name = shortName(anchor);
  if (anchor.name.includes(':')) return `${name} recargado`;
  if (anchor.alcoholic) return `Previa ${name}`;
  if (daypart === 'breakfast' || anchor.categoryId === 'cafeteria') return `Desayuno con ${name}`;
  if (anchor.categoryId === 'snacks') return `Piqueo ${name}`;
  if (anchor.categoryId === 'comida') return `Antojo de ${name}`;
  return `Combo ${name}`;
};

const linesOf = (items: ItemQty[]): CartLine[] =>
  items.flatMap((i) => {
    const product = getProduct(i.productId);
    return product ? [{ product, qty: i.qty }] : [];
  });

/** Totales de un grupo de productos con las mismas reglas del carrito (2x1, promos). */
export const priceOf = (items: ItemQty[]) => {
  const t = computeTotals(linesOf(items), 'pickup');
  return { total: t.subtotal, regular: t.regularSubtotal };
};

export function forYou(orders: Order[], now: number, count = 3): ComboSuggestion[] {
  const daypart = daypartOf(new Date(now));
  const { score, times, max } = affinityFrom(orders, now);
  const recent = new Set(
    orders.filter((o) => !o.cancelledAt && now - o.createdAt < DAY).flatMap((o) => o.items.map((i) => i.productId)),
  );
  const rankByContext = (p: Product) => timeFit(p, daypart) * 0.6 + (p.popularity / 100) * 0.4;

  // Anclas: lo que más compra el usuario (si encaja en la franja) + lo mejor de la franja.
  const fromHistory = [...score.keys()]
    .map(getProduct)
    .filter((p): p is Product => !!p && !NOT_ANCHOR.has(p.id) && timeFit(p, daypart) >= MIN_FIT)
    .sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0));
  const fromContext = products
    .filter((p) => timeFit(p, daypart) >= 0.6)
    .sort((a, b) => rankByContext(b) - rankByContext(a));
  const contextAnchors = fromContext.filter((p) => !NOT_ANCHOR.has(p.id));
  const anchors: Product[] = [];
  for (const p of [...fromHistory.slice(0, 3), ...contextAnchors]) {
    if (anchors.length >= count + 2) break;
    if (!anchors.some((a) => a.id === p.id)) anchors.push(p);
  }

  const suggestions = anchors.map((anchor): ComboSuggestion => {
    const pairs = (anchor.pairsWith ?? [])
      .map(getProduct)
      .filter((p): p is Product => !!p && p.id !== anchor.id && !recent.has(p.id))
      .sort((a, b) => Number(isPromo(b)) - Number(isPromo(a)) || b.popularity - a.popularity);
    // Acompañantes: primero los `pairsWith` del ancla; si faltan, lo mejor de la franja en otra
    // categoría (y nunca dos bebidas con alcohol ni dos productos de la misma categoría).
    const companions: Product[] = [];
    for (const p of [...pairs, ...fromContext]) {
      if (companions.length === 2) break;
      if (p.id === anchor.id || companions.some((c) => c.id === p.id)) continue;
      if (p.alcoholic && (anchor.alcoholic || companions.some((c) => c.alcoholic))) continue;
      const fromPairs = pairs.includes(p);
      if (!fromPairs && [anchor, ...companions].some((c) => c.categoryId === p.categoryId)) continue;
      companions.push(p);
    }
    const items: ItemQty[] = [anchor, ...companions].map((p) => ({ productId: p.id, qty: 1 }));
    const { total, regular } = priceOf(items);
    const all = [anchor, ...companions];

    const aff = max > 0 ? (score.get(anchor.id) ?? 0) / max : 0;
    const time = timeFit(anchor, daypart);
    const promo = all.filter(isPromo).length / all.length;
    const value = 0.5 * aff + 0.3 * time + 0.2 * promo;
    const saving = round2(regular - total);
    const n = times.get(anchor.id) ?? 0;

    const weighted = [
      { kind: 'history', w: 0.5 * aff },
      { kind: 'time', w: 0.3 * time },
      { kind: 'promo', w: 0.2 * promo },
    ].sort((a, b) => b.w - a.w);
    const top = weighted[0].w > 0 ? weighted[0].kind : 'popular';
    const reason =
      top === 'history' && n > 0
        ? n === 1
          ? `Porque ya pediste ${shortName(anchor)}`
          : `Porque pediste ${shortName(anchor)} ${n} veces`
        : top === 'promo' && saving > 0
          ? `En promo hoy: ahorras S/ ${saving.toFixed(2)}`
          : top === 'time' || top === 'history'
            ? `Ideal para ${DAYPARTS[daypart].moment}`
            : 'Popular a esta hora';

    return {
      id: anchor.id,
      title: comboTitle(anchor, daypart),
      items,
      match: Math.round(70 + 28 * Math.min(1, value)),
      reason,
      signals: [
        { label: 'Tu historial de compras', value: aff },
        { label: `Momento del día (${DAYPARTS[daypart].label.toLowerCase()})`, value: time },
        { label: 'Promociones vigentes', value: promo },
      ],
      total,
      regular,
      hasAlcohol: all.some((p) => p.alcoholic),
    };
  });

  return suggestions.sort((a, b) => b.match - a.match).slice(0, count);
}

/* ——— 2. Complemento inteligente en el carrito ——— */

export type UpsellSuggestion = { productId: string; reason: string };

const hasCategory = (lines: CartLine[], test: (p: Product) => boolean) => lines.some((l) => test(l.product));

export function upsell(lines: CartLine[], orders: Order[]): UpsellSuggestion | null {
  if (lines.length === 0) return null;
  const inCart = new Set(lines.map((l) => l.product.id));
  const isDrink = (p: Product) => p.categoryId === 'bebidas';
  const softDrink = 'incakola-zero';

  const rules: [boolean, string, string][] = [
    [
      hasCategory(lines, (p) => !!p.alcoholic) && !inCart.has('hielo-2kg') && !inCart.has('combo-ron-hielo'),
      'hielo-2kg',
      'Para que tus bebidas lleguen bien heladas',
    ],
    [
      hasCategory(lines, (p) => p.subcategory === 'Café') &&
        !hasCategory(lines, (p) => p.subcategory === 'Desayunos' || p.categoryId === 'comida'),
      'croissant',
      'Tu café sabe mejor con un croissant recién horneado',
    ],
    [
      hasCategory(lines, (p) => p.categoryId === 'snacks') && !hasCategory(lines, isDrink),
      softDrink,
      'Para acompañar tus snacks',
    ],
    [
      hasCategory(lines, (p) => p.categoryId === 'comida') && !hasCategory(lines, isDrink),
      softDrink,
      'Tu comida pide una bebida bien fría',
    ],
  ];
  for (const [applies, productId, reason] of rules) {
    if (applies && !inCart.has(productId) && getProduct(productId)) return { productId, reason };
  }

  // Sin regla: el `pairsWith` que más se repite en tu historial junto a lo que llevas.
  const candidates = new Map<string, number>();
  for (const l of lines) {
    for (const id of l.product.pairsWith ?? []) {
      if (inCart.has(id) || !getProduct(id)) continue;
      const together = orders.filter(
        (o) => !o.cancelledAt && o.items.some((i) => i.productId === l.product.id) && o.items.some((i) => i.productId === id),
      ).length;
      candidates.set(id, (candidates.get(id) ?? 0) + together * 2 + getProduct(id)!.popularity / 100);
    }
  }
  const best = [...candidates].sort((a, b) => b[1] - a[1])[0];
  if (!best) return null;
  const anchor = lines.find((l) => l.product.pairsWith?.includes(best[0]))?.product;
  return {
    productId: best[0],
    reason: anchor ? `Combina perfecto con tu ${shortName(anchor)}` : 'Lo combinan mucho en Tambo',
  };
}

/* ——— 3. "Arma tu plan": combo óptimo por presupuesto ——— */

export type Vibe = 'patas' | 'estudio' | 'desayuno' | 'dulce';

type Slot = {
  key: string;
  label: string;
  required: boolean;
  /** Porciones necesarias para el grupo. */
  need: (people: number) => number;
  options: string[];
};

/** Porciones por unidad (un six-pack rinde 6; un combo de ron, ~10). */
const SERVINGS: Record<string, number> = {
  'pilsen-sixpack': 6,
  'cusquena-sixpack': 6,
  'fourloko-gold-pack': 2,
  'fourloko-sandia-pack': 2,
  'fourloko-gold': 1,
  'combo-ron-hielo': 10,
  'cartavio-coca': 10,
};

export const VIBES: Record<Vibe, { label: string; icon: IconName; slots: Slot[] }> = {
  patas: {
    label: 'Noche de patas',
    icon: 'glass-mug-variant',
    slots: [
      {
        key: 'drinks',
        label: 'Bebida',
        required: true,
        need: (n) => n * 2,
        options: ['pilsen-sixpack', 'cusquena-sixpack', 'fourloko-gold-pack', 'fourloko-sandia-pack', 'combo-ron-hielo'],
      },
      { key: 'ice', label: 'Hielo', required: true, need: (n) => Math.ceil(n / 4), options: ['hielo-2kg'] },
      {
        key: 'snack',
        label: 'Piqueo',
        required: true,
        need: (n) => Math.ceil(n / 3),
        options: ['lays-clasicas', 'piqueo-snax', 'doritos'],
      },
      {
        key: 'soda',
        label: 'Gaseosa',
        required: false,
        need: (n) => Math.ceil(n / 4),
        options: ['incakola-zero', 'cocacola-zero'],
      },
    ],
  },
  estudio: {
    label: 'Noche de estudio',
    icon: 'book-open-variant',
    slots: [
      { key: 'energy', label: 'Energía', required: true, need: (n) => n, options: ['monster', 'cafe-americano', 'capuccino'] },
      { key: 'sweet', label: 'Algo dulce', required: true, need: (n) => n, options: ['sublime', 'morochas'] },
      { key: 'water', label: 'Hidratación', required: false, need: (n) => n, options: ['agua-sanluis'] },
    ],
  },
  desayuno: {
    label: 'Desayuno express',
    icon: 'coffee-outline',
    slots: [
      { key: 'coffee', label: 'Café', required: true, need: (n) => n, options: ['cafe-americano', 'capuccino'] },
      { key: 'bread', label: 'Para comer', required: true, need: (n) => n, options: ['croissant', 'empanada-carne'] },
      { key: 'dairy', label: 'Lácteo', required: false, need: () => 1, options: ['yogurt-fresa', 'leche-gloria'] },
    ],
  },
  dulce: {
    label: 'Antojo dulce',
    icon: 'ice-cream',
    slots: [
      { key: 'icecream', label: 'Helado', required: true, need: (n) => n, options: ['donofrio-sinparar'] },
      { key: 'choco', label: 'Chocolate o galleta', required: true, need: (n) => n, options: ['sublime', 'morochas'] },
      {
        key: 'drink',
        label: 'Bebida',
        required: false,
        need: (n) => Math.ceil(n / 4),
        options: ['incakola-zero', 'cocacola-zero'],
      },
    ],
  },
};

export type PlanItem = ItemQty & {
  slotKey: string;
  slotLabel: string;
  note: string;
  cost: number;
  /** Hay otras opciones para este espacio del plan. */
  canSwap: boolean;
};

export type Plan =
  | {
      ok: true;
      items: PlanItem[];
      total: number;
      regular: number;
      budget: number;
      remaining: number;
      coverage: number;
      hasAlcohol: boolean;
    }
  | { ok: false; minBudget: number };

type Choice = { slot: Slot; product: Product; qty: number; cost: number };

const choose = (slot: Slot, product: Product, people: number): Choice => {
  const qty = Math.max(1, Math.ceil(slot.need(people) / (SERVINGS[product.id] ?? 1)));
  return { slot, product, qty, cost: lineTotal(product, qty) };
};

const optionsOf = (slot: Slot) => slot.options.map(getProduct).filter((p): p is Product => !!p);

/**
 * Mochila voraz: 1) llena los espacios obligatorios con la opción de mejor valor
 * (popularidad / costo); 2) agrega opcionales si alcanza; 3) mejora a opciones más populares
 * mientras no se pase del presupuesto. `overrides` fija un producto por espacio ("Cambiar").
 */
export function buildPlan(
  { budget, people, vibe }: { budget: number; people: number; vibe: Vibe },
  overrides: Record<string, string> = {},
): Plan {
  const slots = VIBES[vibe].slots;
  const best = (slot: Slot) => {
    const forced = overrides[slot.key] && getProduct(overrides[slot.key]);
    if (forced) return choose(slot, forced, people);
    return optionsOf(slot)
      .map((p) => choose(slot, p, people))
      .sort((a, b) => b.product.popularity / b.cost - a.product.popularity / a.cost)[0];
  };
  const cheapest = (slot: Slot) =>
    optionsOf(slot)
      .map((p) => choose(slot, p, people))
      .sort((a, b) => a.cost - b.cost)[0];

  const required = slots.filter((s) => s.required);
  let picks = required.map(best);
  let spent = picks.reduce((s, c) => s + c.cost, 0);
  if (spent > budget) {
    picks = required.map(cheapest);
    spent = picks.reduce((s, c) => s + c.cost, 0);
    if (spent > budget) return { ok: false, minBudget: Math.ceil(spent) };
  }

  for (const slot of slots.filter((s) => !s.required)) {
    const c = best(slot);
    if (c && spent + c.cost <= budget) {
      picks.push(c);
      spent += c.cost;
    }
  }

  // Mejora: opción más popular si el presupuesto lo permite (sin tocar las fijadas por el usuario).
  picks = picks.map((current) => {
    if (overrides[current.slot.key]) return current;
    const upgrade = optionsOf(current.slot)
      .filter((p) => p.popularity > current.product.popularity)
      .map((p) => choose(current.slot, p, people))
      .sort((a, b) => b.product.popularity - a.product.popularity)
      .find((c) => spent - current.cost + c.cost <= budget);
    if (!upgrade) return current;
    spent = spent - current.cost + upgrade.cost;
    return upgrade;
  });

  const items: PlanItem[] = picks.map((c) => ({
    productId: c.product.id,
    qty: c.qty,
    slotKey: c.slot.key,
    slotLabel: c.slot.label,
    cost: c.cost,
    canSwap: c.slot.options.length > 1,
    note: `${c.qty} x ${c.product.name} para ${people === 1 ? '1 persona' : `${people} personas`}`,
  }));
  const { total, regular } = priceOf(items);
  return {
    ok: true,
    items,
    total,
    regular,
    budget,
    remaining: round2(budget - total),
    coverage: picks.length / slots.length,
    hasAlcohol: picks.some((c) => !!c.product.alcoholic),
  };
}

/** Siguiente opción del espacio que entra en el presupuesto (botón "Cambiar"). */
export function nextOption(vibe: Vibe, slotKey: string, currentId: string) {
  const slot = VIBES[vibe].slots.find((s) => s.key === slotKey);
  if (!slot) return undefined;
  const i = slot.options.indexOf(currentId);
  return slot.options[(i + 1) % slot.options.length];
}
