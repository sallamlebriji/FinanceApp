import type { PeriodPreset, ReportDTO } from '@mizan/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BarChart3, FileSpreadsheet, FileText } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Card, EmptyState, ErrorState, Money, SectionHeader, Skeleton } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';
import { CashFlowChart } from '@/features/dashboard/charts';
import { api, download, errorMessage } from '@/lib/api';
import { cn, fmtDate, fmtMoney, pctChange, useLocale, usePct } from '@/lib/format';
import { PERIOD_LABELS, usePeriod } from '@/stores/period';

const useReport = (preset: PeriodPreset) =>
  useQuery({ queryKey: ['reports', preset], queryFn: () => api<ReportDTO>(`/reports?preset=${preset}`), placeholderData: keepPreviousData });

/** Change vs the previous period. For spending, going down is good. */
function Change({ current, previous, goodWhenUp }: { current: string; previous: string; goodWhenUp: boolean }) {
  const fmtP = usePct();
  const pct = pctChange(current, previous);
  if (pct === null) return <span className="text-footnote text-label-3">No earlier data</span>;
  const good = pct === 0 ? null : pct > 0 === goodWhenUp;
  return (
    <span className={cn('tabular text-footnote font-medium', good === null ? 'text-label-3' : good ? 'text-positive' : 'text-negative')}>
      {fmtP(pct, { signed: true })} <span className="font-normal text-label-3">vs previous</span>
    </span>
  );
}

function Kpi({ label, children, footer }: { label: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Card as="div" className="flex flex-col gap-1 p-4">
      <span className="text-footnote font-medium text-label-2">{label}</span>
      <span className="text-title3 font-semibold">{children}</span>
      {footer}
    </Card>
  );
}

const WEEKDAY_KEYS = [0, 1, 2, 3, 4, 5, 6];

