import type { IconName } from '@/components/Icon';
import type { Order } from '@/data/types';

/**
 * Simulación del ciclo de vida del pedido (acelerada para la demo).
 * Los tiempos están en milisegundos desde que se crea el pedido.
 */
export const DEMO_TIMELINE = {
  prepared: 15_000,
  onTheWay: 25_000,
  delivered: 75_000,
  pickupReady: 30_000,
};

/** Minutos "reales" que representa el trayecto completo de la demo. */
const REAL_MINUTES = 30;
/** Ventana para cancelar: mientras la tienda no empieza a preparar. */
export const CANCEL_WINDOW = DEMO_TIMELINE.prepared;

export type OrderStep = { title: string; icon: IconName; at?: number };

export type OrderStatus = {
  phase: 'active' | 'completed' | 'cancelled';
  step: number;
  steps: OrderStep[];
  /** Avance global 0..1 (barra de progreso de Mis Pedidos). */
  progress: number;
  /** Avance de la moto sobre la ruta 0..1. */
  route: number;
  etaMin: number;
  headline: string;
  detail: string;
  shortLabel: string;
  canCancel: boolean;
};

export function getOrderStatus(order: Order, now: number): OrderStatus {
  const t = now - order.createdAt;
  const c = order.createdAt;

  if (order.fulfillment === 'pickup') {
    const steps: OrderStep[] = [
      { title: 'Pedido recibido', icon: 'check', at: c },
      { title: 'Preparando', icon: 'chef-hat', at: c + DEMO_TIMELINE.prepared },
      { title: 'Listo para recoger', icon: 'storefront-outline', at: c + DEMO_TIMELINE.pickupReady },
      { title: 'Recogido', icon: 'shopping-outline', at: order.completedAt },
    ];
    if (order.cancelledAt) return cancelled(steps);
    if (order.seeded || order.completedAt) return completed(steps, 'Pedido recogido', 'Recogido');
    const step = t < DEMO_TIMELINE.prepared ? 0 : t < DEMO_TIMELINE.pickupReady ? 1 : 2;
    const ready = step === 2;
    return {
      phase: 'active',
      step,
      steps,
      progress: Math.min(0.95, t / DEMO_TIMELINE.pickupReady),
      route: 0,
      etaMin: ready
        ? 0
        : Math.max(1, Math.ceil(((DEMO_TIMELINE.pickupReady - t) / DEMO_TIMELINE.pickupReady) * 15)),
      headline: ready ? '¡Tu pedido está listo!' : step === 0 ? 'Pedido recibido' : 'Preparando tu pedido',
      detail: ready ? 'Acércate a caja y muestra tu código' : 'Te avisaremos cuando esté listo para recoger',
      shortLabel: ready ? 'Listo para recoger' : 'Preparando',
      canCancel: t < CANCEL_WINDOW,
    };
  }

  const steps: OrderStep[] = [
    { title: 'Pedido recibido', icon: 'check', at: c },
    { title: 'Preparado en tienda', icon: 'check', at: c + DEMO_TIMELINE.prepared },
    { title: 'En camino', icon: 'moped', at: c + DEMO_TIMELINE.onTheWay },
    { title: 'Entregado', icon: 'home-outline', at: c + DEMO_TIMELINE.delivered },
  ];
  if (order.cancelledAt) return cancelled(steps);
  if (order.seeded || t >= DEMO_TIMELINE.delivered)
    return completed(steps, '¡Pedido entregado!', 'Entregado');

  const step = t < DEMO_TIMELINE.prepared ? 0 : t < DEMO_TIMELINE.onTheWay ? 1 : 2;
  const route =
    step < 2 ? 0 : (t - DEMO_TIMELINE.onTheWay) / (DEMO_TIMELINE.delivered - DEMO_TIMELINE.onTheWay);
  const etaMin = Math.max(
    1,
    Math.ceil(((DEMO_TIMELINE.delivered - t) / DEMO_TIMELINE.delivered) * REAL_MINUTES),
  );
  const copy = [
    { headline: 'Pedido recibido', detail: 'La tienda está confirmando tu pedido', short: 'Recibido' },
    { headline: 'Preparando tu pedido', detail: 'Estamos empacando tus antojos', short: 'Preparando' },
    { headline: 'En camino a tu dirección', detail: 'Llegada estimada en unos momentos', short: 'En camino' },
  ][step];
  return {
    phase: 'active',
    step,
    steps,
    progress: Math.min(0.97, t / DEMO_TIMELINE.delivered),
    route: Math.min(1, Math.max(0, route)),
    etaMin,
    headline: copy.headline,
    detail: copy.detail,
    shortLabel: `${copy.short} (${etaMin} min)`,
    canCancel: t < CANCEL_WINDOW,
  };
}

function completed(steps: OrderStep[], headline: string, shortLabel: string): OrderStatus {
  return {
    phase: 'completed',
    step: steps.length - 1,
    steps,
    progress: 1,
    route: 1,
    etaMin: 0,
    headline,
    detail: '¡Gracias por comprar en Tambo!',
    shortLabel,
    canCancel: false,
  };
}

function cancelled(steps: OrderStep[]): OrderStatus {
  return {
    phase: 'cancelled',
    step: 0,
    steps,
    progress: 0,
    route: 0,
    etaMin: 0,
    headline: 'Pedido cancelado',
    detail: 'El reembolso se verá reflejado en tu medio de pago',
    shortLabel: 'Cancelado',
    canCancel: false,
  };
}
