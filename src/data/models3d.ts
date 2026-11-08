/**
 * Modelos 3D procedurales del visor Tambo Spatial (It. 7 · T10).
 *
 * Solo datos: cada modelo es una lista de piezas (cilindros, domos, cajas…) en centímetros reales,
 * apoyadas sobre y = 0. `src/components/spatial/engine.ts` las convierte en mallas de three.
 * No hay archivos .glb: las texturas (etiquetas, manga del vaso) se generan con
 * `node scripts/build-textures.mjs` a partir de los diseños de `scripts/textures/`.
 */
import type { Model3dSpec } from './types';

export type Vec3 = [number, number, number];

export const TEXTURES = {
  'label-gold': require('../../assets/images/3d/label-fourloko-gold.png'),
  'label-sandia': require('../../assets/images/3d/label-fourloko-sandia.png'),
  'sleeve-cafe': require('../../assets/images/3d/sleeve-tambo-cafe.png'),
} as const;

export type TextureId = keyof typeof TEXTURES;

export type Shape =
  | { kind: 'cylinder'; rTop: number; rBottom: number; height: number; open?: boolean; segments?: number }
  /** Media esfera achatada, con la base en el origen (pan superior). */
  | { kind: 'dome'; radius: number; height: number }
  | { kind: 'torus'; radius: number; tube: number }
  | { kind: 'box'; w: number; h: number; d: number }
  /** Partículas de vapor que suben desde el origen. */
  | { kind: 'steam'; radius: number; height: number; count: number };

/** Acabado: decide el material (metal brillante, papel mate, etc.). */
export type Finish = 'metal' | 'label' | 'paper' | 'plastic' | 'food' | 'liquid' | 'steam';

export type Part = {
  id: string;
  /** Nombre de la pieza en la vista explosiva. Sin `label` no se rotula. */
  label?: string;
  detail?: string;
  /** Lado del rótulo (por defecto, derecha). */
  labelSide?: 'left' | 'right';
  shape: Shape;
  finish: Finish;
  color: string;
  texture?: TextureId;
  /** Centro de la pieza (cm). En `dome` es la base. */
  position: Vec3;
  rotation?: Vec3;
  /** Desplazamiento en la vista explosiva (cm). */
  explode: Vec3;
};

export type Model3d = {
  title: string;
  parts: Part[];
  /** Alto real en cm (la AR lo usa para el rótulo "Tamaño real"). */
  heightCm: number;
  sizeText: string;
};

export type CompareSet = {
  other: Model3d;
  mainCaption: string;
  otherCaption: string;
  /** Dónde va el otro modelo: el más grande siempre a la derecha. */
  otherSide: 'left' | 'right';
};

/** Colores de material (datos de los modelos, como el `tint` de los productos). */
const MAT = {
  aluminium: '#C9CDD3',
  paper: '#F6F2EA',
  coffee: '#3B2316',
  capuccino: '#8A5A3A',
  foam: '#EFDCC2',
  lid: '#2E1F2A',
  bread: '#D9A35F',
  pork: '#9C5A2E',
  sweetPotato: '#F0892A',
  onion: '#B8406A',
  bandGold: '#1C1C1C',
  bandSandia: '#1F7A35',
  white: '#FFFFFF',
} as const;

const cyl = (rTop: number, rBottom: number, height: number, extra: Partial<Extract<Shape, { kind: 'cylinder' }>> = {}): Shape => ({
  kind: 'cylinder',
  rTop,
  rBottom,
  height,
  ...extra,
});

const ZERO: Vec3 = [0, 0, 0];
const round1 = (n: number) => Math.round(n * 10) / 10;
const cm = (n: number) => `${round1(n).toFixed(1)} cm`;

/** Mueve un grupo de piezas: posición, explosión extra y prefijo de ids. */
function place(
  parts: Part[],
  { prefix, offset = ZERO, explode = ZERO, explodeScale = 1, keepLabels }: {
    prefix: string;
    offset?: Vec3;
    explode?: Vec3;
    explodeScale?: number;
    /** Ids de piezas que conservan su rótulo (o un rótulo nuevo); el resto se queda sin rótulo. */
    keepLabels?: Record<string, { label: string; detail?: string; labelSide?: 'left' | 'right' } | true>;
  },
): Part[] {
  return parts.map((p) => {
    const keep = keepLabels ? keepLabels[p.id] : true;
    const relabel = keep && keep !== true ? keep : undefined;
    return {
      ...p,
      id: `${prefix}${p.id}`,
      label: keep ? (relabel?.label ?? p.label) : undefined,
      detail: keep ? (relabel?.detail ?? p.detail) : undefined,
      labelSide: relabel?.labelSide ?? p.labelSide,
      position: [p.position[0] + offset[0], p.position[1] + offset[1], p.position[2] + offset[2]],
      explode: [
        p.explode[0] * explodeScale + explode[0],
        p.explode[1] * explodeScale + explode[1],
        p.explode[2] * explodeScale + explode[2],
      ],
    };
  });
}