function WeekdayChart({ r }: { r: ReportDTO }) {
  const locale = useLocale();
  // 2024-01-01 was a Monday; format each weekday name in the user's language.
  const name = (wd: number, style: 'short' | 'long') =>
    new Intl.DateTimeFormat(locale, { weekday: style, timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + wd)));
  const rows = WEEKDAY_KEYS.map((wd) => ({ day: name(wd, 'short'), long: name(wd, 'long'), amount: Number(r.byWeekday[wd]?.amount ?? 0) }));
  const top = [...rows].sort((a, b) => b.amount - a.amount)[0];
  return (
    <Card className="flex flex-col">
      <SectionHeader title="By day of the week" subtitle={top && top.amount > 0 ? `Most spending on ${top.long}` : 'Spending per weekday'} />
      <div className="h-44 px-2 pb-3" role="img" aria-label={rows.map((x) => `${x.long}: ${fmtMoney(String(x.amount), r.baseCurrency, locale)}`).join('; ')}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fill: 'var(--label-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'var(--fill)' }}
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <div className="rounded-xl bg-surface px-3 py-2 text-footnote float">
                    <p className="font-semibold">{(payload[0].payload as { long: string }).long}</p>
                    <p className="tabular text-label-2">{fmtMoney(String(payload[0].value), r.baseCurrency, locale)}</p>
                  </div>
                ) : null
              }
            />
            <Bar dataKey="amount" fill="var(--series-expense)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function CategoryChanges({ r }: { r: ReportDTO }) {
  const fmtP = usePct();
  const max = Math.max(...r.expenseByCategory.map((c) => Number(c.amount)), 1);
  return (
    <Card className="flex flex-col">
      <SectionHeader title="Spending by category" subtitle="Compared with the previous period of the same length" />
      {r.expenseByCategory.length === 0 ? (
        <p className="px-5 pb-5 text-callout text-label-3">No spending in this period.</p>
      ) : (
        <ul className="flex flex-col gap-3.5 px-5 pb-5 pt-1">
          {r.expenseByCategory.map((c) => {
            const change = pctChange(c.amount, c.previous);
            return (
              <li key={c.categoryId ?? 'none'} className="flex items-center gap-3">
                <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="truncate text-callout">{c.name}</span>
                    <Money value={c.amount} currency={r.baseCurrency} className="text-callout font-medium" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill">
                      <div className="h-full rounded-full" style={{ width: `${(Number(c.amount) / max) * 100}%`, background: c.color }} />
                    </div>
                    <span
                      className={cn(
                        'tabular w-24 shrink-0 text-right text-footnote',
                        change === null ? 'text-label-3' : change > 0 ? 'text-negative' : change < 0 ? 'text-positive' : 'text-label-3',
                      )}
                    >
                      {change === null ? 'new' : fmtP(change, { signed: true })}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function RankedList({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle?: string;
  rows: { key: string; primary: React.ReactNode; secondary?: React.ReactNode; value: React.ReactNode }[];
}) {
  return (
    <Card className="flex flex-col">
      <SectionHeader title={title} subtitle={subtitle} />
      {rows.length === 0 ? (
        <p className="px-5 pb-5 text-callout text-label-3">Nothing in this period.</p>
      ) : (
        <ol className="divide-y divide-[var(--separator)] px-5 pb-2">
          {rows.map((x) => (
            <li key={x.key} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-callout">{x.primary}</p>
                {x.secondary && <p className="text-footnote text-label-3">{x.secondary}</p>}
              </div>
              <div className="shrink-0 text-callout font-medium">{x.value}</div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function ReportsPage() {
  const preset = usePeriod((s) => s.preset);
  const locale = useLocale();
  const fmtP = usePct();
  const { data: r, isLoading, error, refetch, isFetching } = useReport(preset);
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);

  async function exportFile(kind: 'pdf' | 'xlsx') {
    setExporting(kind);
    try {
      await download(`/reports/export.${kind}?preset=${preset}`, `mizan-report.${kind}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="text-title1 font-semibold tracking-[-0.01em]">Reports</h1>
          <p className="text-callout text-label-2">
            {PERIOD_LABELS[preset]}
            {r && ` · ${fmtDate(r.range.from, locale, { day: 'numeric', month: 'short' })} – ${fmtDate(r.range.to, locale, { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => exportFile('pdf')} loading={exporting === 'pdf'} disabled={!r}>
            <FileText className="size-4" aria-hidden /> PDF
          </Button>
          <Button onClick={() => exportFile('xlsx')} loading={exporting === 'xlsx'} disabled={!r}>
            <FileSpreadsheet className="size-4" aria-hidden /> Excel
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading report">
          <Skeleton className="h-24 rounded-[var(--radius-card)]" />
          <Skeleton className="h-72 rounded-[var(--radius-card)]" />
        </div>
      ) : error ? (
        <Card>
          <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        </Card>
      ) : r && r.totals.transactionCount === 0 ? (
        <Card>
          <EmptyState icon={<BarChart3 />} title="Nothing to report yet" message="Record income and expenses for this period, or pick a longer period from the top bar." />
        </Card>
      ) : r ? (
        <div className={cn('flex flex-col gap-5 transition-opacity duration-[var(--dur)]', isFetching && 'opacity-80')}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Kpi label="Income" footer={<Change current={r.totals.income} previous={r.previousTotals.income} goodWhenUp />}>
              <Money value={r.totals.income} currency={r.baseCurrency} />
            </Kpi>
            <Kpi label="Spending" footer={<Change current={r.totals.expense} previous={r.previousTotals.expense} goodWhenUp={false} />}>
              <Money value={r.totals.expense} currency={r.baseCurrency} />
            </Kpi>
            <Kpi label="Net cash flow" footer={<Change current={r.totals.net} previous={r.previousTotals.net} goodWhenUp />}>
              <Money value={r.totals.net} currency={r.baseCurrency} tone="signed" />
            </Kpi>
            <Kpi label="Savings rate" footer={<span className="text-footnote text-label-3">Share of income kept</span>}>
              <span className="tabular">{r.totals.savingsRate === null ? '—' : fmtP(r.totals.savingsRate)}</span>
            </Kpi>
            <Kpi label="Spending per day" footer={<span className="text-footnote text-label-3">{r.totals.transactionCount} transactions</span>}>
              <Money value={r.totals.averageDailySpend} currency={r.baseCurrency} />
            </Kpi>
          </div>
          {r.totals.unconverted.length > 0 && (
            <p className="text-footnote text-warning">
              No exchange rate recorded for {r.totals.unconverted.join(', ')} — those amounts are left out. Add a rate in Settings.
            </p>
          )}

          {r.monthly.length > 1 && <CashFlowChart data={{ cashFlow: r.monthly, baseCurrency: r.baseCurrency }} />}

          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <CategoryChanges r={r} />
            <div className="flex flex-col gap-5">
              <RankedList
                title="Where the money went"
                subtitle="Grouped by description"
                rows={r.topPayees.map((p) => ({
                  key: p.description,
                  primary: p.description,
                  secondary: `${p.count} ${p.count === 1 ? 'transaction' : 'transactions'}`,
                  value: <Money value={p.amount} currency={r.baseCurrency} />,
                }))}
              />
              <WeekdayChart r={r} />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <RankedList
              title="Largest expenses"
              rows={r.largestExpenses.map((t) => ({
                key: t.id,
                primary: t.description,
                secondary: `${fmtDate(t.date, locale, { day: 'numeric', month: 'short' })} · ${t.category?.name ?? 'Uncategorised'}`,
                value: <Money value={t.amount} currency={t.currency} />,
              }))}
            />
            <RankedList
              title="Income sources"
              rows={r.incomeByCategory.map((c) => ({
                key: c.categoryId ?? 'none',
                primary: c.name,
                secondary: fmtP(c.percent),
                value: <Money value={c.amount} currency={r.baseCurrency} />,
              }))}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
