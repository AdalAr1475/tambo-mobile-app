import { router } from 'expo-router';
import { useCallback } from 'react';
import { getProduct } from '@/data/products';
import { useCart } from '@/store/cart';
import { useSession } from '@/store/session';
import { toast, useUi } from '@/store/ui';
import { haptic } from './feedback';

/**
 * Agrega al carrito validando mayoría de edad para productos con alcohol.
 * Muestra un toast con acceso directo al carrito.
 */
export function useAddToCart() {
  const add = useCart((s) => s.add);
  const ageVerified = useSession((s) => s.ageVerified);
  const openAgeGate = useUi((s) => s.openAgeGate);

  return useCallback(
    (productId: string, qty = 1, opts: { silent?: boolean } = {}) => {
      const product = getProduct(productId);
      if (!product) return;
      const doAdd = () => {
        add(productId, qty);
        haptic.success();
        if (!opts.silent) {
          toast(qty > 1 ? `${qty} x ${product.name} agregado` : `${product.name} agregado`, {
            icon: 'cart-check',
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
