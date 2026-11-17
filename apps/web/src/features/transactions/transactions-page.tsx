import { todayInTimeZone, type TransactionCreateInput, type TransactionDTO, type TransactionQuery } from '@mizan/shared';
import { ChevronLeft, ChevronRight, Download, Plus, Receipt, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Confirm } from '@/components/ui/confirm';
import { Field, Input, Select } from '@/components/ui/field';
import { Card, EmptyState, ErrorState, Segmented, Skeleton } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';
import { useAccounts } from '@/features/accounts/api';
import { api, download, errorMessage } from '@/lib/api';
import { cn, dayLabel, useLocale } from '@/lib/format';
import { invalidateFinance } from '@/lib/query';
import { useAuth } from '@/stores/auth';
import { useComposer } from '@/stores/composer';
import { toQueryString, useCategories, useDeleteTransaction, useDuplicateTransaction, useTransactions } from './api';
import { TransactionRow } from './transaction-row';

type TypeFilter = 'ALL' | 'EXPENSE' | 'INCOME' | 'TRANSFER';
const PAGE_SIZE = 50;

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Re-creates a deleted transaction (Undo). */
function recreate(t: TransactionDTO) {
  const base = { amount: t.amount, date: t.date, accountId: t.accountId, description: t.description, note: t.note, paymentMethod: t.paymentMethod };
  const data: TransactionCreateInput =
    t.type === 'TRANSFER'
      ? { ...base, type: 'TRANSFER', toAccountId: t.toAccountId!, toAmount: t.toAmount }
      : { ...base, type: t.type, categoryId: t.categoryId };
  return api('/transactions', { method: 'POST', json: data }).then(invalidateFinance);
}

