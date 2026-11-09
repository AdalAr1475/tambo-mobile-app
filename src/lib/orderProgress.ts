import type { IconName } from '@/components/Icon';
import type { Order } from '@/data/types';
import { useDemo } from '@/store/demo';
import { HOLD_MINUTES } from './slots';

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
  /** Delivery SafeDrop: el repartidor llegó y espera que escanee tu QR/PIN. */
  arrived?: boolean;
};

/**
 * Tiempo transcurrido "de demo" de un pedido: aplica el multiplicador global del Modo
 * Presentador y el adelanto propio del pedido (`clockOffsetMs`). `at(ms)` convierte un hito
 * de DEMO_TIMELINE a la hora real en que se alcanza (para mostrarla en los pasos).
 */
export function orderClock(order: Order, now: number) {
  const offset = order.clockOffsetMs ?? 0;
  const { sim } = order;
  // "Simular recorrido GPS": desde `sim.at` el pedido avanza a `sim.rate`× partiendo de `sim.t`.
  if (sim) {
    const t = sim.t + Math.max(0, now - sim.at) * sim.rate + offset;
    const at = (ms: number) => Math.max(order.createdAt, sim.at + (ms - offset - sim.t) / sim.rate);
    return { t, at };
  }
  const rate = useDemo.getState().fastClock;
  const t = (now - order.createdAt) * rate + offset;
  const at = (ms: number) => Math.max(order.createdAt, order.createdAt + (ms - offset) / rate);
  return { t, at };
}

export function getOrderStatus(order: Order, now: number): OrderStatus {
  const { t, at } = orderClock(order, now);
  const c = order.createdAt;

  if (order.fulfillment === 'pickup') {
    const locker = order.pickupMethod === 'locker';
    // El retiro termina cuando se verifica el QR (tótem o caja). `completedAt` es el flujo antiguo.
    const pickedAt = order.verifiedAt ?? order.completedAt;
    const readyAt = at(DEMO_TIMELINE.pickupReady);
    const steps: OrderStep[] = [
      { title: 'Pedido recibido', icon: 'check', at: c },
      { title: 'Preparando', icon: 'chef-hat', at: at(DEMO_TIMELINE.prepared) },
      {
        title: locker ? 'En tu Smart Locker' : 'Listo para recoger',
        icon: locker ? 'locker-multiple' : 'storefront-outline',
        at: readyAt,
      },
      {
        title: order.verifiedAt ? (locker ? 'Recogido y verificado por IoT' : 'Recogido y verificado') : 'Recogido',
        icon: 'shopping-outline',
        at: pickedAt,
      },
    ];
    if (order.cancelledAt) return cancelled(steps);
    if (order.seeded || pickedAt) {
      return completed(steps, locker ? 'Retiro verificado por Smart Locker' : 'Pedido recogido', 'Recogido');
    }
    const step = t < DEMO_TIMELINE.prepared ? 0 : t < DEMO_TIMELINE.pickupReady ? 1 : 2;
    const ready = step === 2;
    // La reserva dura HOLD_MINUTES reales desde que el pedido quedó listo.
    const expired = ready && now > readyAt + HOLD_MINUTES * 60_000;
    return {
      phase: 'active',
      step,
      steps,
      progress: Math.min(0.95, t / DEMO_TIMELINE.pickupReady),
      route: 0,
      etaMin: ready
        ? 0
        : Math.max(1, Math.ceil(((DEMO_TIMELINE.pickupReady - t) / DEMO_TIMELINE.pickupReady) * 15)),
      headline: expired
        ? 'Reserva vencida'
        : ready
          ? locker
            ? '¡Tu pedido está en el casillero!'
            : '¡Tu pedido está listo!'
          : step === 0
            ? 'Pedido recibido'
            : 'Preparando tu pedido',
      detail: expired
        ? 'Acércate a caja con tu código para retirarlo'
        : ready
          ? locker
            ? 'Escanea con la app el QR que muestra el casillero'
            : 'Acércate a caja y muestra tu código'
          : 'Te avisaremos cuando esté listo para recoger',
      shortLabel: ready ? (locker ? 'En tu Smart Locker' : 'Listo para recoger') : 'Preparando',
      canCancel: t < CANCEL_WINDOW,
    };
  }

  const steps: OrderStep[] = [
    { title: 'Pedido recibido', icon: 'check', at: c },
    { title: 'Preparado en tienda', icon: 'check', at: at(DEMO_TIMELINE.prepared) },
    { title: 'En camino', icon: 'moped', at: at(DEMO_TIMELINE.onTheWay) },
    {
      title: order.verifiedAt ? 'Entregado y verificado (SafeDrop)' : 'Entregado',
      icon: 'home-outline',
      at: order.verifiedAt ?? (order.safeDrop ? undefined : at(DEMO_TIMELINE.delivered)),
    },
  ];
  if (order.cancelledAt) return cancelled(steps);
  // Con SafeDrop el pedido solo se entrega al escanear el QR/PIN; los antiguos, por tiempo.
  if (order.seeded || order.verifiedAt || (!order.safeDrop && t >= DEMO_TIMELINE.delivered)) {
    return completed(steps, order.verifiedAt ? '¡Entregado con éxito!' : '¡Pedido entregado!', 'Entregado');
  }
  if (t >= DEMO_TIMELINE.delivered) {
    return {
      phase: 'active',
      step: 2,
      steps,
      progress: 0.98,
      route: 1,
      etaMin: 0,
      headline: '¡Tu repartidor llegó!',
      detail: 'Muestra tu código SafeDrop para recibir tu pedido',
      shortLabel: 'Llegó a tu puerta',
      canCancel: false,
      arrived: true,
    };
  }

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
