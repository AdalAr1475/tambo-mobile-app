import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';
import type { Order } from '@/data/types';
import { useNow, useOrders } from '@/store/orders';
import { lockerPin } from './lockers';

/**
 * QR dinámico de retiro (estilo TOTP): token = SHA-256(pedido | PIN | ventana de 30 s).
 * Cambia cada 30 s y solo sirve para su pedido. Es DEMOSTRATIVO: en producción el secreto
 * vive en el servidor (HMAC) y el token es de un solo uso.
 */
export const TOKEN_WINDOW_MS = 30_000;
/** Se acepta la ventana actual y la anterior (tolerancia por desfase de relojes). */
const ACCEPTED_WINDOWS = 2;

export const windowOf = (now: number) => Math.floor(now / TOKEN_WINDOW_MS);

export async function tokenFor(orderId: string, pin: string, window: number) {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${orderId}|${pin}|${window}`,
  );
  return digest.slice(0, 10).toUpperCase();
}

export const qrPayload = (orderId: string, token: string) => `TAMBO|${orderId}|${token}`;

export async function payloadFor(order: Order, now: number) {
  return qrPayload(order.id, await tokenFor(order.id, lockerPin(order), windowOf(now)));
}

export type VerifyResult = { ok: true } | { ok: false; reason: 'invalid' | 'expired' | 'other-order' };

/** Valida un QR leído contra el pedido: formato, pedido correcto y ventana de tiempo. */
export async function verifyPayload(payload: string, order: Order, now: number): Promise<VerifyResult> {
  const [prefix, orderId, token] = payload.split('|');
  if (prefix !== 'TAMBO' || !token) return { ok: false, reason: 'invalid' };
  if (orderId !== order.id) return { ok: false, reason: 'other-order' };
  const pin = lockerPin(order);
  const current = windowOf(now);
  for (let w = current; w > current - ACCEPTED_WINDOWS; w--) {
    if ((await tokenFor(order.id, pin, w)) === token) return { ok: true };
  }
  // Fue válido hace poco: QR vencido (por ejemplo, una captura de pantalla vieja).
  for (let w = current - ACCEPTED_WINDOWS; w > current - 20; w--) {
    if ((await tokenFor(order.id, pin, w)) === token) return { ok: false, reason: 'expired' };
  }
  return { ok: false, reason: 'invalid' };
}

export const VERIFY_MESSAGE: Record<Exclude<VerifyResult, { ok: true }>['reason'], string> = {
  invalid: 'QR no reconocido. Vuelve a intentarlo.',
  expired: 'Código vencido: usa el QR que se muestra ahora en tu app.',
  'other-order': 'Este QR es de otro pedido.',
};

/**
 * Simula que el lector (tótem o caja) escanea el QR que la app muestra en este momento y,
 * si es válido, marca el retiro como verificado. `ageWindows` > 0 simula un QR viejo.
 */
export async function scanAndVerify(order: Order, ageWindows = 0): Promise<VerifyResult> {
  const now = Date.now();
  const scanned = await payloadFor(order, now - ageWindows * TOKEN_WINDOW_MS);
  const result = await verifyPayload(scanned, order, now);
  if (result.ok) useOrders.getState().verify(order.id);
  return result;
}

/** QR que se regenera cada 30 s mientras `enabled`. */
export function useDynamicQr(order: Order | undefined, enabled = true) {
  const now = useNow(1000, enabled && !!order);
  const window = windowOf(now);
  const [payload, setPayload] = useState<string>();
  useEffect(() => {
    if (!order || !enabled) return;
    let alive = true;
    payloadFor(order, window * TOKEN_WINDOW_MS).then((p) => alive && setPayload(p));
    return () => {
      alive = false;
    };
  }, [order, enabled, window]);
  const secondsLeft = Math.max(0, Math.ceil(((window + 1) * TOKEN_WINDOW_MS - now) / 1000));
  return { payload, secondsLeft };
}
