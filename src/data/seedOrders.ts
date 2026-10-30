import { computeTotals, lineTotal } from '@/lib/pricing';
import { getProduct } from './products';
import { seedAddresses } from './stores';
import type { Order, OrderItem } from './types';

const DAY = 24 * 60 * 60 * 1000;

export const toOrderItems = (lines: { productId: string; qty: number }[]): OrderItem[] =>
  lines.flatMap(({ productId, qty }) => {
    const p = getProduct(productId);
    if (!p) return [];
    return [
      {
        productId,
        name: p.name,
        subtitle: p.subtitle,
        qty,
        price: p.price,
        regularPrice: p.regularPrice,
        lineTotal: lineTotal(p, qty),
      },
    ];
  });

const build = (
  id: string,
  daysAgo: number,
  hour: number,
  lines: { productId: string; qty: number }[],
  rest: Pick<Order, 'fulfillment' | 'storeId' | 'payment'> & Partial<Order>,
): Order => {
  const createdAt = new Date(Date.now() - daysAgo * DAY).setHours(hour, 18, 0, 0);
  const items = toOrderItems(lines);
  const t = computeTotals(
    lines.map((l) => ({ product: getProduct(l.productId)!, qty: l.qty })),
    rest.fulfillment,
  );
  return {
    id,
    createdAt,
    items,
    schedule: { type: 'asap' },
    totals: {
      regularSubtotal: t.regularSubtotal,
      productDiscount: t.productDiscount,
      couponDiscount: 0,
      shipping: t.shipping,
      total: t.total,
    },
    seeded: true,
    rating: 5,
    ...rest,
  };
};

export const createSeedOrders = (): Order[] => [
  build(
    'TB-81107',
    2,
    21,
    [
      { productId: 'fourloko-gold-pack', qty: 1 },
      { productId: 'hielo-2kg', qty: 1 },
    ],
    {
      fulfillment: 'delivery',
      storeId: 'larco',
      address: seedAddresses[0],
      payment: { method: 'yape', label: 'Yape' },
    },
  ),
  build('TB-79301', 5, 19, [{ productId: 'incakola-pack', qty: 1 }], {
    fulfillment: 'delivery',
    storeId: 'larco',
    address: seedAddresses[0],
    payment: { method: 'card', label: 'Tarjeta Visa •••• 4092' },
  }),
  build(
    'TB-76412',
    11,
    8,
    [
      { productId: 'empanada-carne', qty: 2 },
      { productId: 'cafe-americano', qty: 1 },
    ],
    {
      fulfillment: 'pickup',
      storeId: 'benavides',
      payment: { method: 'yape', label: 'Yape' },
    },
  ),
  build(
    'TB-74058',
    19,
    20,
    [
      { productId: 'pilsen-sixpack', qty: 1 },
      { productId: 'piqueo-snax', qty: 2 },
      { productId: 'lays-clasicas', qty: 1 },
    ],
    {
      fulfillment: 'delivery',
      storeId: 'aliaga',
      address: seedAddresses[1],
      payment: { method: 'cash', label: 'Efectivo', cashAmount: 50 },
    },
  ),
];
