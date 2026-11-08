import { useCallback } from 'react';
import { getProduct } from '@/data/products';
import { useCart } from '@/store/cart';
import { useSession } from '@/store/session';
import { toast, useUi } from '@/store/ui';
import { haptic } from './feedback';
import { pluralize } from './format';

type Item = { productId: string; qty: number };

/**
 * Agrega varios productos de una vez (combos de Tambo IA, plan por presupuesto, favoritos).
 * Aplica el age gate si alguno tiene alcohol y ofrece "Deshacer" (restaura el carrito previo).
 */
export function useAddManyToCart() {
  const ageVerified = useSession((s) => s.ageVerified);
  const openAgeGate = useUi((s) => s.openAgeGate);

  return useCallback(
    (items: Item[], opts: { message?: string } = {}) => {
      const valid = items.filter((i) => i.qty > 0 && getProduct(i.productId));
      if (valid.length === 0) return;
      const run = () => {
        const before = useCart.getState();
        const snapshot = { items: before.items, couponCode: before.couponCode };
        valid.forEach((i) => before.add(i.productId, i.qty));
        haptic.success();
        const units = valid.reduce((n, i) => n + i.qty, 0);
        toast(opts.message ?? `Agregamos ${pluralize(units, 'producto', 'productos')} a tu carrito`, {
          icon: 'cart-check',
          action: {
            label: 'Deshacer',
            onPress: () => {
              useCart.setState(snapshot);
              toast('Dejamos tu carrito como estaba', { icon: 'undo-variant' });
            },
          },
        });
      };
      const hasAlcohol = valid.some((i) => getProduct(i.productId)?.alcoholic);
      if (hasAlcohol && !ageVerified) openAgeGate(run);
      else run();
    },
    [ageVerified, openAgeGate],
  );
}
