import type {
  AccountCreateInput,
  AccountDTO,
  AccountUpdateInput,
  BudgetCreateInput,
  BudgetDTO,
  CategoryDTO,
  DashboardDTO,
  Paginated,
  PeriodPreset,
  SettingsDTO,
  TransactionCreateInput,
  TransactionDTO,
  TransactionQuery,
  TransactionUpdateInput,
  UpdateSettingsInput,
  UserDTO,
} from '@mizan/shared';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/stores/auth';
import { api } from './api';
import { invalidateFinance, queryClient } from './query';

/** Data hooks — the same endpoints and cache keys as the web app. */

function qs(q: Record<string, unknown>) {
  return Object.entries(q)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

export const useDashboard = (preset: PeriodPreset) =>
  useQuery({ queryKey: ['dashboard', preset], queryFn: () => api<DashboardDTO>(`/dashboard?preset=${preset}`) });

export const useAccounts = (includeArchived = false) =>
  useQuery({
    queryKey: ['accounts', { includeArchived }],
    queryFn: () => api<{ items: AccountDTO[] }>(`/accounts?includeArchived=${includeArchived}`).then((r) => r.items),
  });

export type AccountHistory = {
  series: { month: string; balance: string }[];
  entries: {
    id: string;
    date: string;
    description: string;
    type: string;
    change: string;
    balanceAfter: string;
    category: { name: string; color: string; icon: string } | null;
  }[];
};

export const useAccountHistory = (id: string | undefined) =>
  useQuery({
    queryKey: ['accounts', id, 'history'],
    enabled: !!id,
    queryFn: () => api<AccountHistory>(`/accounts/${id}/history`),
  });

export const useSaveAccount = () =>
  useMutation({
    mutationFn: ({ id, data }: { id?: string; data: AccountCreateInput | AccountUpdateInput }) =>
      id ? api<AccountDTO>(`/accounts/${id}`, { method: 'PATCH', json: data }) : api<AccountDTO>('/accounts', { method: 'POST', json: data }),
    onSuccess: invalidateFinance,
  });

export const useDeleteAccount = () =>
  useMutation({ mutationFn: (id: string) => api<void>(`/accounts/${id}`, { method: 'DELETE' }), onSuccess: invalidateFinance });

export const useCategories = () =>
  useQuery({
    queryKey: ['categories'],
    queryFn: () => api<{ items: CategoryDTO[] }>('/categories').then((r) => r.items),
    staleTime: 5 * 60_000,
  });

export const useTransactionFeed = (q: Omit<TransactionQuery, 'page'>) =>
  useInfiniteQuery({
    queryKey: ['transactions', 'feed', q],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Paginated<TransactionDTO>>(`/transactions?${qs({ ...q, page: pageParam, pageSize: 40 })}`),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });

export const useTransaction = (id: string | undefined) =>
  useQuery({ queryKey: ['transactions', id], enabled: !!id, queryFn: () => api<TransactionDTO>(`/transactions/${id}`) });

export const useSaveTransaction = () =>
  useMutation({
    mutationFn: ({ id, data }: { id?: string; data: TransactionCreateInput | TransactionUpdateInput }) =>
      id
        ? api<TransactionDTO>(`/transactions/${id}`, { method: 'PATCH', json: data })
        : api<TransactionDTO>('/transactions', { method: 'POST', json: data }),
    onSuccess: invalidateFinance,
  });

export const useDeleteTransaction = () =>
  useMutation({ mutationFn: (id: string) => api<void>(`/transactions/${id}`, { method: 'DELETE' }), onSuccess: invalidateFinance });

export const useDuplicateTransaction = () =>
  useMutation({
    mutationFn: (id: string) => api<TransactionDTO>(`/transactions/${id}/duplicate`, { method: 'POST' }),
    onSuccess: invalidateFinance,
  });

export const useBudgets = () =>
  useQuery({ queryKey: ['budgets'], queryFn: () => api<{ items: BudgetDTO[] }>('/budgets').then((r) => r.items) });

export const useSaveBudget = () =>
  useMutation({
    mutationFn: ({ id, data }: { id?: string; data: BudgetCreateInput }) =>
      id ? api<BudgetDTO>(`/budgets/${id}`, { method: 'PATCH', json: data }) : api<BudgetDTO>('/budgets', { method: 'POST', json: data }),
    onSuccess: invalidateFinance,
  });

export const useDeleteBudget = () =>
  useMutation({ mutationFn: (id: string) => api<void>(`/budgets/${id}`, { method: 'DELETE' }), onSuccess: invalidateFinance });

export const useUpdateSettings = () =>
  useMutation({
    mutationFn: (data: UpdateSettingsInput) => api<SettingsDTO>('/settings', { method: 'PATCH', json: data }),
    onSuccess: (s) => {
      useAuth.getState().setSettings(s);
      return queryClient.invalidateQueries();
    },
  });

export const useUpdateProfile = () =>
  useMutation({
    mutationFn: (data: { name: string }) =>
      api<{ user: UserDTO }>('/auth/me', { method: 'PATCH', json: data }).then((r) => r.user),
    onSuccess: (u) => useAuth.getState().setUser(u),
  });
