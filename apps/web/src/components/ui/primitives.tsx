import type { Currency } from '@mizan/shared';
import { money } from '@mizan/shared';
import type { ReactNode } from 'react';
import { cn, fmtMoney, splitMoney, useLocale } from '@/lib/format';

/* ---------- Money ---------- */

type Tone = 'auto' | 'neutral' | 'signed';

/**
 * Displays an amount with tabular figures. `signed` prefixes + / − and colours it; meaning is
 * never carried by colour alone (the sign is always present).
 */
export function Money({
  value,
  currency,
  tone = 'neutral',
  className,
  codeClassName,
}: {
  value: string;
  currency: Currency;
  tone?: Tone;
  className?: string;
  codeClassName?: string;
}) {
  const locale = useLocale();
  const v = money(value);
  const { number } = splitMoney(v.abs().toFixed(2), currency, locale);
  const sign = tone === 'signed' ? (v.isNegative() ? '−' : v.isZero() ? '' : '+') : v.isNegative() ? '−' : '';
  const color = tone === 'signed' ? (v.isNegative() ? 'text-label' : v.isZero() ? 'text-label' : 'text-positive') : '';
  return (
    <span className={cn('tabular whitespace-nowrap', color, className)} aria-label={fmtMoney(value, currency, locale, { signDisplay: tone === 'signed' ? 'exceptZero' : 'auto' })}>
      <span aria-hidden>
        {sign}
        {number}
        <span className={cn('ml-1 font-normal text-[0.8em] opacity-60', codeClassName)}>{currency}</span>
      </span>
    </span>
  );
}

/* ---------- Surfaces ---------- */

export function Card({ children, className, as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <As className={cn('rounded-[var(--radius-card)] bg-surface', className)}>{children}</As>;
}

export function SectionHeader({ title, action, subtitle }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 px-5 pt-4 pb-2">
      <div>
        <h2 className="text-body font-semibold">{title}</h2>
        {subtitle && <p className="text-subhead text-label-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Segmented control ---------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange(v: T): void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-[var(--radius-control)] bg-fill p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-8 flex-1 rounded-[8px] px-3 text-subhead font-medium transition-[background,color,box-shadow] duration-[var(--dur-fast)]',
              active ? 'bg-surface text-label shadow-[0_1px_3px_rgb(0_0_0/0.12)] dark:bg-fill-strong' : 'text-label-2 hover:text-label',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Progress ---------- */

const stateColor = { ok: 'bg-accent', warning: 'bg-warning', critical: 'bg-negative', over: 'bg-negative' } as const;

export function Progress({ percent, state = 'ok', label }: { percent: number; state?: keyof typeof stateColor; label: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} className="h-1.5 w-full overflow-hidden rounded-full bg-fill">
      <div className={cn('h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out)]', stateColor[state])} style={{ width: `${clamped}%` }} />
    </div>
  );
}

/* ---------- States ---------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('rounded-lg bg-fill animate-[shimmer_1.6s_ease-in-out_infinite]', className)} aria-hidden />;
}

export function EmptyState({ icon, title, message, action }: { icon: ReactNode; title: string; message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent [&>svg]:size-6" aria-hidden>
        {icon}
      </div>
      <h3 className="text-body font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-callout text-label-2">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-10 text-center">
      <p className="text-callout text-label-2">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 text-callout font-medium text-accent hover:underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'accent' }) {
  const tones = {
    neutral: 'bg-fill text-label-2',
    positive: 'bg-positive-soft text-positive',
    negative: 'bg-negative-soft text-negative',
    warning: 'bg-warning-soft text-warning',
    accent: 'bg-accent-soft text-accent',
  };
  return <span className={cn('inline-flex h-5 items-center rounded-full px-2 text-caption font-semibold', tones[tone])}>{children}</span>;
}
