import type { AccountCreateInput, AccountDTO, AccountUpdateInput } from '@mizan/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { invalidateFinance } from '@/lib/query';

export const useAccounts = (includeArchived = false) =>
  useQuery({
    queryKey: ['accounts', { includeArchived }],
    queryFn: () => api<{ items: AccountDTO[] }>(`/accounts?includeArchived=${includeArchived}`).then((r) => r.items),
  });

export const useAccountHistory = (id: string | undefined) =>
  useQuery({
    queryKey: ['accounts', id, 'history'],
    enabled: !!id,
    queryFn: () =>
      api<{
        series: { month: string; balance: string }[];
        entries: { id: string; date: string; description: string; type: string; change: string; balanceAfter: string; category: { name: string; color: string; icon: string } | null }[];
      }>(`/accounts/${id}/history`),
  });

export const useSaveAccount = () =>
  useMutation({
    mutationFn: ({ id, data }: { id?: string; data: AccountCreateInput | AccountUpdateInput }) =>
      id ? api<AccountDTO>(`/accounts/${id}`, { method: 'PATCH', json: data }) : api<AccountDTO>('/accounts', { method: 'POST', json: data }),
    onSuccess: invalidateFinance,
  });

export const useDeleteAccount = () =>
  useMutation({ mutationFn: (id: string) => api<void>(`/accounts/${id}`, { method: 'DELETE' }), onSuccess: invalidateFinance });
