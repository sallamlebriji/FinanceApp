import type { ContributionCreateInput, GoalCreateInput, GoalUpdateInput, SavingsGoalDTO } from '@mizan/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { invalidateFinance } from '@/lib/query';

export const useGoals = (archived = false) =>
  useQuery({
    queryKey: ['goals', { archived }],
    queryFn: () => api<{ items: SavingsGoalDTO[] }>(`/goals${archived ? '?archived=true' : ''}`).then((r) => r.items),
  });

export const useGoal = (id: string | null) =>
  useQuery({ queryKey: ['goals', 'detail', id], queryFn: () => api<SavingsGoalDTO>(`/goals/${id}`), enabled: !!id });

export const useSaveGoal = () =>
  useMutation({
    mutationFn: ({ id, data }: { id?: string; data: GoalCreateInput | GoalUpdateInput }) =>
      id ? api<SavingsGoalDTO>(`/goals/${id}`, { method: 'PATCH', json: data }) : api<SavingsGoalDTO>('/goals', { method: 'POST', json: data }),
    onSuccess: invalidateFinance,
  });

export const useDeleteGoal = () =>
  useMutation({ mutationFn: (id: string) => api<void>(`/goals/${id}`, { method: 'DELETE' }), onSuccess: invalidateFinance });

export const useAddContribution = () =>
  useMutation({
    mutationFn: ({ id, data }: { id: string; data: ContributionCreateInput }) =>
      api<SavingsGoalDTO>(`/goals/${id}/contributions`, { method: 'POST', json: data }),
    onSuccess: invalidateFinance,
  });

export const useDeleteContribution = () =>
  useMutation({
    mutationFn: ({ id, contributionId }: { id: string; contributionId: string }) =>
      api<SavingsGoalDTO>(`/goals/${id}/contributions/${contributionId}`, { method: 'DELETE' }),
    onSuccess: invalidateFinance,
  });
