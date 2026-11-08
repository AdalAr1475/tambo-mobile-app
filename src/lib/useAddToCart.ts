import { router } from 'expo-router';
import { useCallback } from 'react';
import { getProduct } from '@/data/products';
import type { RedeemMode } from '@/data/types';
import { toCartLines, useCart } from '@/store/cart';
import { useSession } from '@/store/session';
import { toast, useUi } from '@/store/ui';
import { balanceOf, useWallet } from '@/store/wallet';
import { haptic } from './feedback';
import { pts } from './points';
import { linePoints, redeemOption } from './pricing';

type AddOptions = {
  silent?: boolean;
  /** Agrega la línea como canje Tambo Lover (100% puntos o puntos + soles). */
  redeem?: RedeemMode;
};

/** Puntos que exigen las líneas canjeadas que ya están en el carrito. */
export const cartPointsInUse = () => toCartLines(useCart.getState().items).reduce((s, l) => s + linePoints(l), 0);

/**
 * Agrega al carrito validando mayoría de edad para productos con alcohol y, en canjes,
 * que alcance el saldo de puntos. Muestra un toast con acceso directo al carrito.
 */
export function useAddToCart() {
  const add = useCart((s) => s.add);
  const ageVerified = useSession((s) => s.ageVerified);
  const openAgeGate = useUi((s) => s.openAgeGate);

  return useCallback(
    (productId: string, qty = 1, opts: AddOptions = {}) => {
      const product = getProduct(productId);
      if (!product) return;
      const { redeem } = opts;
      if (redeem) {
        const option = redeemOption(product, redeem);
        if (!option) return;
        const balance = balanceOf(useWallet.getState().ledger);
        const missing = cartPointsInUse() + option.points * qty - balance;
        if (missing > 0) {
          haptic.warning();
          toast(`Te faltan ${pts(missing)} para este canje`, {
            tone: 'error',
            action: { label: 'Mis puntos', onPress: () => router.push('/puntos') },
          });
          return;
        }
      }
      const doAdd = () => {
        add(productId, qty, redeem);
        haptic.success();
        if (!opts.silent) {
          const name = qty > 1 ? `${qty} x ${product.name}` : product.name;
          toast(redeem ? `${name} agregado con tus puntos` : `${name} agregado`, {
            icon: redeem ? 'star-circle' : 'cart-check',
            action: { label: 'Ver carrito', onPress: () => router.push('/carrito') },
          });
        }
      };
      if (product.alcoholic && !ageVerified) openAgeGate(doAdd);
      else doAdd();
    },
    [add, ageVerified, openAgeGate],
  );
}
