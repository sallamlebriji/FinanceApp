import { ACCOUNT_TYPE_LABELS, totalsByCurrency, type AccountDTO } from '@mizan/shared';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, EmptyState, ErrorState, IconButton, Loading, MoneyText, Row, Screen, Separator, Txt } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAccounts } from '@/lib/data';
import { fmtMoney, useLocale } from '@/lib/format';
import { space } from '@/theme';

export default function Accounts() {
  const [showArchived, setShowArchived] = useState(false);
  const q = useAccounts(showArchived);
  const locale = useLocale();
  const accounts = q.data ?? [];
  const active = accounts.filter((a) => !a.isArchived);
  const archived = accounts.filter((a) => a.isArchived);
  const totals = [...totalsByCurrency(active.filter((a) => a.includeInNetWorth).map((a) => ({ currency: a.currency, amount: a.balance })))];

  return (
    <Screen
      title="Accounts"
      onRefresh={() => q.refetch()}
      refreshing={q.isRefetching}
      actions={<IconButton icon={Plus} label="New Account" onPress={() => router.push('/account-form')} prominent />}
      contentStyle={{ maxWidth: 720, width: '100%', alignSelf: 'center' }}
    >
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : active.length === 0 && archived.length === 0 ? (
        <EmptyState
          title="Add your first account"
          message="A bank account, cash wallet or savings pot. Balances come from the transactions you record."
          action={<Button title="Add Account" icon={Plus} onPress={() => router.push('/account-form')} />}
        />
      ) : (
        <>
          {totals.length > 0 ? (
            <Card style={{ gap: space.xs }}>
              <Txt variant="subhead" tone="label2">
                {totals.length > 1 ? 'Total by currency' : 'Total'}
              </Txt>
              {totals.map(([cur, amt]) => (
                <MoneyText key={cur} variant="title2" value={amt.toFixed(2)} currency={cur} />
              ))}
            </Card>
          ) : null}

          <AccountList items={active} locale={locale} />

          {archived.length > 0 ? (
            <>
              <Txt variant="footnote" tone="label2" weight="600" accessibilityRole="header">
                Archived
              </Txt>
              <AccountList items={archived} locale={locale} />
            </>
          ) : null}

          <Button
            title={showArchived ? 'Hide Archived Accounts' : 'Show Archived Accounts'}
            variant="plain"
            onPress={() => setShowArchived((v) => !v)}
          />
        </>
      )}
    </Screen>
  );
}

function AccountList({ items, locale }: { items: AccountDTO[]; locale: string }) {
  if (items.length === 0) return null;
  return (
    <Card padded={false}>
      {items.map((a, i) => {
        const balance = fmtMoney(a.balance, a.currency, locale);
        const kind = [ACCOUNT_TYPE_LABELS[a.type], a.institution].filter(Boolean).join(' · ');
        return (
          <View key={a.id}>
            {i > 0 ? <Separator inset={space.lg + 12 + space.md} /> : null}
            <Row
              onPress={() => router.push({ pathname: '/account/[id]', params: { id: a.id } })}
              accessibilityLabel={`${a.name}, ${kind}, balance ${balance}`}
              leading={<View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: a.color }} />}
              title={a.name}
              subtitle={kind}
              trailing={
                <Txt numeric weight="500" tone={a.balance.startsWith('-') ? 'negative' : 'label'}>
                  {balance}
                </Txt>
              }
              chevron
            />
          </View>
        );
      })}
    </Card>
  );
}