export function TransactionsPage() {
  const [params, setParams] = useSearchParams();
  const locale = useLocale();
  const timezone = useAuth((s) => s.settings?.timezone);
  const today = todayInTimeZone(timezone);
  const show = useComposer((s) => s.show);
  const { data: accounts = [] } = useAccounts(true);
  const { data: categories = [] } = useCategories();

  const [search, setSearch] = useState(params.get('q') ?? '');
  const debounced = useDebounced(search);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const type = (params.get('type') as TypeFilter) || 'ALL';
  const page = Number(params.get('page') ?? 1);

  // Keep the top-bar search and this field in sync.
  useEffect(() => setSearch(params.get('q') ?? ''), [params]);

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if ((params.get('q') ?? '') !== debounced) update({ q: debounced || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const query: TransactionQuery = {
    page,
    pageSize: PAGE_SIZE,
    q: params.get('q') || undefined,
    type: type === 'ALL' ? undefined : type,
    accountId: params.get('accountId') || undefined,
    categoryId: params.get('categoryId') || undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
    sort: (params.get('sort') as TransactionQuery['sort']) || 'date',
    order: (params.get('order') as TransactionQuery['order']) || 'desc',
  };
  const { data, isLoading, error, refetch, isFetching } = useTransactions(query);
  const del = useDeleteTransaction();
  const dup = useDuplicateTransaction();
  const [confirming, setConfirming] = useState<TransactionDTO | null>(null);

  const activeFilters = ['accountId', 'categoryId', 'from', 'to'].filter((k) => params.get(k)).length;
  const groupByDay = query.sort === 'date';
  const groups = useMemo(() => {
    const out: { day: string; items: TransactionDTO[] }[] = [];
    for (const t of data?.items ?? []) {
      const last = out.at(-1);
      if (groupByDay && last?.day === t.date) last.items.push(t);
      else out.push({ day: groupByDay ? t.date : '', items: [t] });
    }
    return groupByDay ? out : [{ day: '', items: data?.items ?? [] }];
  }, [data, groupByDay]);

  async function onDelete() {
    if (!confirming) return;
    const t = confirming;
    try {
      await del.mutateAsync(t.id);
      setConfirming(null);
      toast.success('Transaction deleted', { label: 'Undo', run: () => void recreate(t).catch((e) => toast.error(errorMessage(e))) });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function onExport() {
    try {
      const { page: _p, pageSize: _s, ...rest } = query;
      await download(`/transactions/export.csv?${toQueryString(rest)}`, 'mizan-transactions.csv');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const sortValue = `${query.sort}:${query.order}`;
  const categoryOptions = categories.filter((c) => !query.type || query.type === 'TRANSFER' || c.type === query.type);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="text-title1 font-semibold tracking-[-0.01em]">Transactions</h1>
          <p className="text-callout text-label-2">{data ? `${data.total.toLocaleString(locale)} ${data.total === 1 ? 'transaction' : 'transactions'}` : ' '}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onExport} disabled={!data?.total}>
            <Download className="size-4" aria-hidden /> Export CSV
          </Button>
          <Button variant="tinted" onClick={() => show()} className="lg:hidden">
            <Plus className="size-4" aria-hidden /> Add
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <label htmlFor="tx-search" className="sr-only">
              Search by description or note
            </label>
            <Input id="tx-search" type="search" autoFocus={params.get('search') === '1'} placeholder="Search by description or note" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Segmented
            label="Type"
            value={type}
            onChange={(v) => update({ type: v === 'ALL' ? undefined : v })}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'EXPENSE', label: 'Spending' },
              { value: 'INCOME', label: 'Income' },
              { value: 'TRANSFER', label: 'Transfers' },
            ]}
          />
          <Button variant={activeFilters ? 'tinted' : 'secondary'} onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}>
            <SlidersHorizontal className="size-4" aria-hidden />
            Filters{activeFilters ? ` · ${activeFilters}` : ''}
          </Button>
          <label htmlFor="tx-sort" className="sr-only">
            Sort
          </label>
          <Select
            id="tx-sort"
            value={sortValue}
            className="w-44"
            onChange={(e) => {
              const [sort, order] = e.target.value.split(':');
              update({ sort, order });
            }}
          >
            <option value="date:desc">Newest first</option>
            <option value="date:asc">Oldest first</option>
            <option value="amount:desc">Largest amount</option>
            <option value="amount:asc">Smallest amount</option>
            <option value="description:asc">Description A–Z</option>
          </Select>
        </div>

        {filtersOpen && (
          <Card className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Account">
              {(p) => (
                <Select {...p} value={params.get('accountId') ?? ''} onChange={(e) => update({ accountId: e.target.value || undefined })}>
                  <option value="">All accounts</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.isArchived ? ' (archived)' : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Category">
              {(p) => (
                <Select {...p} value={params.get('categoryId') ?? ''} onChange={(e) => update({ categoryId: e.target.value || undefined })}>
                  <option value="">All categories</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.parentId ? '— ' : ''}
                      {c.name} ({c.type === 'INCOME' ? 'income' : 'expense'})
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="From">{(p) => <Input {...p} type="date" value={params.get('from') ?? ''} onChange={(e) => update({ from: e.target.value || undefined })} />}</Field>
            <Field label="To">{(p) => <Input {...p} type="date" value={params.get('to') ?? ''} onChange={(e) => update({ to: e.target.value || undefined })} />}</Field>
            {activeFilters > 0 && (
              <div className="sm:col-span-2 lg:col-span-4">
                <Button variant="plain" size="sm" onClick={() => update({ accountId: undefined, categoryId: undefined, from: undefined, to: undefined })}>
                  <X className="size-4" aria-hidden /> Clear filters
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>

      <Card className={cn('overflow-clip transition-opacity duration-[var(--dur)]', isFetching && !isLoading && 'opacity-75')}>
        {isLoading ? (
          <div className="flex flex-col gap-3 p-5" aria-busy="true" aria-label="Loading transactions">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        ) : !data?.items.length ? (
          <EmptyState
            icon={<Receipt />}
            title={query.q || activeFilters || query.type ? 'No matching transactions' : 'No transactions yet'}
            message={query.q || activeFilters || query.type ? 'Try a different search or clear your filters.' : 'Record your income, spending and transfers to see where your money goes.'}
            action={
              !(query.q || activeFilters || query.type) && (
                <Button variant="primary" onClick={() => show()}>
                  Add a transaction
                </Button>
              )
            }
          />
        ) : (
          groups.map((g, gi) => (
            <section key={`${g.day}-${gi}`} aria-label={g.day ? dayLabel(g.day, today, locale) : 'Transactions'}>
              {g.day && <h2 className="sticky top-16 z-10 bg-surface-2 px-5 py-1.5 text-footnote font-semibold uppercase tracking-[0.04em] text-label-2">{dayLabel(g.day, today, locale)}</h2>}
              <ul className="divide-y divide-[var(--separator)]">
                {g.items.map((t) => (
                  <li key={t.id}>
                    <TransactionRow
                      t={t}
                      perspectiveAccountId={query.accountId}
                      onEdit={() => show({ editing: t })}
                      onDuplicate={() =>
                        dup.mutate(t.id, { onSuccess: () => toast.success('Duplicated to today'), onError: (e) => toast.error(errorMessage(e)) })
                      }
                      onDelete={() => setConfirming(t)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </Card>

      {data && data.totalPages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          <Button size="sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
            <ChevronLeft className="size-4" aria-hidden /> Previous
          </Button>
          <span className="text-subhead text-label-2">
            Page {data.page} of {data.totalPages}
          </span>
          <Button size="sm" disabled={page >= data.totalPages} onClick={() => update({ page: String(page + 1) })}>
            Next <ChevronRight className="size-4" aria-hidden />
          </Button>
        </nav>
      )}

      <Confirm
        open={!!confirming}
        onOpenChange={(o) => !o && setConfirming(null)}
        title="Delete this transaction?"
        message={confirming ? `“${confirming.description}” will be removed and your balances recalculated.` : ''}
        confirmLabel="Delete"
        onConfirm={onDelete}
        loading={del.isPending}
      />
    </div>
  );
}
