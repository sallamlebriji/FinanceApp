import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

/** Refetch stale data when the app returns to the foreground (React Native has no window focus). */
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));
}
onlineManager.setOnline(true);

/** Every financial mutation can change balances, budgets and dashboard figures. */
export function invalidateFinance() {
  return Promise.all(
    ['transactions', 'accounts', 'dashboard', 'budgets', 'notifications'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })),
  );
}