/* ——— Lata ——— */

const CAN_R = 3.3;

function canParts(totalH: number, flavor: 'gold' | 'sandia', ml: number): Part[] {
  const bottomH = 1;
  const shoulderH = 0.9;
  const lidH = 0.2;
  const bodyH = totalH - bottomH - shoulderH - lidH;
  const yBody = bottomH + bodyH / 2;
  const circumference = 2 * Math.PI * CAN_R;
  return [
    {
      id: 'bottom',
      shape: cyl(CAN_R - 0.02, 2.6, bottomH),
      finish: 'metal',
      color: MAT.aluminium,
      position: [0, bottomH / 2, 0],
      explode: ZERO,
    },
    {
      id: 'body',
      label: `Lata de aluminio ${ml} ml`,
      detail: `Ø 6.6 × ${cm(totalH)}`,
      shape: cyl(CAN_R - 0.02, CAN_R - 0.02, bodyH),
      finish: 'metal',
      color: MAT.aluminium,
      position: [0, yBody, 0],
      explode: ZERO,
    },
    {
      id: 'label',
      label: 'Etiqueta',
      detail: `${cm(circumference)} × ${cm(bodyH)}`,
      labelSide: 'left',
      shape: cyl(CAN_R + 0.01, CAN_R + 0.01, bodyH * 0.985, { open: true }),
      finish: 'label',
      color: MAT.white,
      texture: flavor === 'gold' ? 'label-gold' : 'label-sandia',
      position: [0, yBody, 0],
      explode: [-8.5, 0, 0],
    },
    {
      id: 'shoulder',
      shape: cyl(2.75, CAN_R - 0.02, shoulderH),
      finish: 'metal',
      color: MAT.aluminium,
      position: [0, bottomH + bodyH + shoulderH / 2, 0],
      explode: ZERO,
    },
    {
      id: 'lid',
      shape: cyl(2.7, 2.7, lidH),
      finish: 'metal',
      color: MAT.aluminium,
      position: [0, totalH - lidH / 2, 0],
      explode: ZERO,
    },
    {
      id: 'tab',
      label: 'Anillo abre-fácil',
      detail: 'Aluminio reciclable',
      shape: { kind: 'torus', radius: 0.75, tube: 0.16 },
      finish: 'metal',
      color: MAT.aluminium,
      position: [0, totalH + 0.08, 0.9],
      rotation: [Math.PI / 2, 0, 0],
      explode: [0, 4, 0],
    },
  ];
}

const CAN_473_H = 15.7;
const CAN_355_H = 12.2;

function can473(flavor: 'gold' | 'sandia'): Model3d {
  return {
    title: 'Lata 473 ml',
    parts: canParts(CAN_473_H, flavor, 473),
    heightCm: CAN_473_H,
    sizeText: `Ø 6.6 × ${CAN_473_H} cm`,
  };
}

function can355(flavor: 'gold' | 'sandia'): Model3d {
  return {
    title: 'Lata 355 ml',
    parts: canParts(CAN_355_H, flavor, 355),
    heightCm: CAN_355_H,
    sizeText: `Ø 6.6 × ${CAN_355_H} cm`,
  };
}

