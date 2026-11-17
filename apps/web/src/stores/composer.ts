import type { TransactionDTO } from '@mizan/shared';
import { create } from 'zustand';

type ComposerDefaults = Partial<{
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  accountId: string;
  repeat: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
}>;

/** Global quick-entry sheet: opened from the top bar, keyboard shortcut "N", or a row's Edit action. */
export const useComposer = create<{
  open: boolean;
  editing: TransactionDTO | null;
  defaults: ComposerDefaults;
  show(opts?: { editing?: TransactionDTO; defaults?: ComposerDefaults }): void;
  close(): void;
}>((set) => ({
  open: false,
  editing: null,
  defaults: {},
  show: (opts) => set({ open: true, editing: opts?.editing ?? null, defaults: opts?.defaults ?? {} }),
  close: () => set({ open: false }),
}));
