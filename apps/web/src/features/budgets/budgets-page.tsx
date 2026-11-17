import { zodResolver } from '@hookform/resolvers/zod';
import { SUPPORTED_CURRENCIES, budgetCreateSchema, type BudgetDTO } from '@mizan/shared';
import { Gauge, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import { PlanSwitcher } from '@/components/layout/plan-switcher';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Confirm } from '@/components/ui/confirm';
import { Field, Input, Select } from '@/components/ui/field';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Badge, Card, EmptyState, ErrorState, Segmented, Skeleton } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { BudgetMeter } from '@/features/dashboard/lists';
import { useCategories } from '@/features/transactions/api';
import { errorMessage } from '@/lib/api';
import { usePct } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import { useBudgets, useDeleteBudget, useSaveBudget } from './api';

type FormValues = z.input<typeof budgetCreateSchema>;

function BudgetSheet({ open, onOpenChange, budget }: { open: boolean; onOpenChange(o: boolean): void; budget: BudgetDTO | null }) {
  const base = useAuth((s) => s.settings?.baseCurrency ?? 'MAD');
  const { data: categories = [] } = useCategories();
  const save = useSaveBudget();
  const { register, handleSubmit, reset, watch, setValue, formState } = useForm<FormValues>({ resolver: zodResolver(budgetCreateSchema) });

  useEffect(() => {
    if (!open) return;
    reset(
      budget
        ? { name: budget.name, period: budget.period, amount: budget.amount, currency: budget.currency, categoryId: budget.categoryId ?? '' }
        : { name: '', period: 'MONTHLY', amount: '', currency: base, categoryId: '' },
    );
  }, [open, budget, reset, base]);

  const period = watch('period') ?? 'MONTHLY';
  const categoryId = watch('categoryId');

  const onSubmit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({ id: budget?.id, data: { ...v, categoryId: v.categoryId || null } });
      toast.success(budget ? 'Budget updated' : 'Budget created');
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={budget ? 'Edit budget' : 'New budget'}
      description={budget ? undefined : "You'll be notified at 50, 75, 90 and 100% of the limit."}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" form="budget-form" loading={save.isPending}>
            {budget ? 'Save changes' : 'Create budget'}
          </Button>
        </>
      }
    >
      <form id="budget-form" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Segmented
          label="Period"
          value={period}
          onChange={(v) => setValue('period', v)}
          options={[
            { value: 'MONTHLY', label: 'Monthly' },
            { value: 'WEEKLY', label: 'Weekly' },
          ]}
          className="w-full"
        />
        <Field label="Category" hint="Subcategories are included automatically.">
          {(p) => (
            <Select
              {...p}
              {...register('categoryId', {
                onChange: (e) => {
                  const c = categories.find((x) => x.id === e.target.value);
                  if (c && !watch('name')) setValue('name', c.name);
                },
              })}
            >
              <option value="">All spending</option>
              {categories
                .filter((c) => c.type === 'EXPENSE' && !c.parentId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          )}
        </Field>
        <Field label="Name" error={formState.errors.name?.message}>
          {(p) => <Input {...p} placeholder={categoryId ? 'e.g. Groceries' : 'e.g. Monthly spending'} {...register('name')} />}
        </Field>
        <div className="grid grid-cols-[1fr_110px] gap-4">
          <Field label={`Limit per ${period === 'MONTHLY' ? 'month' : 'week'}`} error={formState.errors.amount?.message}>
            {(p) => <Input {...p} inputMode="decimal" className="tabular" placeholder="0,00" {...register('amount')} />}
          </Field>
          <Field label="Currency">
            {(p) => (
              <Select {...p} {...register('currency')}>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </form>
    </Sheet>
  );
}

export function BudgetsPage() {
  const fmtP = usePct();
  const [params, setParams] = useSearchParams();
  const { data = [], isLoading, error, refetch } = useBudgets();
  const del = useDeleteBudget();
  const [sheet, setSheet] = useState<{ open: boolean; budget: BudgetDTO | null }>({ open: false, budget: null });
  const [confirm, setConfirm] = useState<BudgetDTO | null>(null);

  useEffect(() => {
    if (params.get('new')) {
      setSheet({ open: true, budget: null });
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const over = data.filter((b) => b.current.state === 'over').length;
  const close = data.filter((b) => b.current.state === 'warning' || b.current.state === 'critical').length;
  const groups: { title: string; items: BudgetDTO[] }[] = [
    { title: 'Monthly', items: data.filter((b) => b.period === 'MONTHLY') },
    { title: 'Weekly', items: data.filter((b) => b.period === 'WEEKLY') },
  ].filter((g) => g.items.length);

  return (
    <div className="flex flex-col gap-5">
      <PlanSwitcher />
      <header className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="text-title1 font-semibold tracking-[-0.01em]">Budgets</h1>
          <p className="text-callout text-label-2">
            {data.length === 0
              ? 'Limits that keep spending intentional'
              : over
                ? `${over} over the limit this period`
                : close
                  ? `${close} close to the limit`
                  : 'All budgets on track'}
          </p>
        </div>
        <Button variant="tinted" onClick={() => setSheet({ open: true, budget: null })}>
          <Plus className="size-4" aria-hidden /> New budget
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
            icon={<Gauge />}
            title="No budgets yet"
            message="Set a monthly or weekly limit for a category, or for all spending."
            action={
              <Button variant="primary" onClick={() => setSheet({ open: true, budget: null })}>
                Create a budget
              </Button>
            }
          />
        </Card>
      ) : (
        groups.map((g) => (
          <section key={g.title} aria-labelledby={`bg-${g.title}`}>
            <h2 id={`bg-${g.title}`} className="mb-2 px-1 text-footnote font-semibold uppercase tracking-[0.04em] text-label-2">
              {g.title}
            </h2>
            <Card>
              <ul className="divide-y divide-[var(--separator)]">
                {g.items.map((b) => (
                  <li key={b.id} className="flex items-start gap-3 px-5 py-4">
                    {b.category ? (
                      <CategoryIcon icon={b.category.icon} color={b.category.color} />
                    ) : (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-accent" aria-hidden>
                        <Gauge className="size-[18px]" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <BudgetMeter b={b} />
                      {b.current.state !== 'ok' && (
                        <div className="mt-2">
                          <Badge tone={b.current.state === 'warning' ? 'warning' : 'negative'}>
                            {b.current.state === 'over' ? 'Over limit' : `${fmtP(b.current.percent)} used`}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <Menu>
                      <MenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={`Actions for ${b.name}`}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem icon={<Pencil />} onSelect={() => setSheet({ open: true, budget: b })}>
                          Edit
                        </MenuItem>
                        <MenuSeparator />
                        <MenuItem icon={<Trash2 />} destructive onSelect={() => setConfirm(b)}>
                          Delete
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ))
      )}

      <BudgetSheet open={sheet.open} budget={sheet.budget} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))} />
      <Confirm
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete “${confirm?.name}”?`}
        message="Your transactions stay untouched; only this limit and its alerts are removed."
        confirmLabel="Delete budget"
        loading={del.isPending}
        onConfirm={() =>
          confirm &&
          del.mutate(confirm.id, {
            onSuccess: () => {
              toast.success('Budget deleted');
              setConfirm(null);
            },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />
    </div>
  );
}
