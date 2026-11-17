import type { BudgetDTO, DashboardDTO } from '@mizan/shared';
import { ChevronRight, Gauge, PiggyBank, Receipt } from 'lucide-react';
import { Link } from 'react-router';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Card, EmptyState, Money, Progress, SectionHeader } from '@/components/ui/primitives';
import { TransactionRow } from '@/features/transactions/transaction-row';
import { fmtDate, useLocale } from '@/lib/format';
import { useComposer } from '@/stores/composer';

function SeeAll({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="flex items-center text-subhead font-medium text-accent hover:underline" aria-label={label}>
      See all
      <ChevronRight className="size-4" aria-hidden />
    </Link>
  );
}

/** Ranked meter list in one hue: identity comes from the label, magnitude from length. */
export function SpendingBreakdown({ data }: { data: DashboardDTO }) {
  const items = data.spendingByCategory.slice(0, 6);
  const rest = data.spendingByCategory.slice(6);
  const restTotal = rest.reduce((s, i) => s + Number(i.amount), 0);
  const restPct = rest.reduce((s, i) => s + Number(i.percent), 0);
  const max = Math.max(...data.spendingByCategory.map((i) => Number(i.amount)), 1);
  const top = data.spendingByCategory[0];

  return (
    <Card className="flex flex-col">
      <SectionHeader title="Where it went" subtitle={top ? `${top.name} leads at ${top.percent}% of spending` : 'Spending by category'} />
      {items.length === 0 ? (
        <EmptyState icon={<Receipt />} title="No spending yet" message="Expenses you add in this period will be grouped by category here." />
      ) : (
        <ul className="flex flex-col gap-3.5 px-5 pb-5 pt-2">
          {items.map((i) => (
            <li key={i.categoryId ?? 'none'}>
              <div className="mb-1.5 flex items-center gap-2.5">
                <CategoryIcon icon={i.icon} color={i.color} size="sm" />
                <span className="flex-1 truncate text-callout">{i.name}</span>
                <Money value={i.amount} currency={data.baseCurrency} className="text-callout font-medium" />
                <span className="tabular w-12 text-right text-footnote text-label-3">{i.percent}%</span>
              </div>
              <div className="ml-[38px] h-1.5 overflow-hidden rounded-full bg-fill" aria-hidden>
                <div className="h-full rounded-full bg-[var(--series-income)]" style={{ width: `${(Number(i.amount) / max) * 100}%` }} />
              </div>
            </li>
          ))}
          {rest.length > 0 && (
            <li className="flex items-center gap-2.5 pl-[38px] text-callout text-label-2">
              <span className="flex-1">
                {rest.length} more {rest.length > 1 ? 'categories' : 'category'}
              </span>
              <Money value={restTotal.toFixed(2)} currency={data.baseCurrency} />
              <span className="tabular w-12 text-right text-footnote text-label-3">{restPct.toFixed(1)}%</span>
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

export function RecentTransactions({ data }: { data: DashboardDTO }) {
  const show = useComposer((s) => s.show);
  return (
    <Card className="flex flex-col">
      <SectionHeader title="Recent activity" action={data.recentTransactions.length > 0 && <SeeAll to="/transactions" label="See all transactions" />} />
      {data.recentTransactions.length === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title="No transactions yet"
          message="Add your first income or expense to start seeing your cash flow."
          action={
            <button type="button" onClick={() => show()} className="text-callout font-medium text-accent hover:underline">
              Add a transaction
            </button>
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--separator)] pb-2">
          {data.recentTransactions.map((t) => (
            <li key={t.id}>
              <TransactionRow t={t} onEdit={() => show({ editing: t })} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function BudgetMeter({ b }: { b: BudgetDTO }) {
  const locale = useLocale();
  const pct = Number(b.current.percent);
  const remaining = Number(b.current.remaining);
  return (
    <div>
      {/* Name gets the full row; figures move below the meter so nothing truncates. */}
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-callout font-medium">{b.name}</span>
        <span className="tabular shrink-0 text-footnote text-label-2">{b.current.percent}%</span>
      </div>
      <Progress percent={pct} state={b.current.state} label={`${b.name}: ${b.current.percent}% used`} />
      <p className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-footnote text-label-3">
        <span>
          <Money value={b.current.spent} currency={b.currency} className="text-label-2" /> of <Money value={b.amount} currency={b.currency} />
        </span>
        {remaining >= 0 ? (
          <span>
            <Money value={b.current.remaining} currency={b.currency} /> left · until {fmtDate(b.current.range.to, locale)}
          </span>
        ) : (
          <span className="font-medium text-negative">
            Over by <Money value={String(-remaining)} currency={b.currency} />
          </span>
        )}
      </p>
    </div>
  );
}

export function BudgetsCard({ data }: { data: DashboardDTO }) {
  return (
    <Card className="flex flex-col">
      <SectionHeader title="Budgets" action={data.budgets.length > 0 && <SeeAll to="/budgets" label="See all budgets" />} />
      {data.budgets.length === 0 ? (
        <EmptyState
          icon={<Gauge />}
          title="No budgets yet"
          message="Set a monthly or weekly limit and Mizan will alert you at 50, 75, 90 and 100%."
          action={
            <Link to="/budgets?new=1" className="text-callout font-medium text-accent hover:underline">
              Create a budget
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-5 px-5 pb-5 pt-2">
          {data.budgets.slice(0, 4).map((b) => (
            <li key={b.id}>
              <BudgetMeter b={b} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function GoalsCard({ data }: { data: DashboardDTO }) {
  if (data.savingsGoals.length === 0) return null; // Savings module ships in Phase 4; hide until there is data.
  return (
    <Card className="flex flex-col">
      <SectionHeader title="Savings goals" />
      <ul className="flex flex-col gap-5 px-5 pb-5 pt-2">
        {data.savingsGoals.map((g) => (
          <li key={g.id} className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-positive-soft text-positive" aria-hidden>
              <PiggyBank className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="truncate text-callout font-medium">{g.name}</span>
                <span className="tabular text-footnote text-label-2">{g.percent}%</span>
              </div>
              <Progress percent={Number(g.percent)} label={`${g.name}: ${g.percent}% saved`} />
              <p className="mt-1 text-footnote text-label-3">
                <Money value={g.current} currency={g.currency} /> of <Money value={g.target} currency={g.currency} />
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

