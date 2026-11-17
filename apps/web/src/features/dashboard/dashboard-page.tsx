import { BarChart3, Landmark, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, SectionHeader, Skeleton } from '@/components/ui/primitives';
import { errorMessage } from '@/lib/api';
import { fmtDate, useLocale } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import { useComposer } from '@/stores/composer';
import { PERIOD_LABELS, usePeriod } from '@/stores/period';
import { useDashboard } from './api';
import { CashFlowChart, NetWorthChart } from './charts';
import { BudgetsCard, GoalsCard, RecentTransactions, SpendingBreakdown } from './lists';
import { SummaryHero } from './summary';

function greeting(name?: string) {
  const h = new Date().getHours();
  const part = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name.split(' ')[0]}` : part;
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-64 rounded-[var(--radius-card)]" />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-80 rounded-[var(--radius-card)]" />
        <Skeleton className="h-80 rounded-[var(--radius-card)]" />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const preset = usePeriod((s) => s.preset);
  const user = useAuth((s) => s.user);
  const locale = useLocale();
  const show = useComposer((s) => s.show);
  const { data, isLoading, error, refetch, isFetching } = useDashboard(preset);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="text-title1 font-semibold tracking-[-0.01em]">{greeting(user?.name)}</h1>
          <p className="text-callout text-label-2">
            {PERIOD_LABELS[preset]}
            {data && ` · ${fmtDate(data.range.from, locale, { day: 'numeric', month: 'short' })} – ${fmtDate(data.range.to, locale, { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </p>
        </div>
        <Link to="/reports" className={buttonVariants({ variant: 'plain', size: 'sm' })}>
          <BarChart3 className="size-4" aria-hidden /> Reports
        </Link>
      </header>

      {isLoading ? (
        <DashboardSkeleton />
      ) : error ? (
        <Card>
          <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        </Card>
      ) : data && !data.hasData ? (
        <Card>
          <EmptyState
            icon={<Landmark />}
            title="Let's set up your money"
            message="Start by adding the accounts you use — a bank account, cash, or savings. Your dashboard fills in as you record transactions."
            action={
              <div className="flex gap-2">
                <Link to="/accounts?new=1" className={buttonVariants({ variant: 'primary' })}>
                  Add an account
                </Link>
                <Button onClick={() => show()}>
                  <Plus className="size-4" aria-hidden /> Add a transaction
                </Button>
              </div>
            }
          />
        </Card>
      ) : data ? (
        <div className={`flex flex-col gap-5 transition-opacity duration-[var(--dur)] ${isFetching ? 'opacity-80' : ''}`}>
          <SummaryHero data={data} />
          <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            <CashFlowChart data={data} />
            <SpendingBreakdown data={data} />
          </div>
          <div className="grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]">
            <RecentTransactions data={data} />
            <div className="flex flex-col gap-5">
              <BudgetsCard data={data} />
              <GoalsCard data={data} />
              <Card>
                <SectionHeader title="Net worth trend" subtitle="Month-end, at current exchange rates" />
                <div className="px-2 pb-3">
                  <NetWorthChart data={data} />
                </div>
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
