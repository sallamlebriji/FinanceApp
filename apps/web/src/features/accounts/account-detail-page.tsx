import { ACCOUNT_TYPE_LABELS } from '@mizan/shared';
import { ArrowLeftRight, ChevronLeft, Plus } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Card, EmptyState, ErrorState, Money, SectionHeader, Skeleton } from '@/components/ui/primitives';
import { errorMessage } from '@/lib/api';
import { fmtDate, fmtMoney, fmtMonth, useLocale } from '@/lib/format';
import { useComposer } from '@/stores/composer';
import { useAccountHistory, useAccounts } from './api';

export function AccountDetailPage() {
  const { id } = useParams();
  const locale = useLocale();
  const show = useComposer((s) => s.show);
  const { data: accounts, isLoading: loadingAccounts } = useAccounts(true);
  const account = accounts?.find((a) => a.id === id);
  const { data, isLoading, error, refetch } = useAccountHistory(id);

  if (loadingAccounts) return <Skeleton className="mt-4 h-72 rounded-[var(--radius-card)]" />;
  if (!account)
    return (
      <Card className="mt-4">
        <ErrorState message="This account doesn't exist or was deleted." />
      </Card>
    );

  const series = (data?.series ?? []).map((p) => ({ month: p.month, Balance: Number(p.balance) }));

  return (
    <div className="flex flex-col gap-5">
      <header className="pt-2">
        <Link to="/accounts" className="mb-2 inline-flex items-center text-callout font-medium text-accent hover:underline">
          <ChevronLeft className="size-4" aria-hidden /> Accounts
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-subhead text-label-2">
              {account.name} · {ACCOUNT_TYPE_LABELS[account.type]}
              {account.isArchived && ' · Archived'}
            </p>
            <p className="text-title1 font-semibold tracking-[-0.015em]">
              <Money value={account.balance} currency={account.currency} />
            </p>
          </div>
          {!account.isArchived && (
            <Button variant="tinted" onClick={() => show({ defaults: { accountId: account.id } })}>
              <Plus className="size-4" aria-hidden /> Add transaction
            </Button>
          )}
        </div>
      </header>

      <Card>
        <SectionHeader title="Balance history" subtitle="Month-end balance, last 12 months" />
        <div className="h-56 px-2 pb-3" role="img" aria-label={`Balance by month: ${(data?.series ?? []).map((p) => `${fmtMonth(p.month, locale, 'long')} ${p.balance}`).join('; ')}`}>
          {isLoading ? (
            <Skeleton className="mx-3 h-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="bal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--series-line)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--series-line)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="month" tickFormatter={(v: string) => fmtMonth(v, locale)} tick={{ fill: 'var(--label-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: 'var(--label-3)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  tickFormatter={(v: number) => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(v)}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--label-3)' }}
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="rounded-xl bg-surface px-3 py-2 text-footnote float">
                        <p className="font-semibold">{fmtMonth(String(label), locale, 'long')}</p>
                        <p className="tabular text-label-2">{fmtMoney(String(payload[0]!.value), account.currency, locale)}</p>
                      </div>
                    ) : null
                  }
                />
                <Area type="monotone" dataKey="Balance" stroke="var(--series-line)" strokeWidth={2} fill="url(#bal)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <SectionHeader
          title="Activity"
          action={
            <Link to={`/transactions?accountId=${account.id}`} className="text-subhead font-medium text-accent hover:underline">
              Filter in Transactions
            </Link>
          }
        />
        {error ? (
          <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        ) : !data?.entries.length ? (
          <EmptyState icon={<ArrowLeftRight />} title="No activity yet" message="Transactions on this account will appear here with the running balance." />
        ) : (
          <table className="w-full text-left">
            <thead className="sr-only">
              <tr>
                <th>Transaction</th>
                <th>Change</th>
                <th>Balance after</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--separator)]">
              {data.entries.map((e) => (
                <tr key={e.id}>
                  <td className="py-2.5 pl-5 pr-2">
                    <div className="flex items-center gap-3">
                      {e.type === 'TRANSFER' ? (
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-fill text-label-2" aria-hidden>
                          <ArrowLeftRight className="size-[18px]" />
                        </span>
                      ) : (
                        <CategoryIcon icon={e.category?.icon ?? 'dots'} color={e.category?.color ?? '#8E8E93'} />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-body font-medium">{e.description}</p>
                        <p className="text-subhead text-label-2">{fmtDate(e.date, locale, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 text-right">
                    <Money value={e.change} currency={account.currency} tone="signed" className="text-body font-medium" />
                  </td>
                  <td className="hidden py-2.5 pl-2 pr-5 text-right text-subhead text-label-2 sm:table-cell">
                    <Money value={e.balanceAfter} currency={account.currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
