import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, positiveAmountSchema, todayInTimeZone, type TransactionCreateInput } from '@mizan/shared';
import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Segmented } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { useAccounts } from '@/features/accounts/api';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import { useComposer } from '@/stores/composer';
import { useCategories, useSaveTransaction } from './api';

type Kind = 'EXPENSE' | 'INCOME' | 'TRANSFER';

interface FormState {
  type: Kind;
  amount: string;
  toAmount: string;
  description: string;
  categoryId: string;
  accountId: string;
  toAccountId: string;
  date: string;
  paymentMethod: string;
  note: string;
}

const KIND_OPTIONS = [
  { value: 'EXPENSE' as const, label: 'Expense' },
  { value: 'INCOME' as const, label: 'Income' },
  { value: 'TRANSFER' as const, label: 'Transfer' },
];

export function TransactionComposer() {
  const { open, editing, defaults, close } = useComposer();
  const timezone = useAuth((s) => s.settings?.timezone);
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const save = useSaveTransaction();
  const navigate = useNavigate();

  const blank = (): FormState => ({
    type: defaults.type ?? 'EXPENSE',
    amount: '',
    toAmount: '',
    description: '',
    categoryId: '',
    accountId: defaults.accountId ?? accounts[0]?.id ?? '',
    toAccountId: '',
    date: todayInTimeZone(timezone),
    paymentMethod: '',
    note: '',
  });

  const [f, setF] = useState<FormState>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (editing) {
      setF({
        type: editing.type,
        amount: editing.amount,
        toAmount: editing.toAmount ?? '',
        description: editing.description,
        categoryId: editing.categoryId ?? '',
        accountId: editing.accountId,
        toAccountId: editing.toAccountId ?? '',
        date: editing.date,
        paymentMethod: editing.paymentMethod ?? '',
        note: editing.note ?? '',
      });
      setMoreOpen(!!(editing.note || editing.paymentMethod));
    } else {
      setF(blank());
      setMoreOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const from = accounts.find((a) => a.id === f.accountId);
  const to = accounts.find((a) => a.id === f.toAccountId);
  const crossCurrency = f.type === 'TRANSFER' && from && to && from.currency !== to.currency;
  const visibleCategories = useMemo(
    () => categories.filter((c) => c.type === f.type && !c.parentId),
    [categories, f.type],
  );

  function validate(): boolean {
    const e: typeof errors = {};
    if (!positiveAmountSchema.safeParse(f.amount).success) e.amount = 'Enter an amount greater than zero, with up to 2 decimals';
    if (!f.description.trim()) e.description = 'Add a short description';
    if (!f.accountId) e.accountId = 'Choose an account';
    if (f.type === 'TRANSFER') {
      if (!f.toAccountId) e.toAccountId = 'Choose where the money goes';
      else if (f.toAccountId === f.accountId) e.toAccountId = 'Choose a different account';
      if (crossCurrency && !positiveAmountSchema.safeParse(f.toAmount).success) e.toAmount = `Enter the amount received in ${to?.currency}`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    const common = {
      amount: f.amount,
      date: f.date,
      accountId: f.accountId,
      description: f.description.trim(),
      note: f.note.trim() || null,
      paymentMethod: (f.paymentMethod || null) as TransactionCreateInput['paymentMethod'],
    };
    const data: TransactionCreateInput =
      f.type === 'TRANSFER'
        ? { ...common, type: 'TRANSFER', toAccountId: f.toAccountId, toAmount: crossCurrency ? f.toAmount : null }
        : { ...common, type: f.type, categoryId: f.categoryId || null };
    try {
      if (editing) {
        const { type: _t, ...rest } = data as TransactionCreateInput & { toAccountId?: string; toAmount?: string | null; categoryId?: string | null };
        await save.mutateAsync({ id: editing.id, data: rest });
        toast.success('Transaction updated');
      } else {
        await save.mutateAsync({ data });
        toast.success(f.type === 'INCOME' ? 'Income added' : f.type === 'TRANSFER' ? 'Transfer recorded' : 'Expense added');
      }
      close();
    } catch (err) {
      if (err instanceof ApiError && (err.details as { field?: string })?.field === 'toAmount') setErrors({ toAmount: err.message });
      else toast.error(err instanceof Error ? err.message : 'Could not save');
    }
  }

  const noAccounts = accounts.length === 0;
  const title = editing ? 'Edit transaction' : 'New transaction';
  const submitLabel = editing ? 'Save changes' : f.type === 'INCOME' ? 'Add income' : f.type === 'TRANSFER' ? 'Record transfer' : 'Add expense';

  // Loan and repayment rows are owned by their debt and can only change from there.
  if (open && editing?.debtId) {
    return (
      <Sheet
        open
        onOpenChange={(o) => !o && close()}
        title={editing.description}
        description="This entry is part of a debt, so it's kept out of your income and spending."
        footer={
          <>
            <Button onClick={close}>Close</Button>
            <Button
              variant="primary"
              onClick={() => {
                close();
                navigate('/debts');
              }}
            >
              Open Debts
            </Button>
          </>
        }
      >
        <p className="text-callout text-label-2">To change or remove it, open the debt and edit its repayments — balances update together.</p>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && close()}
      title={title}
      footer={
        !noAccounts && (
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" type="submit" form="composer" loading={save.isPending}>
              {submitLabel}
            </Button>
          </>
        )
      }
    >
      {noAccounts ? (
        <div className="py-8 text-center">
          <p className="text-body font-semibold">Add an account first</p>
          <p className="mt-1 text-callout text-label-2">Transactions belong to an account, like your bank account or cash wallet.</p>
          <Button
            variant="primary"
            className="mt-5"
            onClick={() => {
              close();
              navigate('/accounts?new=1');
            }}
          >
            Add account
          </Button>
        </div>
      ) : (
        <form id="composer" onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          {!editing && (
            <Segmented label="Transaction type" value={f.type} onChange={(v) => set('type', v)} options={KIND_OPTIONS} className="w-full" />
          )}

          {/* Amount — the hero of the form */}
          <Field label="Amount" error={errors.amount}>
            {(p) => (
              <div className="flex items-baseline gap-2 rounded-[var(--radius-control)] bg-fill px-4 py-2 focus-within:bg-surface focus-within:shadow-[var(--ring)]">
                <input
                  {...p}
                  autoFocus
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={f.amount}
                  onChange={(e) => set('amount', e.target.value.replace(/[^\d.,]/g, ''))}
                  className="tabular w-full bg-transparent focus-visible:shadow-none text-[32px] font-semibold leading-10 tracking-[-0.02em] placeholder:text-label-3 focus:outline-none"
                />
                <span className="text-body font-medium text-label-2">{from?.currency ?? 'MAD'}</span>
              </div>
            )}
          </Field>

          <Field label="Description" error={errors.description}>
            {(p) => (
              <Input
                {...p}
                value={f.description}
                maxLength={140}
                placeholder={f.type === 'INCOME' ? 'e.g. Salary' : f.type === 'TRANSFER' ? 'e.g. Monthly saving' : 'e.g. Groceries at Marjane'}
                onChange={(e) => set('description', e.target.value)}
              />
            )}
          </Field>

          {f.type !== 'TRANSFER' && (
            <fieldset>
              <legend className="mb-2 text-subhead font-medium text-label-2">Category</legend>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-4">
                {visibleCategories.map((c) => {
                  const active = f.categoryId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => set('categoryId', active ? '' : c.id)}
                      className={cn(
                        'flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-2 text-footnote transition-colors duration-[var(--dur-fast)]',
                        active ? 'bg-accent-soft text-accent shadow-[inset_0_0_0_1.5px_var(--accent)]' : 'text-label-2 hover:bg-fill',
                      )}
                    >
                      <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                      <span className="line-clamp-1">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={f.type === 'TRANSFER' ? 'From' : 'Account'} error={errors.accountId}>
              {(p) => (
                <Select {...p} value={f.accountId} onChange={(e) => set('accountId', e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.currency}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {f.type === 'TRANSFER' ? (
              <Field label="To" error={errors.toAccountId}>
                {(p) => (
                  <Select {...p} value={f.toAccountId} onChange={(e) => set('toAccountId', e.target.value)}>
                    <option value="">Choose account</option>
                    {accounts
                      .filter((a) => a.id !== f.accountId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} · {a.currency}
                        </option>
                      ))}
                  </Select>
                )}
              </Field>
            ) : (
              <Field label="Date">
                {(p) => <Input {...p} type="date" value={f.date} onChange={(e) => set('date', e.target.value)} required />}
              </Field>
            )}
          </div>

          {f.type === 'TRANSFER' && (
            <div className="grid gap-4 sm:grid-cols-2">
              {crossCurrency && (
                <Field label={`Amount received (${to?.currency})`} error={errors.toAmount} hint="Sets the exchange rate for this transfer">
                  {(p) => <Input {...p} inputMode="decimal" className="tabular" value={f.toAmount} onChange={(e) => set('toAmount', e.target.value.replace(/[^\d.,]/g, ''))} />}
                </Field>
              )}
              <Field label="Date">
                {(p) => <Input {...p} type="date" value={f.date} onChange={(e) => set('date', e.target.value)} required />}
              </Field>
            </div>
          )}

          <div>
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
              className="flex items-center gap-1 text-subhead font-medium text-accent"
            >
              More details
              <ChevronDown className={cn('size-4 transition-transform duration-[var(--dur)]', moreOpen && 'rotate-180')} aria-hidden />
            </button>
            {moreOpen && (
              <div className="mt-3 flex flex-col gap-4">
                <Field label="Payment method">
                  {(p) => (
                    <Select {...p} value={f.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)}>
                      <option value="">Not specified</option>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {PAYMENT_METHOD_LABELS[m]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Note">{(p) => <Textarea {...p} value={f.note} maxLength={1000} onChange={(e) => set('note', e.target.value)} />}</Field>
              </div>
            )}
          </div>
        </form>
      )}
    </Sheet>
  );
}
