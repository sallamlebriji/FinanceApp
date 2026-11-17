import type { Currency, DashboardDTO } from '@mizan/shared';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, SectionHeader } from '@/components/ui/primitives';
import { fmtMoney, fmtMonth, useLocale } from '@/lib/format';

const axisTick = { fill: 'var(--label-3)', fontSize: 11 };

function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  currency: Currency;
}) {
  const locale = useLocale();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-surface px-3 py-2 text-footnote float">
      <p className="mb-1 font-semibold text-label">{label ? fmtMonth(label, locale, 'long') : ''}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-label-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span>{p.name}</span>
          <span className="tabular ml-auto pl-4 font-medium text-label">{fmtMoney(String(p.value), currency, locale)}</span>
        </p>
      ))}
    </div>
  );
}

/** Income vs spending by month. Two series → legend always present; one y-axis. */
export function CashFlowChart({ data }: { data: DashboardDTO }) {
  const locale = useLocale();
  const rows = data.cashFlow.map((m) => ({ month: m.month, Income: Number(m.income), Spending: Number(m.expense) }));
  const best = data.cashFlow.reduce((a, b) => (Number(b.net) > Number(a.net) ? b : a), data.cashFlow[0]!);
  const headline =
    data.cashFlow.length && Number(best.net) > 0
      ? `Best month: ${fmtMonth(best.month, locale, 'long')}, ${fmtMoney(best.net, data.baseCurrency, locale)} kept`
      : 'Income and spending per month';

  return (
    <Card className="flex flex-col">
      <SectionHeader
        title="Cash flow"
        subtitle={headline}
        action={
          <ul className="flex gap-4 text-footnote text-label-2" aria-label="Legend">
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-[var(--series-income)]" aria-hidden />
              Income
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-[var(--series-expense)]" aria-hidden />
              Spending
            </li>
          </ul>
        }
      />
      <div className="h-64 px-2 pb-3" role="img" aria-label={`Cash flow chart. ${data.cashFlow.map((m) => `${fmtMonth(m.month, locale, 'long')}: income ${m.income}, spending ${m.expense}`).join('; ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="month" tickFormatter={(v: string) => fmtMonth(v, locale)} tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={52}
              tickFormatter={(v: number) => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(v)}
            />
            <Tooltip cursor={{ fill: 'var(--fill)' }} content={<ChartTooltip currency={data.baseCurrency} />} />
            <Bar dataKey="Income" fill="var(--series-income)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
            <Bar dataKey="Spending" fill="var(--series-expense)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** Month-end net worth — single series, so no legend; the title names it. */
export function NetWorthChart({ data }: { data: DashboardDTO }) {
  const locale = useLocale();
  const rows = data.netWorthSeries.map((p) => ({ month: p.month, 'Net worth': Number(p.amount) }));
  return (
    <div className="h-40" role="img" aria-label={`Net worth by month. ${data.netWorthSeries.map((p) => `${fmtMonth(p.month, locale, 'long')}: ${p.amount}`).join('; ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="month" tickFormatter={(v: string) => fmtMonth(v, locale)} tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            width={52}
            domain={['auto', 'auto']}
            tickFormatter={(v: number) => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(v)}
          />
          <Tooltip cursor={{ stroke: 'var(--label-3)', strokeWidth: 1 }} content={<ChartTooltip currency={data.baseCurrency} />} />
          <Line type="monotone" dataKey="Net worth" stroke="var(--series-line)" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface)' }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