function pack2(flavor: 'gold' | 'sandia'): Model3d {
  const one = canParts(CAN_473_H, flavor, 473);
  const gap = CAN_R + 0.05;
  return {
    title: 'Pack 2 latas 473 ml',
    parts: [
      ...place(one, {
        prefix: 'a-',
        offset: [-gap, 0, 0],
        explode: [-4.5, 0, 0],
        explodeScale: 0,
        keepLabels: { body: { label: 'Lata 1 · 473 ml', detail: `Ø 6.6 × ${CAN_473_H} cm`, labelSide: 'left' } },
      }),
      ...place(one, {
        prefix: 'b-',
        offset: [gap, 0, 0],
        explode: [4.5, 0, 0],
        explodeScale: 0,
        keepLabels: { body: { label: 'Lata 2 · 473 ml', detail: 'Bien helada', labelSide: 'right' } },
      }),
      {
        id: 'band',
        label: 'Faja de cartón',
        detail: 'Une el pack',
        shape: { kind: 'box', w: 4 * CAN_R + 0.5, h: 5, d: 2 * CAN_R + 0.3 },
        finish: 'paper',
        color: flavor === 'gold' ? MAT.bandGold : MAT.bandSandia,
        position: [0, 8.2, 0],
        explode: [0, -1.5, 5],
      },
    ],
    heightCm: CAN_473_H,
    sizeText: `13.3 × 6.6 × ${CAN_473_H} cm`,
  };
}

/* ——— Vaso de café ——— */

type Drink = 'americano' | 'capuccino';

function cupParts(oz: 12 | 16, drink: Drink): Part[] {
  const h = oz === 12 ? 11 : 13.5;
  const rT = 4.5;
  const rB = oz === 12 ? 2.9 : 3;
  const r = (y: number) => rB + ((rT - rB) * y) / h;
  const fill = h * 0.9;
  const sleeve0 = h * 0.26;
  const sleeve1 = h * 0.66;
  const foam = drink === 'capuccino';
  // Explosión vertical: el café sale del vaso, la espuma encima y la tapa arriba de todo.
  const coffeeLift = h + 2.5;
  const coffeeTop = coffeeLift + fill;
  const foamLift = coffeeTop + 1.4 - fill;
  const lidLift = coffeeTop + (foam ? 3.2 : 1.6) + 1 - h;
  const parts: Part[] = [
    {
      id: 'cup',
      label: `Vaso de cartón ${oz} oz`,
      detail: `${oz === 12 ? 355 : 473} ml · ${cm(h)}`,
      labelSide: 'left',
      shape: cyl(rT, rB, h),
      finish: 'paper',
      color: MAT.paper,
      position: [0, h / 2, 0],
      explode: ZERO,
    },
    {
      id: 'sleeve',
      shape: cyl(r(sleeve1) + 0.07, r(sleeve0) + 0.07, sleeve1 - sleeve0, { open: true }),
      finish: 'paper',
      color: MAT.white,
      texture: 'sleeve-cafe',
      position: [0, (sleeve0 + sleeve1) / 2, 0],
      explode: ZERO,
    },
    {
      id: 'coffee',
      label: drink === 'capuccino' ? 'Capuccino' : 'Café americano',
      detail: 'Servido a ~70 °C',
      shape: cyl(r(fill) - 0.15, rB - 0.15, fill),
      finish: 'liquid',
      color: drink === 'capuccino' ? MAT.capuccino : MAT.coffee,
      position: [0, fill / 2, 0],
      explode: [0, coffeeLift, 0],
    },
    {
      id: 'lid',
      label: 'Tapa con boquilla',
      detail: 'Evita derrames',
      labelSide: 'left',
      shape: cyl(rT - 0.7, rT + 0.15, 1.1),
      finish: 'plastic',
      color: MAT.lid,
      position: [0, h + 0.55, 0],
      explode: [0, lidLift, 0],
    },
    {
      id: 'steam',
      shape: { kind: 'steam', radius: 1.3, height: 6, count: 22 },
      finish: 'steam',
      color: MAT.white,
      position: [0, h + 1.2, 0],
      explode: [0, lidLift, 0],
    },
  ];
  if (foam) {
    parts.splice(3, 0, {
      id: 'foam',
      label: 'Espuma de leche',
      detail: 'Con un toque de canela',
      shape: cyl(r(fill) - 0.12, r(fill) - 0.2, 0.9, { segments: 40 }),
      finish: 'food',
      color: MAT.foam,
      position: [0, fill + 0.45, 0],
      explode: [0, foamLift, 0],
    });
  }
  return parts;
}

function cup(oz: 12 | 16, drink: Drink): Model3d {
  const h = oz === 12 ? 11 : 13.5;
  return {
    title: `Vaso ${oz} oz`,
    parts: cupParts(oz, drink),
    heightCm: round1(h + 1.1),
    sizeText: `Ø 9 × ${cm(h + 1.1)} (con tapa)`,
  };
}

/* ——— Pan con chicharrón ——— */

