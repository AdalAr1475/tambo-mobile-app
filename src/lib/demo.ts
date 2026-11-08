import { useCart } from '@/store/cart';
import { useOrders } from '@/store/orders';
import { useRoutines } from '@/store/routines';
import { useSession } from '@/store/session';
import { useUi } from '@/store/ui';
import { useWallet } from '@/store/wallet';

/**
 * "Reiniciar demo": deja carrito, sesión, pedidos, puntos y rutinas como en una instalación limpia.
 * El Modo Presentador (`useDemo`) se mantiene para no perder la configuración del ensayo.
 * Si agregas un store persistido nuevo con datos de la demo, reinícialo aquí también.
 */
export function resetDemoData() {
  useCart.persist.clearStorage();
  useCart.setState(useCart.getInitialState(), true);
  useSession.persist.clearStorage();
  useSession.setState(useSession.getInitialState(), true);
  useOrders.persist.clearStorage();
  useOrders.setState(useOrders.getInitialState(), true);
  useWallet.persist.clearStorage();
  useWallet.setState(useWallet.getInitialState(), true);
  useRoutines.persist.clearStorage();
  useRoutines.setState(useRoutines.getInitialState(), true);
  const { toast, hideToast } = useUi.getState();
  if (toast) hideToast(toast.id);
}
