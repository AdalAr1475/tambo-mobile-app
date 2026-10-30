import { create } from 'zustand';
import type { IconName } from '@/components/Icon';

export type Toast = {
  id: number;
  message: string;
  icon?: IconName;
  tone?: 'default' | 'success' | 'error';
  action?: { label: string; onPress: () => void };
};

type UiState = {
  toast?: Toast;
  ageGate?: { onConfirm: () => void };
  showToast: (t: Omit<Toast, 'id'>) => void;
  hideToast: (id: number) => void;
  openAgeGate: (onConfirm: () => void) => void;
  closeAgeGate: () => void;
};

let seq = 0;

export const useUi = create<UiState>()((set) => ({
  toast: undefined,
  ageGate: undefined,
  showToast: (t) => set({ toast: { ...t, id: ++seq } }),
  hideToast: (id) => set((s) => (s.toast?.id === id ? { toast: undefined } : s)),
  openAgeGate: (onConfirm) => set({ ageGate: { onConfirm } }),
  closeAgeGate: () => set({ ageGate: undefined }),
}));

export const toast = (message: string, opts: Omit<Toast, 'id' | 'message'> = {}) =>
  useUi.getState().showToast({ message, ...opts });
