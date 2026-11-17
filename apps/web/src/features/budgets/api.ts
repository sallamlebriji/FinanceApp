import type { BudgetCreateInput, BudgetDTO } from '@mizan/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { invalidateFinance } from '@/lib/query';

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
