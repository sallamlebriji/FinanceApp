import { zodResolver } from '@hookform/resolvers/zod';
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES, SUPPORTED_CURRENCIES, accountCreateSchema, type AccountDTO } from '@mizan/shared';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/format';
import { useSaveAccount } from './api';

export const ACCOUNT_COLORS = ['#4B3FD1', '#2E9E62', '#C9952B', '#2F93B8', '#D9506A', '#8A63D2', '#E8853D', '#5C6370'];

type FormValues = z.input<typeof accountCreateSchema>;

export function AccountSheet({ open, onOpenChange, account }: { open: boolean; onOpenChange(o: boolean): void; account?: AccountDTO | null }) {
  const save = useSaveAccount();
  const { register, handleSubmit, reset, watch, setValue, formState } = useForm<FormValues>({
    resolver: zodResolver(accountCreateSchema),
    defaultValues: { name: '', type: 'BANK', currency: 'MAD', openingBalance: '0', color: ACCOUNT_COLORS[0], institution: '', includeInNetWorth: true },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      account
        ? {
            name: account.name,
            type: account.type,
            currency: account.currency,
            openingBalance: account.openingBalance,
            color: account.color,
            institution: account.institution ?? '',
            includeInNetWorth: account.includeInNetWorth,
          }
        : { name: '', type: 'BANK', currency: 'MAD', openingBalance: '0', color: ACCOUNT_COLORS[0], institution: '', includeInNetWorth: true },
    );
  }, [open, account, reset]);

  const color = watch('color');
  const onSubmit = handleSubmit(async (values) => {
    try {
      const { currency, ...rest } = values;
      await save.mutateAsync(account ? { id: account.id, data: { ...rest, institution: rest.institution || null } } : { data: { ...values, institution: values.institution || null } });
      toast.success(account ? 'Account updated' : 'Account added');
      onOpenChange(false);
      void currency;
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const locked = !!account && account.transactionCount > 0;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={account ? 'Edit account' : 'New account'}
      description={account ? undefined : 'Balances are calculated from the opening balance and every transaction.'}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" form="account-form" loading={save.isPending}>
            {account ? 'Save changes' : 'Add account'}
          </Button>
        </>
      }
    >
      <form id="account-form" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Name" error={formState.errors.name?.message}>
          {(p) => <Input {...p} autoFocus placeholder="e.g. CIH Current" {...register('name')} />}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type">
            {(p) => (
              <Select {...p} {...register('type')}>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACCOUNT_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Currency" hint={account ? 'Currency is fixed once created' : undefined}>
            {(p) => (
              <Select {...p} disabled={!!account} {...register('currency')}>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field
          label="Opening balance"
          error={formState.errors.openingBalance?.message}
          hint={locked ? 'Changing it shifts the balance and its whole history.' : 'What the account held before you started tracking.'}
        >
          {(p) => <Input {...p} inputMode="decimal" className="tabular" {...register('openingBalance')} />}
        </Field>
        <Field label="Bank or institution (optional)">{(p) => <Input {...p} placeholder="e.g. Attijariwafa bank" {...register('institution')} />}</Field>
        <fieldset>
          <legend className="mb-2 text-subhead font-medium text-label-2">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                aria-pressed={color === c}
                onClick={() => setValue('color', c)}
                className={cn('size-9 rounded-full ring-offset-2 ring-offset-[var(--surface)] transition-shadow', color === c && 'ring-2 ring-[var(--label)]')}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </fieldset>
        <label className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-control)] bg-fill px-3">
          <span className="text-body">Include in net worth</span>
          <input type="checkbox" className="size-5 accent-[var(--accent)]" {...register('includeInNetWorth')} />
        </label>
      </form>
    </Sheet>
  );
}
