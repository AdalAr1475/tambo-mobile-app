import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createSeedOrders } from '@/data/seedOrders';
import { DEMO_START_BALANCE, DEMO_TOP_UP } from '@/lib/points';
import { persistStorage } from './storage';

export type LedgerKind = 'earn' | 'redeem' | 'revert' | 'bonus' | 'demo';

export type LedgerEntry = {
  id: string;
  at: number;
  /** Positivo suma puntos, negativo los descuenta. */
  delta: number;
  kind: LedgerKind;
  orderId?: string;
  note: string;
};

export type NewLedgerEntry = Omit<LedgerEntry, 'id' | 'at'> & { at?: number };

type WalletState = {
  /** Movimientos, del más reciente al más antiguo. El saldo es la suma de `delta`. */
  ledger: LedgerEntry[];
  apply: (entries: NewLedgerEntry[]) => void;
  /** Devuelve los puntos ganados y canjeados de un pedido cancelado. */
  revertOrder: (orderId: string) => void;
  demoTopUp: () => void;
};

const DAY = 24 * 60 * 60 * 1000;
let seq = 0;
const entryId = () => `mov-${Date.now()}-${seq++}`;

export const balanceOf = (ledger: LedgerEntry[]) => ledger.reduce((s, e) => s + e.delta, 0);
/** Puntos ganados históricamente (define el nivel). */
export const lifetimeOf = (ledger: LedgerEntry[]) =>
  ledger.reduce((s, e) => s + (e.kind === 'earn' || e.kind === 'bonus' ? e.delta : 0), 0);

/**
 * Historial de ejemplo coherente con los pedidos semilla: nivel Tambo Gold y saldo de
 * DEMO_START_BALANCE puntos.
 */
function createSeedLedger(): LedgerEntry[] {
  const now = Date.now();
  const entries: LedgerEntry[] = [
    { id: 'seed-prev', at: now - 120 * DAY, delta: 3600, kind: 'earn', note: 'Compras anteriores' },
    { id: 'seed-bonus', at: now - 110 * DAY, delta: 1000, kind: 'bonus', note: 'Bono bienvenida Tambo Lover' },
    { id: 'seed-cafe', at: now - 60 * DAY, delta: -350, kind: 'redeem', note: 'Canje Café Americano 12 oz' },
    { id: 'seed-pan', at: now - 45 * DAY, delta: -1000, kind: 'redeem', note: 'Canje Pan con chicharrón' },
    ...createSeedOrders()
      .filter((o) => o.pointsEarned)
      .map((o) => ({
        id: `seed-${o.id}`,
        at: o.createdAt,
        delta: o.pointsEarned!,
        kind: 'earn' as const,
        orderId: o.id,
        note: `Compra #${o.id}`,
      })),
  ];
  // Ajuste para que el saldo inicial sea exacto aunque cambien los pedidos semilla.
  const rest = balanceOf(entries) - DEMO_START_BALANCE;
  if (rest !== 0) {
    entries.push({
      id: 'seed-rest',
      at: now - 30 * DAY,
      delta: -rest,
      kind: rest > 0 ? 'redeem' : 'bonus',
      note: rest > 0 ? 'Canjes en tienda' : 'Bono de temporada',
    });
  }
  return entries.sort((a, b) => b.at - a.at);
}

export const useWallet = create<WalletState>()(
  persist(
    (set) => ({
      ledger: createSeedLedger(),
      apply: (entries) =>
        set((s) => ({
          ledger: [
            ...entries
              .filter((e) => e.delta !== 0)
              .map((e) => ({ ...e, id: entryId(), at: e.at ?? Date.now() })),
            ...s.ledger,
          ],
        })),
      revertOrder: (orderId) =>
        set((s) => {
          const moves = s.ledger.filter((e) => e.orderId === orderId);
          const net = balanceOf(moves);
          if (net === 0 && moves.some((e) => e.kind === 'revert')) return s;
          const reverts = moves
            .filter((e) => e.kind === 'earn' || e.kind === 'redeem')
            .map<LedgerEntry>((e) => ({
              id: entryId(),
              at: Date.now(),
              delta: -e.delta,
              kind: 'revert',
              orderId,
              note:
                e.kind === 'earn'
                  ? `Pedido #${orderId} cancelado: se retiran los puntos ganados`
                  : `Pedido #${orderId} cancelado: te devolvimos tus puntos`,
            }));
          return { ledger: [...reverts, ...s.ledger] };
        }),
      demoTopUp: () =>
        set((s) => ({
          ledger: [
            { id: entryId(), at: Date.now(), delta: DEMO_TOP_UP, kind: 'demo', note: 'Recarga demo' },
            ...s.ledger,
          ],
        })),
    }),
    { name: 'tambo-wallet', storage: persistStorage, version: 1, migrate: (p) => p as WalletState },
  ),
);

export const useBalance = () => useWallet((s) => balanceOf(s.ledger));
export const useLifetime = () => useWallet((s) => lifetimeOf(s.ledger));
