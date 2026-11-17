import {
  SUPPORTED_CURRENCIES,
  debtCreateSchema,
  debtPaymentCreateSchema,
  money,
  todayInTimeZone,
  type Currency,
  type DebtDTO,
} from '@mizan/shared';
import { HandCoins, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { PlanSwitcher } from '@/components/layout/plan-switcher';
import { Button } from '@/components/ui/button';
import { Confirm } from '@/components/ui/confirm';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Badge, Card, EmptyState, ErrorState, Money, Progress, Segmented, Skeleton } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { useAccounts } from '@/features/accounts/api';
import { errorMessage } from '@/lib/api';
import { fmtDate, useLocale, usePct } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import { useAddPayment, useCreateDebt, useDebt, useDebts, useDeleteDebt, useDeletePayment, useUpdateDebt } from './api';

function useToday() {
  return todayInTimeZone(useAuth((s) => s.settings?.timezone));
}

const longDate = { day: 'numeric', month: 'long', year: 'numeric' } as const;

/** Active accounts in one currency, for the optional "money moved through" picker. */
function AccountPicker({ currency, value, onChange, label, hint }: { currency: Currency; value: string; onChange(v: string): void; label: string; hint: string }) {
  const { data: accounts = [] } = useAccounts();
  const eligible = accounts.filter((a) => a.currency === currency);
  return (
    <Field label={label} hint={eligible.length ? hint : `You have no ${currency} account — the debt is tracked without moving a balance.`}>
      {(p) => (
        <Select {...p} value={value} onChange={(e) => onChange(e.target.value)} disabled={!eligible.length}>
          <option value="">Don't record in an account</option>
          {eligible.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

/* ---------- create / edit ---------- */

function DebtSheet({ open, onOpenChange, debt }: { open: boolean; onOpenChange(o: boolean): void; debt: DebtDTO | null }) {
  const base = useAuth((s) => s.settings?.baseCurrency ?? 'MAD');
  const today = useToday();
  const create = useCreateDebt();
  const update = useUpdateDebt();
  const empty = { direction: 'BORROWED' as 'BORROWED' | 'LENT', counterparty: '', principal: '', currency: base as Currency, startDate: today, dueDate: '', note: '', accountId: '' };
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setF(
      debt
        ? { direction: debt.direction, counterparty: debt.counterparty, principal: debt.principal, currency: debt.currency, startDate: debt.startDate, dueDate: debt.dueDate ?? '', note: debt.note ?? '', accountId: '' }
        : { ...empty, currency: base, startDate: today },
    );
  }, [open, debt, base, today]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      if (debt) {
        await update.mutateAsync({ id: debt.id, data: { counterparty: f.counterparty, dueDate: f.dueDate || null, note: f.note || null } });
        toast.success('Debt updated');
      } else {
        const data = { ...f, dueDate: f.dueDate || null, note: f.note || null, accountId: f.accountId || null };
        const parsed = debtCreateSchema.safeParse(data);
        if (!parsed.success) {
          setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
          return;
        }
        await create.mutateAsync(data);
        toast.success('Debt recorded');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const borrowed = f.direction === 'BORROWED';
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={debt ? 'Edit debt' : 'New debt'}
      description={debt ? 'The amount and dates of a debt are fixed once recorded; record repayments instead.' : 'Money you borrowed or lent — Mizan keeps it out of your income and spending.'}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" form="debt-form" loading={create.isPending || update.isPending}>
            {debt ? 'Save changes' : 'Record debt'}
          </Button>
        </>
      }
    >
      <form id="debt-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {!debt && (
          <Segmented
            label="Direction"
            value={f.direction}
            onChange={(direction) => setF({ ...f, direction })}
            className="w-full"
            options={[
              { value: 'BORROWED', label: 'I borrowed' },
              { value: 'LENT', label: 'I lent' },
            ]}
          />
        )}
        <Field label={borrowed ? 'Borrowed from' : 'Lent to'} error={errors.counterparty}>
          {(p) => <Input {...p} value={f.counterparty} onChange={(e) => setF({ ...f, counterparty: e.target.value })} placeholder={borrowed ? 'e.g. Karim, CIH Bank' : 'e.g. Sara'} maxLength={80} />}
        </Field>
        {!debt && (
          <>
            <div className="grid grid-cols-[1fr_110px] gap-4">
              <Field label="Amount" error={errors.principal}>
                {(p) => <Input {...p} inputMode="decimal" className="tabular" placeholder="0,00" value={f.principal} onChange={(e) => setF({ ...f, principal: e.target.value })} />}
              </Field>
              <Field label="Currency">
                {(p) => (
                  <Select {...p} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value as Currency, accountId: '' })}>
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <Field label="Date" error={errors.startDate}>
              {(p) => <Input {...p} type="date" value={f.startDate} max={today} onChange={(e) => setF({ ...f, startDate: e.target.value })} />}
            </Field>
            <AccountPicker
              currency={f.currency}
              value={f.accountId}
              onChange={(accountId) => setF({ ...f, accountId })}
              label={borrowed ? 'Received into' : 'Paid from'}
              hint={borrowed ? 'Adds the money to this account. Leave empty for a debt from before you used Mizan.' : 'Takes the money out of this account.'}
            />
          </>
        )}
        <Field label="Due date (optional)" error={errors.dueDate}>
          {(p) => <Input {...p} type="date" value={f.dueDate} min={f.startDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />}
        </Field>
        <Field label="Note (optional)">{(p) => <Textarea {...p} rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={2000} />}</Field>
      </form>
    </Sheet>
  );
}

/* ---------- detail: repayments ---------- */

function DebtDetailSheet({ debtId, onOpenChange }: { debtId: string | null; onOpenChange(o: boolean): void }) {
  const fmtP = usePct();
  const locale = useLocale();
  const today = useToday();
  const { data: d, isLoading } = useDebt(debtId);
  const add = useAddPayment();
  const del = useDeletePayment();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    setAmount('');
    setDate(today);
    setError(undefined);
  }, [debtId, today]);
  // Repay through the account the loan used, by default.
  useEffect(() => setAccountId(d?.account?.id ?? ''), [d?.id, d?.account?.id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!d) return;
    const data = { amount, date, accountId: accountId || null };
    const parsed = debtPaymentCreateSchema.safeParse(data);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    try {
      await add.mutateAsync({ id: d.id, data });
      toast.success('Repayment recorded');
      setAmount('');
      setError(undefined);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const borrowed = d?.direction === 'BORROWED';
  return (
    <Sheet
      open={!!debtId}
      onOpenChange={onOpenChange}
      title={d ? (borrowed ? `Owed to ${d.counterparty}` : `${d.counterparty} owes you`) : 'Debt'}
      description={d ? `Since ${fmtDate(d.startDate, locale, longDate)}${d.dueDate ? ` · due ${fmtDate(d.dueDate, locale, longDate)}` : ''}` : undefined}
    >
      {isLoading || !d ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-title2 font-semibold">
              <Money value={d.remaining} currency={d.currency} />
            </p>
            <p className="text-subhead text-label-2">
              left of <Money value={d.principal} currency={d.currency} />
            </p>
            <div className="mt-3">
              <Progress percent={Number(d.percent)} state={d.overdue ? 'critical' : 'ok'} label={`${fmtP(d.percent)} repaid`} />
            </div>
            <p className="mt-2 text-footnote text-label-2">
              {d.settled ? 'Fully repaid.' : `${fmtP(d.percent)} repaid${d.overdue ? ' · past the due date' : ''}`}
            </p>
            {d.note && <p className="mt-3 whitespace-pre-line text-callout text-label-2">{d.note}</p>}
          </div>

          {!d.settled && (
            <form onSubmit={submit} className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-fill p-4" noValidate>
              <h3 className="text-headline font-semibold">{borrowed ? 'Record a repayment' : 'Record money received'}</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label={`Amount (${d.currency})`} error={error}>
                  {(p) => <Input {...p} inputMode="decimal" className="tabular" placeholder={d.remaining.replace('.', ',')} value={amount} onChange={(e) => setAmount(e.target.value)} />}
                </Field>
                <Field label="Date">{(p) => <Input {...p} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />}</Field>
              </div>
              <AccountPicker
                currency={d.currency}
                value={accountId}
                onChange={setAccountId}
                label={borrowed ? 'Paid from' : 'Received into'}
                hint={borrowed ? 'Takes the repayment out of this account.' : 'Adds the money to this account.'}
              />
              <div className="flex gap-2">
                <Button variant="primary" type="submit" loading={add.isPending} className="flex-1">
                  Record
                </Button>
                <Button type="button" onClick={() => setAmount(d.remaining)}>
                  Full amount
                </Button>
              </div>
            </form>
          )}

          <section aria-labelledby="debt-history">
            <h3 id="debt-history" className="mb-2 text-footnote font-semibold uppercase tracking-[0.04em] text-label-2">
              Repayments
            </h3>
            {d.payments?.length ? (
              <ul className="divide-y divide-[var(--separator)]">
                {d.payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Money value={p.amount} currency={d.currency} className="text-callout font-medium" />
                      <p className="text-footnote text-label-3">
                        {fmtDate(p.date, locale, longDate)}
                        {p.account ? ` · ${p.account.name}` : ''}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-full"
                      aria-label={`Remove repayment of ${p.amount} on ${p.date}`}
                      onClick={() =>
                        del.mutate({ id: d.id, paymentId: p.id }, { onSuccess: () => toast.success('Repayment removed'), onError: (e) => toast.error(errorMessage(e)) })
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-callout text-label-3">No repayments yet.</p>
            )}
          </section>
        </div>
      )}
    </Sheet>
  );
}

/* ---------- page ---------- */

function totals(items: DebtDTO[]) {
  const by = new Map<Currency, ReturnType<typeof money>>();
  for (const d of items) if (!d.settled) by.set(d.currency, (by.get(d.currency) ?? money(0)).plus(d.remaining));
  return [...by.entries()];
}

function DebtGroup({ title, items, onOpen, onEdit, onDelete }: { title: string; items: DebtDTO[]; onOpen(d: DebtDTO): void; onEdit(d: DebtDTO): void; onDelete(d: DebtDTO): void }) {
  const fmtP = usePct();
  const locale = useLocale();
  if (!items.length) return null;
  const sums = totals(items);
  const id = `dg-${title.replace(/\W/g, '')}`;
  return (
    <section aria-labelledby={id}>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 id={id} className="text-footnote font-semibold uppercase tracking-[0.04em] text-label-2">
          {title}
        </h2>
        <p className="text-footnote text-label-2">
          {sums.length
            ? sums.map(([c, v], i) => (
                <span key={c}>
                  {i > 0 && ' + '}
                  <Money value={v.toFixed(2)} currency={c} className="font-semibold text-label" />
                </span>
              ))
            : 'All settled'}
        </p>
      </div>
      <Card>
        <ul className="divide-y divide-[var(--separator)]">
          {items.map((d) => (
            <li key={d.id} className="relative flex items-start gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <button type="button" onClick={() => onOpen(d)} className="min-w-0 truncate text-left text-callout font-medium after:absolute after:inset-0 focus-visible:outline-none">
                    {d.counterparty}
                  </button>
                  <Money value={d.remaining} currency={d.currency} className="shrink-0 text-callout font-semibold" />
                </div>
                <Progress percent={Number(d.percent)} state={d.overdue ? 'critical' : 'ok'} label={`${d.counterparty}: ${fmtP(d.percent)} repaid`} />
                <p className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-footnote text-label-3">
                  <span>
                    <Money value={d.paid} currency={d.currency} className="text-label-2" /> of <Money value={d.principal} currency={d.currency} /> repaid
                  </span>
                  {d.settled ? (
                    <Badge tone="positive">Settled</Badge>
                  ) : d.overdue ? (
                    <Badge tone="negative">Overdue</Badge>
                  ) : d.dueDate ? (
                    <span>Due {fmtDate(d.dueDate, locale)}</span>
                  ) : null}
                </p>
              </div>
              <Menu>
                <MenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="relative z-10 rounded-full" aria-label={`Actions for ${d.counterparty}`}>
                    <MoreHorizontal className="size-4" />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem icon={<Pencil />} onSelect={() => onEdit(d)}>
                    Edit
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem icon={<Trash2 />} destructive onSelect={() => onDelete(d)}>
                    Delete
                  </MenuItem>
                </MenuContent>
              </Menu>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

export function DebtsPage() {
  const { data = [], isLoading, error, refetch } = useDebts();
  const del = useDeleteDebt();
  const [sheet, setSheet] = useState<{ open: boolean; debt: DebtDTO | null }>({ open: false, debt: null });
  const [detail, setDetail] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<DebtDTO | null>(null);

  const owe = data.filter((d) => d.direction === 'BORROWED');
  const owed = data.filter((d) => d.direction === 'LENT');
  const overdue = data.filter((d) => d.overdue).length;
  const open = data.filter((d) => !d.settled).length;

  return (
    <div className="flex flex-col gap-5">
      <PlanSwitcher />
      <header className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="text-title1 font-semibold tracking-[-0.01em]">Debts</h1>
          <p className="text-callout text-label-2">
            {data.length === 0 ? 'Money you owe and money owed to you' : overdue ? `${overdue} past the due date` : open ? `${open} open` : 'Everything settled'}
          </p>
        </div>
        <Button variant="tinted" onClick={() => setSheet({ open: true, debt: null })}>
          <Plus className="size-4" aria-hidden /> New debt
        </Button>
      </header>

      {isLoading ? (
        <Skeleton className="h-48 rounded-[var(--radius-card)]" />
      ) : error ? (
        <Card>
          <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        </Card>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<HandCoins />}
            title="No debts recorded"
            message="Track a loan from family, a credit, or money you lent a friend. Repayments update your accounts, never your spending."
            action={
              <Button variant="primary" onClick={() => setSheet({ open: true, debt: null })}>
                Record a debt
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <DebtGroup title="You owe" items={owe} onOpen={(d) => setDetail(d.id)} onEdit={(d) => setSheet({ open: true, debt: d })} onDelete={setConfirm} />
          <DebtGroup title="Owed to you" items={owed} onOpen={(d) => setDetail(d.id)} onEdit={(d) => setSheet({ open: true, debt: d })} onDelete={setConfirm} />
        </>
      )}

      <DebtSheet open={sheet.open} debt={sheet.debt} onOpenChange={(o) => setSheet((s) => ({ ...s, open: o }))} />
      <DebtDetailSheet debtId={detail} onOpenChange={(o) => !o && setDetail(null)} />
      <Confirm
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete the debt with ${confirm?.counterparty}?`}
        message="Its repayments and the account movements it recorded are removed too, so balances go back to how they were."
        confirmLabel="Delete debt"
        loading={del.isPending}
        onConfirm={() =>
          confirm &&
          del.mutate(confirm.id, {
            onSuccess: () => {
              toast.success('Debt deleted');
              setConfirm(null);
            },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />
    </div>
  );
}
