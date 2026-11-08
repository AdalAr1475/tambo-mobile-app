import { toOrderItems } from '@/data/seedOrders';
import type { Address, Fulfillment, Order, PickupMethod } from '@/data/types';
import { deliveryStoreFor } from '@/lib/geo';
import { pts, ROUTINE_POINTS_MULTIPLIER } from '@/lib/points';
import { computeTotals } from '@/lib/pricing';
import { validateSplit } from '@/lib/split';
import { toCartLines, useCart, type CartItem } from '@/store/cart';
import { newOrderId, timestamp, useOrders } from '@/store/orders';
import { useSession } from '@/store/session';
import { balanceOf, useWallet } from '@/store/wallet';

export type PlaceOrderInput = {
  items: CartItem[];
  fulfillment: Fulfillment;
  storeId: string;
  address?: Address;
  schedule: Order['schedule'];
  payment: Order['payment'];
  split?: Order['split'];
  couponCode?: string;
  /** "Para llevar": Smart Locker o mostrador. */
  pickupMethod?: PickupMethod;
  /** Puntos usados como descuento ("Usar mis puntos"). */
  pointsToUse?: number;
  /** Rutina Auto-Pilot que genera el pedido: aplica su beneficio y puntos dobles. */
  routineId?: string;
  /** El checkout vacía el carrito; los pedidos automáticos (Auto-Pilot, demo) no lo tocan. */
  clearCart?: boolean;
};

export class InsufficientPointsError extends Error {
  missing: number;
  constructor(missing: number) {
    super(`Te faltan ${pts(missing)} para este canje.`);
    this.missing = missing;
  }
}

/**
 * Transacción única de cierre de pedido: calcula los totales, guarda el pedido, registra los
 * puntos canjeados y ganados en la billetera, marca el cupón como usado y (opcionalmente)
 * vacía el carrito. Úsala en lugar de repetir estos pasos en cada pantalla.
 *
 * Lanza InsufficientPointsError si el saldo no alcanza (la UI debería validarlo antes).
 */
export function placeOrder({
  items,
  fulfillment,
  storeId,
  address,
  schedule,
  payment,
  split,
  couponCode,
  pickupMethod,
  pointsToUse,
  routineId,
  clearCart = true,
}: PlaceOrderInput): Order {
  const routine = !!routineId;
  const totals = computeTotals(toCartLines(items), fulfillment, couponCode, {
    pointsToUse,
    routine,
    earnMultiplier: routine ? ROUTINE_POINTS_MULTIPLIER : 1,
  });
  const wallet = useWallet.getState();
  if (split) validateSplit(split, toCartLines(items), totals.shipping, totals.total, payment.method);
  const balance = balanceOf(wallet.ledger);
  if (totals.pointsToRedeem > balance) throw new InsufficientPointsError(totals.pointsToRedeem - balance);

  const delivery = fulfillment === 'delivery';
  const order: Order = {
    id: newOrderId(),
    createdAt: timestamp(),
    items: toOrderItems(items),
    fulfillment,
    // El delivery lo despacha la tienda más cercana a la dirección (origen de la ruta del motorizado).
    storeId: delivery && address ? deliveryStoreFor(address).id : storeId,
    address: delivery ? address : undefined,
    safeDrop: delivery || undefined,
    pickupMethod: fulfillment === 'pickup' ? (pickupMethod ?? 'counter') : undefined,
    schedule,
    // Canje 100% con puntos: no pasa por ninguna pasarela.
    payment: totals.total === 0 ? { method: 'points', label: 'Canje Tambo Lover Puntos' } : payment,
    couponCode: totals.coupon?.code,
    totals: {
      regularSubtotal: totals.regularSubtotal,
      productDiscount: totals.productDiscount,
      couponDiscount: totals.couponDiscount,
      pointsDiscount: totals.pointsDiscount || undefined,
      routineDiscount: totals.routineDiscount || undefined,
      shipping: totals.shipping,
      total: totals.total,
    },
    pointsEarned: totals.pointsEarned,
    pointsRedeemed: totals.pointsToRedeem || undefined,
    routineId,
    split,
  };

  useOrders.getState().place(order);
  wallet.apply([
    { delta: -totals.pointsToRedeem, kind: 'redeem', orderId: order.id, note: `Canje en pedido #${order.id}` },
    {
      delta: totals.pointsEarned,
      kind: 'earn',
      orderId: order.id,
      note: routine ? `Auto-Pilot #${order.id} (puntos dobles)` : `Compra #${order.id}`,
    },
  ]);
  if (totals.coupon) useSession.getState().markCouponUsed(totals.coupon.code);
  if (clearCart) useCart.getState().clear();
  return order;
}

/** Cancela un pedido y revierte sus efectos: puntos ganados/canjeados y cupón usado. */
export function cancelOrder(orderId: string) {
  const order = useOrders.getState().orders.find((o) => o.id === orderId);
  if (!order || order.cancelledAt) return;
  useOrders.getState().cancel(orderId);
  useWallet.getState().revertOrder(orderId);
  if (order.couponCode) useSession.getState().unmarkCouponUsed(order.couponCode);
}
