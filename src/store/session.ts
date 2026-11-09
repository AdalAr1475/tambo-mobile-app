import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_STORE_ID,
  districtCentroid,
  isCurrentStore,
  LEGACY_SEED_LINES,
  seedAddresses,
  seedCards,
  user,
} from '@/data/stores';
import type { Address, Fulfillment, PaymentMethodType, SavedCard } from '@/data/types';
import { persistStorage } from './storage';

export type NotificationPrefs = {
  orderUpdates: boolean;
  promos: boolean;
  email: boolean;
  sms: boolean;
};

type Profile = { name: string; email: string; phone: string };

type SessionState = {
  loggedIn: boolean;
  profile: Profile;
  ageVerified: boolean;
  fulfillment: Fulfillment;
  addressId: string;
  storeId: string;
  /** Punto de referencia de "Recoger cerca de…": 'me' (tu ubicación) o el id de una dirección. */
  pickupRef?: string;
  addresses: Address[];
  cards: SavedCard[];
  preferredPayment: PaymentMethodType;
  favorites: string[];
  usedCoupons: string[];
  notifications: NotificationPrefs;
  recentSearches: string[];

  login: (email: string) => void;
  logout: () => void;
  updateProfile: (p: Partial<Profile>) => void;
  verifyAge: () => void;
  setFulfillment: (f: Fulfillment) => void;
  selectAddress: (id: string) => void;
  selectStore: (id: string) => void;
  setPickupRef: (ref: string) => void;
  saveAddress: (a: Address) => void;
  deleteAddress: (id: string) => void;
  addCard: (c: SavedCard) => void;
  deleteCard: (id: string) => void;
  setPreferredPayment: (m: PaymentMethodType) => void;
  toggleFavorite: (productId: string) => void;
  markCouponUsed: (code: string) => void;
  /** Libera un cupón cuando se cancela el pedido que lo usó. */
  unmarkCouponUsed: (code: string) => void;
  setNotification: (key: keyof NotificationPrefs, value: boolean) => void;
  pushSearch: (q: string) => void;
  clearSearches: () => void;
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      loggedIn: true,
      profile: { name: user.name, email: user.email, phone: user.phone },
      ageVerified: false,
      fulfillment: 'delivery',
      addressId: seedAddresses[0].id,
      storeId: DEFAULT_STORE_ID,
      pickupRef: 'me',
      addresses: seedAddresses,
      cards: seedCards,
      preferredPayment: 'yape',
      favorites: ['fourloko-gold-pack', 'empanada-carne'],
      usedCoupons: [],
      notifications: { orderUpdates: true, promos: true, email: false, sms: true },
      recentSearches: ['Four Loko', 'Hielo'],

      login: (email) => set((s) => ({ loggedIn: true, profile: { ...s.profile, email } })),
      logout: () => set({ loggedIn: false }),
      updateProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      verifyAge: () => set({ ageVerified: true }),
      setFulfillment: (fulfillment) => set({ fulfillment }),
      selectAddress: (addressId) => set({ addressId }),
      selectStore: (storeId) => set({ storeId }),
      setPickupRef: (pickupRef) => set({ pickupRef }),
      saveAddress: (a) =>
        set((s) => ({
          addresses: s.addresses.some((x) => x.id === a.id)
            ? s.addresses.map((x) => (x.id === a.id ? a : x))
            : [...s.addresses, a],
        })),
      deleteAddress: (id) =>
        set((s) => {
          const addresses = s.addresses.filter((a) => a.id !== id);
          return {
            addresses,
            addressId: s.addressId === id ? (addresses[0]?.id ?? '') : s.addressId,
          };
        }),
      addCard: (c) => set((s) => ({ cards: [...s.cards, c] })),
      deleteCard: (id) =>
        set((s) => {
          const cards = s.cards.filter((c) => c.id !== id);
          return {
            cards,
            preferredPayment:
              s.preferredPayment === 'card' && cards.length === 0 ? 'yape' : s.preferredPayment,
          };
        }),
      setPreferredPayment: (preferredPayment) => set({ preferredPayment }),
      toggleFavorite: (productId) =>
        set((s) => ({
          favorites: s.favorites.includes(productId)
            ? s.favorites.filter((f) => f !== productId)
            : [productId, ...s.favorites],
        })),
      markCouponUsed: (code) => set((s) => ({ usedCoupons: [...new Set([...s.usedCoupons, code])] })),
      unmarkCouponUsed: (code) => set((s) => ({ usedCoupons: s.usedCoupons.filter((c) => c !== code) })),
      setNotification: (key, value) => set((s) => ({ notifications: { ...s.notifications, [key]: value } })),
      pushSearch: (q) =>
        set((s) => ({
          recentSearches: [q, ...s.recentSearches.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(
            0,
            6,
          ),
        })),
      clearSearches: () => set({ recentSearches: [] }),
    }),
    {
      name: 'tambo-session',
      storage: persistStorage,
      // v2 (It. 2): los puntos pasan a useWallet; se descarta el campo `points` antiguo.
      // v3 (It. 6): direcciones con coordenadas; las semilla antiguas (en la puerta de una tienda) se reemplazan.
      // v4: tiendas reales (Google Maps); un storeId antiguo pasa a la tienda por defecto (UNI puerta 5).
      version: 4,
      migrate: (persisted, version) => {
        const state = { ...(persisted as SessionState & { points?: number }) };
        if (version < 2) delete state.points;
        if (version < 3) {
          state.addresses = state.addresses.map((a) => {
            const seed = seedAddresses.find((s) => s.id === a.id);
            if (seed && a.line1 === LEGACY_SEED_LINES[a.id]) return { ...seed, reference: a.reference ?? seed.reference };
            return a.coords ? a : { ...a, coords: districtCentroid(a.district) };
          });
        }
        if (version < 4 && !isCurrentStore(state.storeId)) state.storeId = DEFAULT_STORE_ID;
        return state as SessionState;
      },
    },
  ),
);

export const useSelectedAddress = () =>
  useSession((s) => s.addresses.find((a) => a.id === s.addressId) ?? s.addresses[0]);
