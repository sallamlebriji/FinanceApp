import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { AppShell } from '@/components/layout/app-shell';
import { Toaster } from '@/components/ui/toast';
import { AccountDetailPage } from '@/features/accounts/account-detail-page';
import { AccountsPage } from '@/features/accounts/accounts-page';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage, VerifyEmailPage } from '@/features/auth/auth-pages';
import { BudgetsPage } from '@/features/budgets/budgets-page';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { DebtsPage } from '@/features/debts/debts-page';
import { GoalsPage } from '@/features/goals/goals-page';
import { SettingsPage } from '@/features/settings/settings-page';
import { TransactionsPage } from '@/features/transactions/transactions-page';
import { refreshSession } from '@/lib/api';
import { queryClient } from '@/lib/query';
import { useAuth } from '@/stores/auth';
import './styles/index.css';

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center" aria-busy="true" aria-label="Loading Mizan">
      <img src="/mizan.svg" alt="" className="size-10 animate-[shimmer_1.6s_ease-in-out_infinite]" />
    </div>
  );
}

function RequireAuth() {
  const status = useAuth((s) => s.status);
  const location = useLocation();
  if (status === 'loading') return <Splash />;
  if (status === 'anonymous') return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <Outlet />;
}

function GuestOnly() {
  const status = useAuth((s) => s.status);
  if (status === 'loading') return <Splash />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <Outlet />;
}

function App() {
  // Restore the session from the httpOnly refresh cookie on first load.
  useEffect(() => {
    void refreshSession();
  }, []);

  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/debts" element={<DebtsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
