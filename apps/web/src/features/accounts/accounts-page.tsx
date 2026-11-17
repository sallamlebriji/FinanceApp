import { ACCOUNT_TYPE_LABELS, totalsByCurrency, type AccountDTO } from '@mizan/shared';
import { Archive, ArchiveRestore, ChevronRight, MoreHorizontal, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Confirm } from '@/components/ui/confirm';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Badge, Card, EmptyState, ErrorState, Money, Skeleton } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';
import { ApiError, errorMessage } from '@/lib/api';
import { useAccounts, useDeleteAccount, useSaveAccount } from './api';
import { AccountSheet } from './account-sheet';

function AccountRow({ a, onEdit, onArchive, onDelete }: { a: AccountDTO; onEdit(): void; onArchive(): void; onDelete(): void }) {
  return (
    <div className="group flex min-h-16 items-center gap-3 px-5 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: a.color }} aria-hidden>
        <Wallet className="size-5" />
      </span>
      <Link to={`/accounts/${a.id}`} className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-body font-medium">
          {a.name}
          {!a.includeInNetWorth && <Badge>Not in net worth</Badge>}
        </p>
        <p className="truncate text-subhead text-label-2">
          {ACCOUNT_TYPE_LABELS[a.type]}
          {a.institution ? ` · ${a.institution}` : ''}
        </p>
      </Link>
      <Money value={a.balance} currency={a.currency} className="text-body font-semibold" />
      <Menu>
        <MenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={`Actions for ${a.name}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem icon={<Pencil />} onSelect={onEdit}>
            Edit
          </MenuItem>
          <MenuItem icon={a.isArchived ? <ArchiveRestore /> : <Archive />} onSelect={onArchive}>
            {a.isArchived ? 'Restore' : 'Archive'}
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Trash2 />} destructive onSelect={onDelete}>
            Delete
          </MenuItem>
        </MenuContent>
      </Menu>
      <ChevronRight className="hidden size-4 text-label-3 sm:block" aria-hidden />
    </div>
  );
}

export function AccountsPage() {
  const [params, setParams] = useSearchParams();
  const { data = [], isLoading, error, refetch } = useAccounts(true);
  const save = useSaveAccount();
  const del = useDeleteAccount();
  const [sheet, setSheet] = useState<{ open: boolean; account: AccountDTO | null }>({ open: false, account: null });
  const [confirm, setConfirm] = useState<AccountDTO | null>(null);

  useEffect(() => {
    if (params.get('new')) {
      setSheet({ open: true, account: null });
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const active = data.filter((a) => !a.isArchived);
  const archived = data.filter((a) => a.isArchived);
  const totals = useMemo(() => [...totalsByCurrency(active.map((a) => ({ currency: a.currency, amount: a.balance }))).entries()], [active]);

  const toggleArchive = (a: AccountDTO) =>
    save.mutate(
      { id: a.id, data: { isArchived: !a.isArchived } },
      { onSuccess: () => toast.success(a.isArchived ? 'Account restored' : 'Account archived'), onError: (e) => toast.error(errorMessage(e)) },
    );

  async function onDelete() {
    if (!confirm) return;
    try {
      await del.mutateAsync(confirm.id);
      toast.success('Account deleted');
      setConfirm(null);
    } catch (e) {
      setConfirm(null);
      toast.error(e instanceof ApiError && e.status === 409 ? e.message : errorMessage(e));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="text-title1 font-semibold tracking-[-0.01em]">Accounts</h1>
          <p className="text-callout text-label-2">
            {totals.length === 0 ? 'Where your money lives' : totals.map(([c, v], i) => (
              <span key={c}>
                {i > 0 && ' · '}
                <Money value={v.toFixed(2)} currency={c} className="font-medium text-label" />
              </span>
            ))}
          </p>
        </div>
        <Button variant="tinted" onClick={() => setSheet({ open: true, account: null })}>
          <Plus className="size-4" aria-hidden /> Add account
        </Button>
      </header>

      {isLoading ? (
        <Card className="flex flex-col gap-3 p-5">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </Card>
      ) : error ? (
        <Card>
          <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        </Card>
      ) : active.length === 0 && archived.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wallet />}
            title="No accounts yet"
            message="Add your bank accounts, cash and savings. Each one keeps its own currency and balance."
            action={
              <Button variant="primary" onClick={() => setSheet({ open: true, account: null })}>
                Add your first account
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-[var(--separator)]">
              {active.map((a) => (
                <li key={a.id}>
                  <AccountRow a={a} onEdit={() => setSheet({ open: true, account: a })} onArchive={() => toggleArchive(a)} onDelete={() => setConfirm(a)} />
                </li>
              ))}
            </ul>
          </Card>
          {archived.length > 0 && (
            <section aria-labelledby="archived-h">
              <h2 id="archived-h" className="mb-2 px-1 text-footnote font-semibold uppercase tracking-[0.04em] text-label-2">
                Archived
              </h2>
              <Card className="overflow-hidden opacity-80">
                <ul className="divide-y divide-[var(--separator)]">
                  {archived.map((a) => (
                    <li key={a.id}>
                      <AccountRow a={a} onEdit={() => setSheet({ open: true, account: a })} onArchive={() => toggleArchive(a)} onDelete={() => setConfirm(a)} />
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}
        </>
      )}

      <AccountSheet open={sheet.open} account={sheet.account} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))} />
      <Confirm
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete “${confirm?.name}”?`}
        message={
          confirm?.transactionCount
            ? `This account has ${confirm.transactionCount} transactions, so it can't be deleted. Archive it to hide it while keeping your history.`
            : 'This account has no transactions. Deleting it cannot be undone.'
        }
        confirmLabel={confirm?.transactionCount ? 'Archive instead' : 'Delete'}
        destructive={!confirm?.transactionCount}
        onConfirm={() => {
          if (confirm?.transactionCount) {
            toggleArchive(confirm);
            setConfirm(null);
          } else void onDelete();
        }}
        loading={del.isPending}
      />
    </div>
  );
}
