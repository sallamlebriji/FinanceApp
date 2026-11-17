import type { CategoryDTO, Paginated, TransactionCreateInput, TransactionDTO, TransactionQuery, TransactionUpdateInput } from '@mizan/shared';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { invalidateFinance, queryClient } from '@/lib/query';

export function toQueryString(q: Record<string, unknown>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  return p.toString();
}

export const useTransactions = (q: TransactionQuery) =>
  useQuery({
    queryKey: ['transactions', q],
    queryFn: () => api<Paginated<TransactionDTO>>(`/transactions?${toQueryString(q)}`),
    placeholderData: keepPreviousData,
  });

export const useCategories = () =>
  useQuery({
    queryKey: ['categories'],
    queryFn: () => api<{ items: CategoryDTO[] }>('/categories').then((r) => r.items),
    staleTime: 5 * 60_000,
  });

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
  useMutation({ mutationFn: (id: string) => api<TransactionDTO>(`/transactions/${id}/duplicate`, { method: 'POST' }), onSuccess: invalidateFinance });

export const useCategoryMutations = () => ({
  save: useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      id ? api<CategoryDTO>(`/categories/${id}`, { method: 'PATCH', json: data }) : api<CategoryDTO>('/categories', { method: 'POST', json: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }).then(invalidateFinance),
  }),
  remove: useMutation({
    mutationFn: (id: string) => api<void>(`/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }).then(invalidateFinance),
  }),
});
