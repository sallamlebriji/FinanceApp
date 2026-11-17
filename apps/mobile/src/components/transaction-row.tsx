import { money, type TransactionDTO } from '@mizan/shared';
import { router } from 'expo-router';
import { fmtMoney, useLocale } from '@/lib/format';
import { CategoryIcon } from './category-icon';
import { Row, Txt } from './ui';

/**
 * One ledger line. Income carries "+", spending "−", transfers neither (they move money between
 * your own accounts and are never income or spending) — so meaning never relies on colour.
 */
export function TransactionRow({ tx, accountId }: { tx: TransactionDTO; accountId?: string }) {
  const locale = useLocale();
  const isTransfer = tx.type === 'TRANSFER';
  const incoming = isTransfer && accountId === tx.toAccountId;
  const shown = incoming && tx.toAmount ? tx.toAmount : tx.amount;
  const currency = incoming && tx.toCurrency ? tx.toCurrency : tx.currency;
  const signed = tx.type === 'INCOME' || incoming ? shown : tx.type === 'EXPENSE' ? money(shown).neg().toFixed(2) : shown;
  const amount = fmtMoney(signed, currency, locale, { signDisplay: isTransfer && !accountId ? 'never' : 'exceptZero' });

  const subtitle = isTransfer
    ? `${tx.account.name} → ${tx.toAccount?.name ?? ''}`
    : [tx.category?.name ?? 'Uncategorised', tx.account.name].join(' · ');

  const kind = tx.type === 'INCOME' ? 'Income' : tx.type === 'EXPENSE' ? 'Expense' : 'Transfer';

  return (
    <Row
      onPress={() => router.push({ pathname: '/transaction', params: { id: tx.id } })}
      accessibilityLabel={`${tx.description}, ${kind}, ${amount}, ${subtitle}`}
      accessibilityHint="Opens the transaction to edit it"
      leading={
        <CategoryIcon
          icon={isTransfer ? 'transfer' : (tx.category?.icon ?? 'dots')}
          color={isTransfer ? '#6B6B75' : (tx.category?.color ?? '#7D8590')}
        />
      }
      title={tx.description}
      subtitle={subtitle}
      trailing={
        <Txt numeric weight="500" tone={tx.type === 'INCOME' || incoming ? 'positive' : 'label'}>
          {amount}
        </Txt>
      }
    />
  );
}
