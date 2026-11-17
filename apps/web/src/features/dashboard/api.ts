import type { DashboardDTO, PeriodPreset } from '@mizan/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const useDashboard = (preset: PeriodPreset) =>
  useQuery({
    queryKey: ['dashboard', preset],
    queryFn: () => api<DashboardDTO>(`/dashboard?preset=${preset}`),
    placeholderData: keepPreviousData,
  });
