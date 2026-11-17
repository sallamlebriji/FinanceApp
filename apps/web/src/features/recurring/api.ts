import type { RecurringCreateInput, RecurringDTO, RecurringUpdateInput } from '@mizan/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { invalidateFinance, queryClient } from '@/lib/query';

const refresh = () => Promise.all([invalidateFinance(), queryClient.invalidateQueries({ queryKey: ['recurring'] })]);

export const useRecurring = () =>
  useQuery({ queryKey: ['recurring'], queryFn: () => api<{ items: RecurringDTO[] }>('/recurring').then((r) => r.items) });

export const useCreateRecurring = () =>
  useMutation({ mutationFn: (data: RecurringCreateInput) => api<RecurringDTO>('/recurring', { method: 'POST', json: data }), onSuccess: refresh });

export const useUpdateRecurring = () =>
  useMutation({
    mutationFn: ({ id, data }: { id: string; data: RecurringUpdateInput }) => api<RecurringDTO>(`/recurring/${id}`, { method: 'PATCH', json: data }),
    onSuccess: refresh,
  });

export const useDeleteRecurring = () =>
  useMutation({ mutationFn: (id: string) => api<void>(`/recurring/${id}`, { method: 'DELETE' }), onSuccess: refresh });
