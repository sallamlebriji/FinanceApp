import type { Currency } from '@mizan/shared';
import { money } from '@mizan/shared';
import { fmtMoney, useLocale } from '@/lib/format';

/**
 * Mizan's signature element — a literal balance (ميزان). The beam tips toward whichever side
 * weighs more this period: income on the left, spending on the right. The tilt is a gentle
 * reinforcement only; the same information is always stated in text (never conveyed by
 * motion or colour alone).
 */
export function BalanceBeam({ income, expense, currency }: { income: string; expense: string; currency: Currency }) {
  const locale = useLocale();
  const inc = money(income);
  const exp = money(expense);
  const heavier = inc.gt(exp) ? inc : exp;
  const ratio = heavier.isZero() ? 0 : exp.minus(inc).div(heavier).toNumber(); // -1 … 1
  const angle = Math.max(-1, Math.min(1, ratio)) * 7; // degrees; + tips right (spending)

  const summary = heavier.isZero()
    ? 'No income or spending recorded in this period yet.'
    : inc.gte(exp)
      ? `Income outweighs spending by ${fmtMoney(inc.minus(exp).toFixed(2), currency, locale)}.`
      : `Spending outweighs income by ${fmtMoney(exp.minus(inc).toFixed(2), currency, locale)}.`;

  return (
    <figure className="m-0">
      <svg viewBox="0 0 240 92" className="h-auto w-full max-w-[260px]" role="img" aria-label={summary}>
        {/* fulcrum */}
        <path d="M120 40 L109 84 H131 Z" fill="var(--fill-strong)" />
        <rect x="96" y="84" width="48" height="3" rx="1.5" fill="var(--fill-strong)" />
        <g
          style={{ transform: `rotate(${angle}deg)`, transformOrigin: '120px 38px', transition: 'transform 900ms var(--ease-out)' }}
        >
          <rect x="22" y="36" width="196" height="4" rx="2" fill="var(--label)" />
          {/* pans */}
          <line x1="34" y1="40" x2="34" y2="54" stroke="var(--label-3)" strokeWidth="1.5" />
          <line x1="206" y1="40" x2="206" y2="54" stroke="var(--label-3)" strokeWidth="1.5" />
          <path d="M16 54 H52 a18 9 0 0 1 -36 0Z" fill="var(--series-income)" />
          <path d="M188 54 H224 a18 9 0 0 1 -36 0Z" fill="var(--series-expense)" />
        </g>
        <circle cx="120" cy="38" r="4.5" fill="var(--surface)" stroke="var(--label)" strokeWidth="2" />
      </svg>
      <figcaption className="sr-only">{summary}</figcaption>
      <p className="mt-1 text-subhead text-label-2" aria-hidden>
        {summary}
      </p>
    </figure>
  );
}
