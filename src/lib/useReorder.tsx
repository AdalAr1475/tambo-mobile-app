import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { Button, Txt } from '@/components/ui';
import { getProduct } from '@/data/products';
import type { Order } from '@/data/types';
import { haptic } from '@/lib/feedback';
import { pluralize } from '@/lib/format';
import { MAX_QTY, useCart, type CartItem } from '@/store/cart';
import { toast } from '@/store/ui';
import { colors, space } from '@/theme/tokens';

type Pending = { items: CartItem[]; missing: number };

/**
 * "Volver a pedir" seguro: si el carrito está vacío lo llena con el pedido; si ya tiene
 * productos, pregunta antes (Reemplazar / Sumar / Cancelar). Nunca hereda cupones viejos.
 *
 * Devuelve `reorder(order)` y `sheet`, que la pantalla debe renderizar una vez.
 */
export function useReorder() {
  const [pending, setPending] = useState<Pending>();
  const cartCount = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));

  const apply = useCallback((mode: 'replace' | 'add', { items, missing }: Pending) => {
    const cart = useCart.getState();
    let capped = false;
    if (mode === 'replace') {
      cart.replace(items);
    } else {
      for (const item of items) {
        const current = cart.items.find((i) => i.productId === item.productId)?.qty ?? 0;
        if (current + item.qty > MAX_QTY) capped = true;
        cart.add(item.productId, item.qty);
      }
    }
    setPending(undefined);
    haptic.success();
    const base =
      mode === 'replace'
        ? 'Cargamos tu pedido en el carrito'
        : `Sumamos ${pluralize(items.length, 'producto', 'productos')} a tu carrito`;
    const notes = [
      missing > 0 && `${pluralize(missing, 'producto ya no está', 'productos ya no están')} disponible${missing > 1 ? 's' : ''}`,
      capped && `máximo ${MAX_QTY} por producto`,
    ].filter(Boolean);
    toast(notes.length ? `${base} (${notes.join(', ')})` : base, { icon: 'restore' });
    router.push('/carrito');
  }, []);

  const reorder = useCallback(
    (order: Order) => {
      // Los canjes se vuelven a pedir como compra normal (los puntos no se reservan);
      // si el producto venía normal y canjeado, se suma en una sola línea.
      const qtyById = new Map<string, number>();
      for (const i of order.items) {
        if (getProduct(i.productId)) qtyById.set(i.productId, (qtyById.get(i.productId) ?? 0) + i.qty);
      }
      const items = [...qtyById].map(([productId, qty]) => ({ productId, qty: Math.min(MAX_QTY, qty) }));
      const missing = new Set(order.items.map((i) => i.productId)).size - items.length;
      if (items.length === 0) {
        toast('Los productos de este pedido ya no están disponibles', { tone: 'error' });
        return;
      }
      if (useCart.getState().items.length === 0) apply('replace', { items, missing });
      else setPending({ items, missing });
    },
    [apply],
  );

  const sheet = (
    <Sheet
      visible={!!pending}
      onClose={() => setPending(undefined)}
      title="¿Reemplazamos tu carrito?"
      subtitle="Elige qué hacer con lo que ya tienes"
    >
      <View style={{ gap: space.md }}>
        <Txt variant="bodyMd" color={colors.textMuted}>
          Tienes {pluralize(cartCount, 'producto', 'productos')} en tu carrito. Puedes reemplazarlos por
          este pedido o sumarlos a lo que ya llevas.
        </Txt>
        <Button
          label="Reemplazar carrito"
          icon="swap-horizontal"
          variant="brand"
          onPress={() => pending && apply('replace', pending)}
        />
        <Button
          label="Sumar al carrito"
          icon="cart-plus"
          variant="outline"
          onPress={() => pending && apply('add', pending)}
        />
        <Button label="Cancelar" variant="ghost" onPress={() => setPending(undefined)} />
      </View>
    </Sheet>
  );

  return { reorder, sheet };
}
