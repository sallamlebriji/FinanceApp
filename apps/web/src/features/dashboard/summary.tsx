import type { DashboardDTO } from '@mizan/shared';
import { money } from '@mizan/shared';
import { ArrowDownRight, ArrowUpRight, Info } from 'lucide-react';
import { Card, Money } from '@/components/ui/primitives';
import { cn, fmtDate, pctChange, splitMoney, useLocale, usePct } from '@/lib/format';
import { BalanceBeam } from './balance-beam';

/** Change vs previous period. Direction is spelled out (arrow + sign + words), not colour alone. */
function Delta({ current, previous, goodWhenUp }: { current: string; previous: string; goodWhenUp: boolean }) {
  const fmtP = usePct();
  const pct = pctChange(current, previous);
  if (pct === null) return <span className="text-footnote text-label-3">No data for the previous period</span>;
  const up = pct > 0;
  const good = pct === 0 ? null : up === goodWhenUp;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-footnote font-medium', good === null ? 'text-label-3' : good ? 'text-positive' : 'text-negative')}>
      {pct !== 0 && <Icon className="size-3.5" aria-hidden />}
      <span className="tabular">{fmtP(pct, { signed: true })}</span>
      <span className="sr-only">compared with the previous period</span>
    </span>
  );
}

function Figure({ label, children, footer }: { label: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-subhead text-label-2">{label}</dt>
      <dd className="text-title3 font-semibold tracking-[-0.01em]">{children}</dd>
      <dd>{footer}</dd>
    </div>
  );
}

export function SummaryHero({ data }: { data: DashboardDTO }) {
  const fmtP = usePct();
  const locale = useLocale();
  const base = data.baseCurrency;
  const { number } = splitMoney(data.netWorth.amount, base, locale);
  const negative = money(data.netWorth.amount).isNegative();
  const c = data.current;

  return (
    <Card className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
      <div className="flex flex-col justify-between gap-6">
        <div>
          <p className="text-subhead font-medium text-label-2">Net worth</p>
          <p className="tabular mt-1 text-display font-semibold tracking-[-0.025em]" aria-label={`${negative ? 'minus ' : ''}${number} ${base}`}>
            <span aria-hidden>
              {negative && '−'}
              {number.replace(/^-/, '')}
              <span className="ml-2 text-title3 font-medium tracking-normal text-label-3">{base}</span>
            </span>
          </p>
          {data.netWorth.unconverted.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-footnote text-warning">
              <Info className="size-3.5" aria-hidden />
              {data.netWorth.unconverted.join(', ')} balances are excluded — add an exchange rate in Settings.
            </p>
          )}
          {data.balancesByCurrency.length > 1 && (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-subhead text-label-2">
              {data.balancesByCurrency.map((b) => (
                <li key={b.currency}>
                  <Money value={b.amount} currency={b.currency} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <BalanceBeam income={c.income} expense={c.expense} currency={base} />
      </div>

      <div className="flex flex-col justify-center gap-5 hairline lg:border-l lg:pl-10">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-7">
        <Figure label="Income" footer={<Delta current={c.income} previous={data.previous.income} goodWhenUp />}>
          <Money value={c.income} currency={base} />
        </Figure>
        <Figure label="Spending" footer={<Delta current={c.expense} previous={data.previous.expense} goodWhenUp={false} />}>
          <Money value={c.expense} currency={base} />
        </Figure>
        <Figure label="Cash flow" footer={<Delta current={c.net} previous={data.previous.net} goodWhenUp />}>
          <Money value={c.net} currency={base} tone="signed" />
        </Figure>
        <Figure
          label="Savings rate"
          footer={
            <span className="text-footnote text-label-3">
              {data.previous.savingsRate !== null ? `${fmtP(data.previous.savingsRate)} previous period` : 'Share of income kept'}
            </span>
          }
        >
          <span className="tabular">{c.savingsRate !== null ? fmtP(c.savingsRate) : '—'}</span>
        </Figure>
      </dl>
      <p className="text-footnote text-label-3">
        Changes compare with {fmtDate(data.previousRange.from, locale, { day: 'numeric', month: 'short' })} –{' '}
        {fmtDate(data.previousRange.to, locale, { day: 'numeric', month: 'short' })}
      </p>
      </div>
    </Card>
  );
}
