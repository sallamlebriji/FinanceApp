import type { DebtCreateInput, DebtDTO, DebtPaymentCreateInput, DebtUpdateInput } from '@mizan/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { invalidateFinance } from '@/lib/query';

export const useDebts = () =>
  useQuery({ queryKey: ['debts'], queryFn: () => api<{ items: DebtDTO[] }>('/debts').then((r) => r.items) });

export const useDebt = (id: string | null) =>
  useQuery({ queryKey: ['debts', 'detail', id], queryFn: () => api<DebtDTO>(`/debts/${id}`), enabled: !!id });

export const useCreateDebt = () =>
  useMutation({ mutationFn: (data: DebtCreateInput) => api<DebtDTO>('/debts', { method: 'POST', json: data }), onSuccess: invalidateFinance });

export const useUpdateDebt = () =>
  useMutation({
    mutationFn: ({ id, data }: { id: string; data: DebtUpdateInput }) => api<DebtDTO>(`/debts/${id}`, { method: 'PATCH', json: data }),
    onSuccess: invalidateFinance,
  });

export const useDeleteDebt = () =>
  useMutation({ mutationFn: (id: string) => api<void>(`/debts/${id}`, { method: 'DELETE' }), onSuccess: invalidateFinance });

export const useAddPayment = () =>
  useMutation({
    mutationFn: ({ id, data }: { id: string; data: DebtPaymentCreateInput }) =>
      api<DebtDTO>(`/debts/${id}/payments`, { method: 'POST', json: data }),
    onSuccess: invalidateFinance,
  });

export const useDeletePayment = () =>
  useMutation({
    mutationFn: ({ id, paymentId }: { id: string; paymentId: string }) =>
      api<DebtDTO>(`/debts/${id}/payments/${paymentId}`, { method: 'DELETE' }),
    onSuccess: invalidateFinance,
  });