function sandwichParts(): Part[] {
  return [
    {
      id: 'bun-bottom',
      label: 'Pan francés',
      detail: 'Horneado del día',
      labelSide: 'left',
      shape: cyl(5, 4.7, 1.8),
      finish: 'food',
      color: MAT.bread,
      position: [0, 0.9, 0],
      explode: ZERO,
    },
    {
      id: 'pork',
      label: 'Chicharrón',
      detail: 'Cerdo criollo',
      shape: cyl(5.05, 5.15, 1.4, { segments: 9 }),
      finish: 'food',
      color: MAT.pork,
      position: [0, 2.5, 0],
      explode: [0, 2.3, 0],
    },
    {
      id: 'sweet-potato',
      label: 'Camote frito',
      labelSide: 'left',
      shape: cyl(4.6, 4.6, 0.6, { segments: 12 }),
      finish: 'food',
      color: MAT.sweetPotato,
      position: [0, 3.5, 0],
      explode: [0, 4.4, 0],
    },
    {
      id: 'sarsa',
      label: 'Sarsa criolla',
      detail: 'Cebolla, ají y limón',
      shape: cyl(4.9, 4.9, 0.5, { segments: 10 }),
      finish: 'food',
      color: MAT.onion,
      position: [0, 4.05, 0],
      explode: [0, 6.5, 0],
    },
    {
      id: 'bun-top',
      label: 'Pan (tapa)',
      labelSide: 'left',
      shape: { kind: 'dome', radius: 5, height: 2.8 },
      finish: 'food',
      color: MAT.bread,
      position: [0, 4.3, 0],
      explode: [0, 8.8, 0],
    },
  ];
}

function sandwich(): Model3d {
  return { title: 'Pan con chicharrón', parts: sandwichParts(), heightCm: 7.1, sizeText: 'Ø 10 × 7 cm' };
}

function combo(): Model3d {
  return {
    title: 'Combo Sanguchero',
    parts: [
      ...place(sandwichParts(), {
        prefix: 's-',
        offset: [-6.2, 0, 0],
        explode: [-4, 0, 0],
        explodeScale: 0,
        keepLabels: {
          'bun-top': { label: 'Pan con chicharrón', detail: 'Camote y sarsa criolla', labelSide: 'left' },
        },
      }),
      ...place(cupParts(12, 'americano'), {
        prefix: 'c-',
        offset: [6.2, 0, 0],
        explode: [4, 0, 0],
        explodeScale: 0,
        keepLabels: { lid: { label: 'Café americano 12 oz', detail: 'Servido a ~70 °C', labelSide: 'right' } },
      }),
    ],
    heightCm: 12.1,
    sizeText: 'Pan Ø 10 cm + vaso 12 oz',
  };
}

/** Modelo del producto y, si aplica, el comparador de tamaño. */
export function getModel3d(spec: Model3dSpec): { model: Model3d; compare?: CompareSet } {
  switch (spec.kind) {
    case 'can473':
      return {
        model: can473(spec.flavor),
        compare: {
          other: can355(spec.flavor),
          mainCaption: `473 ml · ${CAN_473_H} cm`,
          otherCaption: `355 ml · ${CAN_355_H} cm`,
          otherSide: 'left',
        },
      };
    case 'pack2':
      return { model: pack2(spec.flavor) };
    case 'cup12':
      return {
        model: cup(12, spec.drink),
        compare: {
          other: cup(16, spec.drink),
          mainCaption: '12 oz · 355 ml',
          otherCaption: '16 oz · 473 ml',
          otherSide: 'right',
        },
      };
    case 'sandwich':
      return { model: sandwich() };
    case 'combo':
      return { model: combo() };
  }
}

/** Rótulos que dibuja el visor, en el mismo orden en que el motor calcula sus anclas. */
export type ViewerLabel =
  | { id: string; kind: 'part'; label: string; detail?: string; side: 'left' | 'right' }
  | { id: string; kind: 'caption'; label: string };

export function viewerLabels(model: Model3d, compare?: CompareSet): ViewerLabel[] {
  const parts: ViewerLabel[] = model.parts
    .filter((p) => !!p.label)
    .map((p) => ({ id: p.id, kind: 'part', label: p.label!, detail: p.detail, side: p.labelSide ?? 'right' }));
  if (!compare) return parts;
  return [
    ...parts,
    { id: 'caption-main', kind: 'caption', label: compare.mainCaption },
    { id: 'caption-other', kind: 'caption', label: compare.otherCaption },
  ];
}
