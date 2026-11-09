import type { Order } from '@/data/types';
import type { OrderStatus } from './orderProgress';

/**
 * QR estático del casillero Tambo Smart Locker. En la vida real la pantalla del casillero muestra
 * este código cuando el cliente toca "Recoger pedido" y la app lo escanea. Para la demo de clase
 * se imprime (o se muestra en otra pantalla) la imagen generada con `scripts/build-locker-qr.mjs`.
 *
 * Formato: `TAMBO-LOCKER:v1:<storeId>`. El payload `demo` sirve para cualquier tienda.
 * Es demostrativo: no hay firma ni secreto de servidor.
 */

const PREFIX = 'TAMBO-LOCKER';
const VERSION = 'v1';
export const DEMO_LOCKER_ID = 'demo';

export const lockerQrPayload = (storeId: string) => `${PREFIX}:${VERSION}:${storeId}`;

export const DEMO_LOCKER_PAYLOAD = lockerQrPayload(DEMO_LOCKER_ID);

export type LockerQr = { storeId: string; demo: boolean };

/** Lee un QR de casillero; `undefined` si el texto no tiene el formato esperado. */
export function parseLockerQr(text: string): LockerQr | undefined {
  const parts = text.trim().split(':');
  if (parts.length !== 3 || parts[0] !== PREFIX || parts[1] !== VERSION) return undefined;
  const storeId = parts[2];
  if (!/^[a-z0-9-]+$/.test(storeId)) return undefined;
  return { storeId, demo: storeId === DEMO_LOCKER_ID };
}

export type LockerQrReason = 'invalid' | 'not-pickup' | 'already-picked' | 'wrong-store' | 'not-ready';

export type LockerQrResult = { ok: true; qr: LockerQr } | { ok: false; reason: LockerQrReason; qr?: LockerQr };

/**
 * Valida el QR escaneado contra el pedido. `status` es `getOrderStatus(order, now)`: el pedido
 * debe estar listo en el casillero (paso 2 activo) para poder retirarlo.
 */
export function validateLockerQr(text: string, order: Order, status: OrderStatus): LockerQrResult {
  const qr = parseLockerQr(text);
  if (!qr) return { ok: false, reason: 'invalid' };
  if (order.fulfillment !== 'pickup' || order.pickupMethod !== 'locker' || status.phase === 'cancelled') {
    return { ok: false, reason: 'not-pickup', qr };
  }
  if (order.verifiedAt || order.completedAt || status.phase === 'completed') {
    return { ok: false, reason: 'already-picked', qr };
  }
  if (!qr.demo && qr.storeId !== order.storeId) return { ok: false, reason: 'wrong-store', qr };
  if (status.step !== 2) return { ok: false, reason: 'not-ready', qr };
  return { ok: true, qr };
}
