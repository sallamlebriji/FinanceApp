import {
  SUPPORTED_CURRENCIES,
  contributionCreateSchema,
  goalCreateSchema,
  todayInTimeZone,
  type Currency,
  type SavingsGoalDTO,
} from '@mizan/shared';
import { Archive, ArchiveRestore, Minus, MoreHorizontal, Pencil, PiggyBank, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { PlanSwitcher } from '@/components/layout/plan-switcher';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Confirm } from '@/components/ui/confirm';
import { Field, Input, Select } from '@/components/ui/field';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Badge, Card, EmptyState, ErrorState, Money, Progress, Segmented, Skeleton } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { ACCOUNT_COLORS } from '@/features/accounts/account-sheet';
import { errorMessage } from '@/lib/api';
import { cn, fmtDate, useLocale, usePct } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import { useAddContribution, useDeleteContribution, useDeleteGoal, useGoal, useGoals, useSaveGoal } from './api';

const GOAL_ICONS = ['piggy', 'plane', 'home', 'car', 'gift', 'heart', 'book', 'laptop', 'baby', 'gym'] as const;
type GoalIcon = (typeof GOAL_ICONS)[number];

function useToday() {
  return todayInTimeZone(useAuth((s) => s.settings?.timezone));
}

/* ---------- create / edit ---------- */

