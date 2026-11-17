import type { TransactionDTO } from '@mizan/shared';
import { create } from 'zustand';

/** Global quick-entry sheet: opened from the top bar, keyboard shortcut "N", or a row's Edit action. */
export const useComposer = create<{
  open: boolean;
  editing: TransactionDTO | null;
  defaults: Partial<{ type: 'EXPENSE' | 'INCOME' | 'TRANSFER'; accountId: string }>;
  show(opts?: { editing?: TransactionDTO; defaults?: Partial<{ type: 'EXPENSE' | 'INCOME' | 'TRANSFER'; accountId: string }> }): void;
  close(): void;
}>((set) => ({
  open: false,
  editing: null,
  defaults: {},
  show: (opts) => set({ open: true, editing: opts?.editing ?? null, defaults: opts?.defaults ?? {} }),
  close: () => set({ open: false }),
}));
