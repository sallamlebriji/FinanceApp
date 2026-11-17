import { money, recurringUpdateSchema, todayInTimeZone, type Currency, type RecurringDTO } from '@mizan/shared';
import { ArrowLeftRight, MoreHorizontal, Pause, Pencil, Play, Plus, Repeat, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Confirm } from '@/components/ui/confirm';
import { Field, Input, Select } from '@/components/ui/field';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Badge, Card, EmptyState, ErrorState, Money, Skeleton } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { useCategories } from '@/features/transactions/api';
import { REPEAT_LABELS } from '@/features/transactions/transaction-composer';
import { errorMessage } from '@/lib/api';
import { fmtDate, useLocale } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import { useComposer } from '@/stores/composer';
import { useDeleteRecurring, useRecurring, useUpdateRecurring } from './api';

function cadence(r: RecurringDTO) {
  if (r.interval === 1) return REPEAT_LABELS[r.frequency];
  const unit = { DAILY: 'days', WEEKLY: 'weeks', MONTHLY: 'months', QUARTERLY: 'quarters', YEARLY: 'years' }[r.frequency];
  return `Every ${r.interval} ${unit}`;
}

function EditSheet({ rule, onOpenChange }: { rule: RecurringDTO | null; onOpenChange(o: boolean): void }) {
  const { data: categories = [] } = useCategories();
  const update = useUpdateRecurring();
  const [f, setF] = useState({ amount: '', description: '', categoryId: '', endDate: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!rule) return;
    setErrors({});
    setF({ amount: rule.amount, description: rule.description, categoryId: rule.category?.id ?? '', endDate: rule.endDate ?? '' });
  }, [rule]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!rule) return;
    const data = {
      amount: f.amount,
      description: f.description,
      endDate: f.endDate || null,
      ...(rule.type !== 'TRANSFER' ? { categoryId: f.categoryId || null } : {}),
    };
    const parsed = recurringUpdateSchema.safeParse(data);
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    try {
      await update.mutateAsync({ id: rule.id, data });
      toast.success('Schedule updated');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <Sheet
      open={!!rule}
      onOpenChange={onOpenChange}
      title="Edit schedule"
      description="Changes apply to the next occurrences. Transactions already added stay as they are."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" form="rule-form" loading={update.isPending}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="rule-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Description" error={errors.description}>
          {(p) => <Input {...p} value={f.description} maxLength={140} onChange={(e) => setF({ ...f, description: e.target.value })} />}
        </Field>
        <Field label={`Amount (${rule?.currency ?? ''})`} error={errors.amount}>
          {(p) => <Input {...p} inputMode="decimal" className="tabular" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />}
        </Field>
        {rule && rule.type !== 'TRANSFER' && (
          <Field label="Category">
            {(p) => (
              <Select {...p} value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
                <option value="">Uncategorised</option>
                {categories
                  .filter((c) => c.type === rule.type && !c.parentId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="Ends on (optional)" error={errors.endDate} hint="Leave empty to repeat until you pause or delete it.">
          {(p) => <Input {...p} type="date" min={rule?.startDate} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />}
        </Field>
      </form>
    </Sheet>
  );
}

export function RecurringPage() {
  const locale = useLocale();
  const show = useComposer((s) => s.show);
  const today = todayInTimeZone(useAuth((s) => s.settings?.timezone));
  const { data = [], isLoading, error, refetch } = useRecurring();
  const update = useUpdateRecurring();
  const del = useDeleteRecurring();
  const [editing, setEditing] = useState<RecurringDTO | null>(null);
  const [confirm, setConfirm] = useState<RecurringDTO | null>(null);

  const active = data.filter((r) => r.nextDate);
  const ended = data.filter((r) => !r.nextDate);

  // Monthly commitments per currency: what active schedules take out (or bring in) each month.
  const monthly = new Map<Currency, { in: ReturnType<typeof money>; out: ReturnType<typeof money> }>();
  for (const r of active) {
    if (r.type === 'TRANSFER') continue;
    const m = monthly.get(r.currency) ?? { in: money(0), out: money(0) };
    if (r.type === 'INCOME') m.in = m.in.plus(r.monthlyAmount);
    else m.out = m.out.plus(r.monthlyAmount);
    monthly.set(r.currency, m);
  }

  const finished = (r: RecurringDTO) => !r.isActive && !!r.endDate && r.endDate < today;

  const togglePause = (r: RecurringDTO) =>
    update.mutate(
      { id: r.id, data: { isActive: !r.isActive } },
      { onSuccess: () => toast.success(r.isActive ? 'Schedule paused' : 'Schedule resumed'), onError: (e) => toast.error(errorMessage(e)) },
    );

  const row = (r: RecurringDTO) => (
    <li key={r.id} className="flex items-center gap-3 px-5 py-3.5">
      {r.type === 'TRANSFER' ? (
        <CategoryIcon icon="transfer" color="#5C6370" />
      ) : r.category ? (
        <CategoryIcon icon={r.category.icon} color={r.category.color} />
      ) : (
        <CategoryIcon icon="repeat" color="#5C6370" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-callout font-medium">{r.description}</p>
        <p className="truncate text-footnote text-label-3">
          {cadence(r)} · {r.type === 'TRANSFER' ? `${r.account.name} → ${r.toAccount?.name}` : r.account.name}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <Money value={r.type === 'EXPENSE' ? `-${r.amount}` : r.amount} currency={r.currency} tone={r.type === 'TRANSFER' ? 'neutral' : 'signed'} className="text-callout font-medium" />
        <p className="text-footnote text-label-3">
          {r.nextDate ? `Next ${fmtDate(r.nextDate, locale)}` : finished(r) || r.isActive ? 'Ended' : <Badge>Paused</Badge>}
        </p>
      </div>
      <Menu>
        <MenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={`Actions for ${r.description}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem icon={<Pencil />} onSelect={() => setEditing(r)}>
            Edit
          </MenuItem>
          {!finished(r) && (
            <MenuItem icon={r.isActive ? <Pause /> : <Play />} onSelect={() => togglePause(r)}>
              {r.isActive ? 'Pause' : 'Resume'}
            </MenuItem>
          )}
          <MenuSeparator />
          <MenuItem icon={<Trash2 />} destructive onSelect={() => setConfirm(r)}>
            Delete
          </MenuItem>
        </MenuContent>
      </Menu>
    </li>
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="text-title1 font-semibold tracking-[-0.01em]">Recurring</h1>
          <p className="text-callout text-label-2">
            {active.length ? `${active.length} active schedule${active.length > 1 ? 's' : ''}` : 'Rent, salary, subscriptions — added for you on time'}
          </p>
        </div>
        <Button variant="tinted" onClick={() => show({ defaults: { repeat: 'MONTHLY' } })}>
          <Plus className="size-4" aria-hidden /> New schedule
        </Button>
      </header>

      {monthly.size > 0 && (
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          {[...monthly.entries()].map(([cur, m]) => (
            <div key={cur} className="contents">
              <div>
                <p className="text-footnote font-medium text-label-2">Committed out each month</p>
                <Money value={m.out.toFixed(2)} currency={cur} className="text-title3 font-semibold" />
              </div>
              <div>
                <p className="text-footnote font-medium text-label-2">Expected in each month</p>
                <Money value={m.in.toFixed(2)} currency={cur} className="text-title3 font-semibold" />
              </div>
            </div>
          ))}
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-48 rounded-[var(--radius-card)]" />
      ) : error ? (
        <Card>
          <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        </Card>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Repeat />}
            title="No recurring transactions"
            message="Add a transaction and choose Repeat. Mizan will add it on each date — even while the app is closed."
            action={
              <Button variant="primary" onClick={() => show({ defaults: { repeat: 'MONTHLY' } })}>
                Create a schedule
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <section aria-labelledby="rec-active">
              <h2 id="rec-active" className="mb-2 px-1 text-footnote font-semibold uppercase tracking-[0.04em] text-label-2">
                Upcoming
              </h2>
              <Card>
                <ul className="divide-y divide-[var(--separator)]">{active.map(row)}</ul>
              </Card>
            </section>
          )}
          {ended.length > 0 && (
            <section aria-labelledby="rec-ended">
              <h2 id="rec-ended" className="mb-2 px-1 text-footnote font-semibold uppercase tracking-[0.04em] text-label-2">
                Paused or ended
              </h2>
              <Card>
                <ul className="divide-y divide-[var(--separator)]">{ended.map(row)}</ul>
              </Card>
            </section>
          )}
        </>
      )}

      {data.length > 0 && (
        <p className="flex items-center gap-1.5 px-1 text-footnote text-label-3">
          <ArrowLeftRight className="size-3.5" aria-hidden /> Transactions created by a schedule appear in Activity like any other and can be edited one by one.
        </p>
      )}

      <EditSheet rule={editing} onOpenChange={(o) => !o && setEditing(null)} />
      <Confirm
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete “${confirm?.description}”?`}
        message="No more transactions will be added. The ones already added stay in your history."
        confirmLabel="Delete schedule"
        loading={del.isPending}
        onConfirm={() =>
          confirm &&
          del.mutate(confirm.id, {
            onSuccess: () => {
              toast.success('Schedule deleted');
              setConfirm(null);
            },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />
    </div>
  );
}