function GoalSheet({ open, onOpenChange, goal }: { open: boolean; onOpenChange(o: boolean): void; goal: SavingsGoalDTO | null }) {
  const base = useAuth((s) => s.settings?.baseCurrency ?? 'MAD');
  const save = useSaveGoal();
  const [f, setF] = useState({ name: '', targetAmount: '', currency: base as Currency, deadline: '', icon: 'piggy' as GoalIcon, color: ACCOUNT_COLORS[1]! });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setF(
      goal
        ? {
            name: goal.name,
            targetAmount: goal.targetAmount,
            currency: goal.currency,
            deadline: goal.deadline ?? '',
            icon: (GOAL_ICONS as readonly string[]).includes(goal.icon) ? (goal.icon as GoalIcon) : 'piggy',
            color: goal.color,
          }
        : { name: '', targetAmount: '', currency: base, deadline: '', icon: 'piggy', color: ACCOUNT_COLORS[1]! },
    );
  }, [open, goal, base]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = goalCreateSchema.safeParse({ ...f, deadline: f.deadline || null });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    try {
      await save.mutateAsync({ id: goal?.id, data: { ...f, deadline: f.deadline || null } });
      toast.success(goal ? 'Goal updated' : 'Goal created');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={goal ? 'Edit goal' : 'New savings goal'}
      description={goal ? undefined : 'Set money aside for something that matters, and see how much to save each month.'}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" form="goal-form" loading={save.isPending}>
            {goal ? 'Save changes' : 'Create goal'}
          </Button>
        </>
      }
    >
      <form id="goal-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Name" error={errors.name}>
          {(p) => <Input {...p} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Summer in Chefchaouen" maxLength={60} />}
        </Field>
        <div className="grid grid-cols-[1fr_110px] gap-4">
          <Field label="Target" error={errors.targetAmount}>
            {(p) => (
              <Input {...p} inputMode="decimal" className="tabular" placeholder="0,00" value={f.targetAmount} onChange={(e) => setF({ ...f, targetAmount: e.target.value })} />
            )}
          </Field>
          <Field label="Currency">
            {(p) => (
              <Select {...p} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value as Currency })}>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Target date (optional)" error={errors.deadline} hint="With a date, Mizan works out how much to set aside each month.">
          {(p) => <Input {...p} type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} />}
        </Field>
        <fieldset>
          <legend className="mb-2 text-subhead font-medium text-label-2">Icon</legend>
          <div className="flex flex-wrap gap-2">
            {GOAL_ICONS.map((i) => (
              <button
                key={i}
                type="button"
                aria-label={`Icon ${i}`}
                aria-pressed={f.icon === i}
                onClick={() => setF({ ...f, icon: i })}
                className={cn('rounded-[12px] p-0.5 ring-offset-2 ring-offset-[var(--surface)]', f.icon === i && 'ring-2 ring-[var(--label)]')}
              >
                <CategoryIcon icon={i} color={f.color} size="lg" />
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-subhead font-medium text-label-2">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                aria-pressed={f.color === c}
                onClick={() => setF({ ...f, color: c })}
                className={cn('size-9 rounded-full ring-offset-2 ring-offset-[var(--surface)] transition-shadow', f.color === c && 'ring-2 ring-[var(--label)]')}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </fieldset>
      </form>
    </Sheet>
  );
}

/* ---------- detail: add / withdraw money, history ---------- */

function GoalDetailSheet({ goalId, onOpenChange }: { goalId: string | null; onOpenChange(o: boolean): void }) {
  const fmtP = usePct();
  const locale = useLocale();
  const today = useToday();
  const { data: goal, isLoading } = useGoal(goalId);
  const add = useAddContribution();
  const del = useDeleteContribution();
  const [kind, setKind] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setKind('DEPOSIT');
    setAmount('');
    setDate(today);
    setError(undefined);
  }, [goalId, today]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!goal) return;
    const parsed = contributionCreateSchema.safeParse({ amount, kind, date });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    try {
      await add.mutateAsync({ id: goal.id, data: { amount, kind, date } });
      toast.success(kind === 'DEPOSIT' ? 'Added to goal' : 'Withdrawn from goal');
      setAmount('');
      setError(undefined);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Sheet open={!!goalId} onOpenChange={onOpenChange} title={goal?.name ?? 'Goal'} description={goal?.deadline ? `Target date ${fmtDate(goal.deadline, locale, { day: 'numeric', month: 'long', year: 'numeric' })}` : undefined}>
      {isLoading || !goal ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-title2 font-semibold">
              <Money value={goal.saved} currency={goal.currency} />
            </p>
            <p className="text-subhead text-label-2">
              of <Money value={goal.targetAmount} currency={goal.currency} /> · {fmtP(goal.percent)}
            </p>
            <div className="mt-3">
              <Progress percent={Number(goal.percent)} label={`${goal.name}: ${fmtP(goal.percent)} saved`} />
            </div>
            <p className="mt-2 text-footnote text-label-2">
              {goal.completed ? (
                'Goal reached — well done.'
              ) : goal.monthlyNeeded ? (
                <>
                  Set aside <Money value={goal.monthlyNeeded} currency={goal.currency} className="font-medium text-label" /> a month to get there on time.
                </>
              ) : goal.deadline && goal.deadline < today ? (
                <>
                  The target date has passed — <Money value={goal.remaining} currency={goal.currency} /> to go.
                </>
              ) : (
                <>
                  <Money value={goal.remaining} currency={goal.currency} /> to go.
                </>
              )}
            </p>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-fill p-4" noValidate>
            <Segmented
              label="Movement"
              value={kind}
              onChange={(v) => setKind(v)}
              className="w-full"
              options={[
                { value: 'DEPOSIT', label: 'Add money' },
                { value: 'WITHDRAWAL', label: 'Withdraw' },
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Amount (${goal.currency})`} error={error}>
                {(p) => <Input {...p} inputMode="decimal" className="tabular" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />}
              </Field>
              <Field label="Date">{(p) => <Input {...p} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />}</Field>
            </div>
            <Button variant="primary" type="submit" loading={add.isPending}>
              {kind === 'DEPOSIT' ? <Plus className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
              {kind === 'DEPOSIT' ? 'Add to goal' : 'Withdraw'}
            </Button>
            <p className="text-footnote text-label-3">This tracks money you've set aside. Move it between accounts with a transfer if it lives in a separate account.</p>
          </form>

          <section aria-labelledby="goal-history">
            <h3 id="goal-history" className="mb-2 text-footnote font-semibold uppercase tracking-[0.04em] text-label-2">
              History
            </h3>
            {goal.contributions?.length ? (
              <ul className="divide-y divide-[var(--separator)]">
                {goal.contributions.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Money value={c.amount} currency={goal.currency} tone="signed" className="text-callout font-medium" />
                      <p className="text-footnote text-label-3">{fmtDate(c.date, locale, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-full"
                      aria-label={`Remove ${c.amount} on ${c.date}`}
                      onClick={() =>
                        del.mutate(
                          { id: goal.id, contributionId: c.id },
                          { onSuccess: () => toast.success('Removed'), onError: (e) => toast.error(errorMessage(e)) },
                        )
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-callout text-label-3">Nothing set aside yet.</p>
            )}
          </section>
        </div>
      )}
    </Sheet>
  );
}

/* ---------- page ---------- */

function GoalTile({ g, onOpen, onEdit, onArchive, onDelete }: { g: SavingsGoalDTO; onOpen(): void; onEdit(): void; onArchive(): void; onDelete(): void }) {
  const fmtP = usePct();
  const locale = useLocale();
  return (
    <li className="relative">
      <Card as="article" className={cn('flex h-full flex-col gap-4 p-5', g.archived && 'opacity-70')}>
        <div className="flex items-start gap-3">
          <CategoryIcon icon={g.icon} color={g.color} size="lg" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-headline font-semibold">
              <button type="button" onClick={onOpen} className="text-left after:absolute after:inset-0 after:rounded-[var(--radius-card)] focus-visible:outline-none">
                {g.name}
              </button>
            </h3>
            <p className="text-footnote text-label-2">
              {g.deadline ? `By ${fmtDate(g.deadline, locale, { month: 'long', year: 'numeric' })}` : 'No target date'}
            </p>
          </div>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="relative z-10 rounded-full" aria-label={`Actions for ${g.name}`}>
                <MoreHorizontal className="size-4" />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem icon={<Pencil />} onSelect={onEdit}>
                Edit
              </MenuItem>
              <MenuItem icon={g.archived ? <ArchiveRestore /> : <Archive />} onSelect={onArchive}>
                {g.archived ? 'Restore' : 'Archive'}
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<Trash2 />} destructive onSelect={onDelete}>
                Delete
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
        <div className="mt-auto">
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <Money value={g.saved} currency={g.currency} className="text-title3 font-semibold" />
            <span className="tabular text-footnote text-label-2">{fmtP(g.percent)}</span>
          </div>
          <Progress percent={Number(g.percent)} label={`${g.name}: ${fmtP(g.percent)} saved`} />
          <p className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-footnote text-label-3">
            <span>
              of <Money value={g.targetAmount} currency={g.currency} />
            </span>
            {g.completed ? (
              <Badge tone="positive">Reached</Badge>
            ) : g.monthlyNeeded ? (
              <span>
                <Money value={g.monthlyNeeded} currency={g.currency} className="text-label-2" /> / month
              </span>
            ) : null}
          </p>
        </div>
      </Card>
    </li>
  );
}

export function GoalsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const { data = [], isLoading, error, refetch } = useGoals(showArchived);
  const save = useSaveGoal();
  const del = useDeleteGoal();
  const [sheet, setSheet] = useState<{ open: boolean; goal: SavingsGoalDTO | null }>({ open: false, goal: null });
  const [detail, setDetail] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<SavingsGoalDTO | null>(null);

  const active = data.filter((g) => !g.archived);
  const reached = active.filter((g) => g.completed).length;

  function archive(g: SavingsGoalDTO) {
    save.mutate(
      { id: g.id, data: { archived: !g.archived } },
      { onSuccess: () => toast.success(g.archived ? 'Goal restored' : 'Goal archived'), onError: (e) => toast.error(errorMessage(e)) },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PlanSwitcher />
      <header className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="text-title1 font-semibold tracking-[-0.01em]">Savings goals</h1>
          <p className="text-callout text-label-2">
            {active.length === 0 ? 'Give your savings a purpose' : `${active.length} active${reached ? ` · ${reached} reached` : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setShowArchived((v) => !v)} aria-pressed={showArchived}>
            {showArchived ? 'Hide archived' : 'Show archived'}
          </Button>
          <Button variant="tinted" onClick={() => setSheet({ open: true, goal: null })}>
            <Plus className="size-4" aria-hidden /> New goal
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-44 rounded-[var(--radius-card)]" />
          <Skeleton className="h-44 rounded-[var(--radius-card)]" />
        </div>
      ) : error ? (
        <Card>
          <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        </Card>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PiggyBank />}
            title="No savings goals yet"
            message="A trip, a car, an emergency fund — name it, set a target, and track every dirham you put aside."
            action={
              <Button variant="primary" onClick={() => setSheet({ open: true, goal: null })}>
                Create a goal
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((g) => (
            <GoalTile
              key={g.id}
              g={g}
              onOpen={() => setDetail(g.id)}
              onEdit={() => setSheet({ open: true, goal: g })}
              onArchive={() => archive(g)}
              onDelete={() => setConfirm(g)}
            />
          ))}
        </ul>
      )}

      <GoalSheet open={sheet.open} goal={sheet.goal} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))} />
      <GoalDetailSheet goalId={detail} onOpenChange={(o) => !o && setDetail(null)} />
      <Confirm
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete “${confirm?.name}”?`}
        message="The goal and its history are removed. Your accounts and transactions are not affected."
        confirmLabel="Delete goal"
        loading={del.isPending}
        onConfirm={() =>
          confirm &&
          del.mutate(confirm.id, {
            onSuccess: () => {
              toast.success('Goal deleted');
              setConfirm(null);
            },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />
    </div>
  );
}
