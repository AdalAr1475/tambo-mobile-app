import type { OrderSplit } from '@/data/types';
import { round2 } from './format';
import { lineCash, type CartLine } from './pricing';

const cents = (amount: number) => Math.round(round2(amount) * 100);

/** El anfitrión (índice 0) recibe los céntimos sobrantes; nunca hay cuotas negativas. */
export function splitEqual(total: number, n: number): number[] {
  if (!Number.isFinite(total) || total < 0 || !Number.isInteger(n) || n < 2 || n > 5) {
    throw new Error('El reparto requiere un total válido y de 2 a 5 personas.');
  }
  const amount = cents(total);
  // Redondea cada cuota; limita la base solo si un total diminuto dejaría al anfitrión en negativo.
  const base = Math.min(cents(round2(total / n)), Math.floor(amount / (n - 1)));
  return Array.from({ length: n }, (_, i) => round2((i === 0 ? amount - base * (n - 1) : base) / 100));
}

/**
 * Cada línea completa pertenece a una persona. lineCash usa lineTotal (promos por paquete)
 * o los soles del canje. Cupón y descuento libre de puntos se prorratean sobre esas líneas.
 * El envío siempre se divide por igual, con residuo al anfitrión.
 */
export function splitByItems(
  lines: CartLine[],
  assignment: number[],
  shipping: number,
  n = Math.max(2, ...assignment.map((i) => i + 1)),
  total = round2(lines.reduce((sum, line) => sum + lineCash(line), 0) + shipping),
): number[] {
  const shares = splitEqual(shipping, n).map(cents);
  if (assignment.length !== lines.length || assignment.some((i) => !Number.isInteger(i) || i < 0 || i >= n)) {
    throw new Error('Asigna cada producto a un participante.');
  }
  const cash = lines.map((line) => cents(lineCash(line)));
  const subtotal = cash.reduce((sum, amount) => sum + amount, 0);
  const products = cents(total) - cents(shipping);
  if (!Number.isFinite(total) || products < 0 || products > subtotal) {
    throw new Error('El total del reparto no coincide con los productos.');
  }
  // Redondeo acumulado: conserva el total exacto incluso al canjear puntos o aplicar cupones.
  let accumulated = 0;
  let allocated = 0;
  cash.forEach((amount, index) => {
    accumulated += amount;
    const next = subtotal ? Math.round((accumulated * products) / subtotal) : 0;
    shares[assignment[index]] += next - allocated;
    allocated = next;
  });
  return shares.map((amount) => round2(amount / 100));
}

/** Se ejecuta antes de cualquier escritura: no acepta cuotas pendientes ni un reparto desactualizado. */
export function validateSplit(
  split: OrderSplit,
  lines: CartLine[],
  shipping: number,
  total: number,
  method: string,
) {
  if (total <= 0 || (method !== 'yape' && method !== 'card') || !['equal', 'items'].includes(split.mode)) {
    throw new Error('Party Split requiere un pago en soles con Yape o tarjeta.');
  }
  const expected = split.mode === 'equal'
    ? splitEqual(total, split.participants.length)
    : splitByItems(lines, split.assignment ?? [], shipping, split.participants.length, total);
  if (split.participants.some((p, i) =>
    !p.paid || !p.name.trim() || !Number.isFinite(p.amount) || p.amount !== expected[i] ||
    p.method !== (i === 0 ? method : 'yape')
  )) {
    throw new Error('Completa los pagos de todos los participantes y revisa el reparto.');
  }
}
