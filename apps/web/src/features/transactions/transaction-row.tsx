import type { TransactionDTO } from '@mizan/shared';
import { ArrowLeftRight, Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Money } from '@/components/ui/primitives';
import { cn } from '@/lib/format';

export function signedAmount(t: TransactionDTO, perspectiveAccountId?: string): string {
  if (t.type === 'INCOME') return t.amount;
  if (t.type === 'EXPENSE') return `-${t.amount}`;
  // Transfers: neutral unless viewed from one of the two accounts.
  if (perspectiveAccountId === t.toAccountId) return t.toAmount ?? t.amount;
  if (perspectiveAccountId === t.accountId) return `-${t.amount}`;
  return t.amount;
}

export function TransactionRow({
  t,
  onEdit,
  onDuplicate,
  onDelete,
  perspectiveAccountId,
  trailing,
}: {
  t: TransactionDTO;
  onEdit?(): void;
  onDuplicate?(): void;
  onDelete?(): void;
  perspectiveAccountId?: string;
  trailing?: ReactNode;
}) {
  const isTransfer = t.type === 'TRANSFER';
  const subtitle = isTransfer ? `${t.account.name} → ${t.toAccount?.name ?? ''}` : [t.category?.name ?? 'Uncategorised', t.account.name].join(' · ');
  const value = signedAmount(t, perspectiveAccountId);
  const currency = isTransfer && perspectiveAccountId === t.toAccountId && t.toCurrency ? t.toCurrency : t.currency;
  const hasActions = onEdit || onDuplicate || onDelete;

  return (
    <div className="group flex min-h-[60px] items-center gap-3 px-5 py-2.5">
      {isTransfer ? (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-fill text-label-2" aria-hidden>
          <ArrowLeftRight className="size-[18px]" />
        </span>
      ) : (
        <CategoryIcon icon={t.category?.icon ?? 'dots'} color={t.category?.color ?? '#8E8E93'} />
      )}
      <button type="button" onClick={onEdit} disabled={!onEdit} className="min-w-0 flex-1 text-left disabled:cursor-default">
        <p className="truncate text-body font-medium">{t.description}</p>
        <p className="truncate text-subhead text-label-2">{subtitle}</p>
      </button>
      {trailing}
      <Money
        value={value}
        currency={currency}
        tone={isTransfer && !perspectiveAccountId ? 'neutral' : 'signed'}
        className={cn('text-body font-medium', isTransfer && !perspectiveAccountId && 'text-label-2')}
      />
      {hasActions && (
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="rounded-full opacity-100 lg:opacity-0 lg:focus-visible:opacity-100 lg:group-hover:opacity-100 data-[state=open]:opacity-100" aria-label={`Actions for ${t.description}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </MenuTrigger>
          <MenuContent>
            {onEdit && (
              <MenuItem icon={<Pencil />} onSelect={onEdit}>
                Edit
              </MenuItem>
            )}
            {onDuplicate && (
              <MenuItem icon={<Copy />} onSelect={onDuplicate}>
                Duplicate to today
              </MenuItem>
            )}
            {onDelete && (
              <>
                <MenuSeparator />
                <MenuItem icon={<Trash2 />} onSelect={onDelete} destructive>
                  Delete
                </MenuItem>
              </>
            )}
          </MenuContent>
        </Menu>
      )}
    </div>
  );
}
