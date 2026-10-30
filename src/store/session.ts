import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { seedAddresses, seedCards, user } from '@/data/stores';
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
  points: number;
  ageVerified: boolean;
  fulfillment: Fulfillment;
  addressId: string;
  storeId: string;
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
  addPoints: (n: number) => void;
  verifyAge: () => void;
  setFulfillment: (f: Fulfillment) => void;
  selectAddress: (id: string) => void;
  selectStore: (id: string) => void;
  saveAddress: (a: Address) => void;
  deleteAddress: (id: string) => void;
  addCard: (c: SavedCard) => void;
  deleteCard: (id: string) => void;
  setPreferredPayment: (m: PaymentMethodType) => void;
  toggleFavorite: (productId: string) => void;
  markCouponUsed: (code: string) => void;
  setNotification: (key: keyof NotificationPrefs, value: boolean) => void;
  pushSearch: (q: string) => void;
  clearSearches: () => void;
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      loggedIn: true,
      profile: { name: user.name, email: user.email, phone: user.phone },
      points: 450,
      ageVerified: false,
      fulfillment: 'delivery',
      addressId: seedAddresses[0].id,
      storeId: 'aliaga',
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
      addPoints: (n) => set((s) => ({ points: s.points + n })),
      verifyAge: () => set({ ageVerified: true }),
      setFulfillment: (fulfillment) => set({ fulfillment }),
      selectAddress: (addressId) => set({ addressId }),
      selectStore: (storeId) => set({ storeId }),
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
    { name: 'tambo-session', storage: persistStorage },
  ),
);

export const useSelectedAddress = () =>
  useSession((s) => s.addresses.find((a) => a.id === s.addressId) ?? s.addresses[0]);
