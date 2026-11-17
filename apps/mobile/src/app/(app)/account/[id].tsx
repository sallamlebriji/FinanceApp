import { ACCOUNT_TYPE_LABELS } from '@mizan/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pencil, Plus } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { CategoryIcon } from '@/components/category-icon';
import { Button, Card, ErrorState, Loading, MoneyText, Row, SectionHeader, Separator, Txt } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAccountHistory, useAccounts } from '@/lib/data';
import { fmtDate, fmtMoney, useLocale } from '@/lib/format';
import { space, useColors } from '@/theme';

export default function AccountDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const locale = useLocale();
  const accounts = useAccounts(true);
  const history = useAccountHistory(id);
  const account = accounts.data?.find((a) => a.id === id);

  if (accounts.isPending) return <Loading />;
  if (accounts.isError) return <ErrorState message={errorMessage(accounts.error)} onRetry={() => accounts.refetch()} />;
  if (!account) {
    return (
      <View style={{ padding: space.lg }}>
        <Txt>This account no longer exists.</Txt>
      </View>
    );
  }

  const entries = history.data?.entries ?? [];

  return (
    <>
      <Stack.Screen options={{ title: account.name }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: c.bg }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 48, maxWidth: 720, width: '100%', alignSelf: 'center' }}
      >
        <Card style={{ gap: space.xs }}>
          <Txt variant="subhead" tone="label2">
            {[ACCOUNT_TYPE_LABELS[account.type], account.institution, account.isArchived ? 'Archived' : null].filter(Boolean).join(' · ')}
          </Txt>
          <MoneyText variant="title1" value={account.balance} currency={account.currency} />
          <Txt variant="footnote" tone="label3">
            Opening balance {fmtMoney(account.openingBalance, account.currency, locale)} · {account.transactionCount} transactions
          </Txt>
        </Card>

        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button
            title="Add"
            icon={Plus}
            style={{ flex: 1 }}
            accessibilityHint="Adds a transaction to this account"
            onPress={() => router.push({ pathname: '/transaction', params: { accountId: account.id } })}
          />
          <Button
            title="Edit"
            icon={Pencil}
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/account-form', params: { id: account.id } })}
          />
        </View>

        <SectionHeader title="History" />
        {history.isPending ? (
          <Loading />
        ) : history.isError ? (
          <ErrorState message={errorMessage(history.error)} onRetry={() => history.refetch()} />
        ) : entries.length === 0 ? (
          <Txt tone="label2">No transactions in this account yet.</Txt>
        ) : (
          <Card padded={false}>
            {entries.slice(0, 50).map((e, i) => {
              const change = fmtMoney(e.change, account.currency, locale, { signDisplay: 'exceptZero' });
              const after = fmtMoney(e.balanceAfter, account.currency, locale);
              return (
                <View key={e.id}>
                  {i > 0 ? <Separator inset={space.lg + 36 + space.md} /> : null}
                  <Row
                    onPress={() => router.push({ pathname: '/transaction', params: { id: e.id } })}
                    accessibilityLabel={`${e.description}, ${fmtDate(e.date, locale, { day: 'numeric', month: 'long' })}, ${change}, balance after ${after}`}
                    leading={
                      <CategoryIcon
                        icon={e.type === 'TRANSFER' ? 'transfer' : (e.category?.icon ?? 'dots')}
                        color={e.type === 'TRANSFER' ? '#6B6B75' : (e.category?.color ?? '#7D8590')}
                      />
                    }
                    title={e.description}
                    subtitle={fmtDate(e.date, locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                    trailing={
                      <View style={{ alignItems: 'flex-end' }}>
                        <Txt numeric weight="500" tone={e.change.startsWith('-') ? 'label' : 'positive'}>
                          {change}
                        </Txt>
                        <Txt variant="caption" tone="label3" numeric>
                          {after}
                        </Txt>
                      </View>
                    }
                  />
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </>
  );
}
