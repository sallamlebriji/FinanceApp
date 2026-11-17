import { money, type PeriodPreset } from '@mizan/shared';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { BalanceBeam } from '@/components/balance-beam';
import { CashFlowChart } from '@/components/cash-flow-chart';
import { CategoryIcon } from '@/components/category-icon';
import { TransactionRow } from '@/components/transaction-row';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  Loading,
  MoneyText,
  Progress,
  Screen,
  SectionHeader,
  Segmented,
  Separator,
  Txt,
} from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useDashboard } from '@/lib/data';
import { fmtMoney, fmtPct, pctChange, useLocale } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import { space } from '@/theme';

const PERIODS: { value: PeriodPreset; label: string }[] = [
  { value: 'this-month', label: 'Month' },
  { value: 'last-3-months', label: '3 Months' },
  { value: 'this-year', label: 'Year' },
];

const newTransaction = () => router.push('/transaction');

export default function Home() {
  const [preset, setPreset] = useState<PeriodPreset>('this-month');
  const q = useDashboard(preset);
  const name = useAuth((s) => s.user?.name.split(' ')[0]);
  const { width } = useWindowDimensions();
  const locale = useLocale();
  const d = q.data;
  const contentWidth = Math.min(width, 720) - space.lg * 2 - space.lg * 2;

  return (
    <Screen
      title="Home"
      onRefresh={() => q.refetch()}
      refreshing={q.isRefetching}
      actions={<IconButton icon={Plus} label="New Transaction" onPress={newTransaction} prominent />}
      contentStyle={{ maxWidth: 720, width: '100%', alignSelf: 'center' }}
    >
      <Segmented label="Period" value={preset} options={PERIODS} onChange={setPreset} />

      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : d && !d.hasData ? (
        <EmptyState
          title={`Welcome${name ? `, ${name}` : ''}`}
          message="Add your first transaction and Mizan will start weighing what comes in against what goes out."
          action={<Button title="Add Transaction" icon={Plus} onPress={newTransaction} />}
        />
      ) : d ? (
        <>
          <Card style={{ gap: space.xs }}>
            <Txt variant="subhead" tone="label2">
              Net worth
            </Txt>
            <MoneyText variant="title1" value={d.netWorth.amount} currency={d.netWorth.currency} />
            {d.netWorth.unconverted.length > 0 ? (
              <Txt variant="footnote" tone="warning">
                Excludes {d.netWorth.unconverted.join(', ')} — add an exchange rate in Settings on the web to include it.
              </Txt>
            ) : null}
          </Card>

          <Card style={{ gap: space.lg }}>
            <BalanceBeam income={d.current.income} expense={d.current.expense} currency={d.baseCurrency} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md }}>
              <Figure label="Income" value={d.current.income} previous={d.previous.income} currency={d.baseCurrency} goodWhenUp />
              <Figure label="Spending" value={d.current.expense} previous={d.previous.expense} currency={d.baseCurrency} />
              <View style={{ width: '50%', minWidth: 140, gap: 2 }}>
                <Txt variant="footnote" tone="label2">
                  Saved
                </Txt>
                <Txt variant="title3" numeric>
                  {d.current.savingsRate === null ? '—' : fmtPct(d.current.savingsRate, locale)}
                </Txt>
                <Txt variant="caption" tone="label3">
                  {d.current.savingsRate === null ? 'No income this period' : 'of income'}
                </Txt>
              </View>
            </View>
          </Card>

          {d.cashFlow.length > 1 ? (
            <>
              <SectionHeader title="Cash Flow" />
              <Card>
                <CashFlowChart data={d.cashFlow} currency={d.baseCurrency} width={contentWidth} />
              </Card>
            </>
          ) : null}

          {d.spendingByCategory.length > 0 ? (
            <>
              <SectionHeader title="Spending by Category" />
              <Card style={{ gap: space.lg }}>
                {d.spendingByCategory.slice(0, 5).map((s) => (
                  <View key={s.categoryId ?? 'none'} style={{ gap: space.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                      <CategoryIcon icon={s.icon} color={s.color} size={28} />
                      <Txt style={{ flex: 1 }} numberOfLines={1}>
                        {s.name}
                      </Txt>
                      <MoneyText value={s.amount} currency={d.baseCurrency} weight="500" />
                    </View>
                    <Progress value={Number(s.percent)} label={`${s.name}: ${fmtPct(s.percent, locale)} of spending`} />
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          {d.budgets.length > 0 ? (
            <>
              <SectionHeader
                title="Budgets"
                action={<Button title="See All" variant="plain" onPress={() => router.navigate('/budgets')} style={{ minHeight: 44 }} />}
              />
              <Card style={{ gap: space.lg }}>
                {d.budgets.slice(0, 3).map((b) => {
                  const pct = Number(b.current.percent);
                  const tone = b.current.state === 'over' || b.current.state === 'critical' ? 'negative' : b.current.state === 'warning' ? 'warning' : 'accent';
                  return (
                    <View key={b.id} style={{ gap: space.sm }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
                        <Txt style={{ flex: 1 }} numberOfLines={1}>
                          {b.name}
                        </Txt>
                        <Txt variant="subhead" tone={tone === 'accent' ? 'label2' : tone} numeric>
                          {fmtPct(b.current.percent, locale)}
                        </Txt>
                      </View>
                      <Progress value={pct} tone={tone} label={`${b.name}: ${fmtPct(b.current.percent, locale)} used`} />
                      <Txt variant="footnote" tone="label3" numeric>
                        {money(b.current.remaining).isNeg()
                          ? `${fmtMoney(money(b.current.remaining).abs().toFixed(2), b.currency, locale)} over`
                          : `${fmtMoney(b.current.remaining, b.currency, locale)} left of ${fmtMoney(b.amount, b.currency, locale)}`}
                      </Txt>
                    </View>
                  );
                })}
              </Card>
            </>
          ) : null}

          {d.recentTransactions.length > 0 ? (
            <>
              <SectionHeader
                title="Recent Activity"
                action={<Button title="See All" variant="plain" onPress={() => router.navigate('/activity')} style={{ minHeight: 44 }} />}
              />
              <Card padded={false}>
                {d.recentTransactions.slice(0, 5).map((t, i) => (
                  <View key={t.id}>
                    {i > 0 ? <Separator inset={space.lg + 36 + space.md} /> : null}
                    <TransactionRow tx={t} />
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function Figure({
  label,
  value,
  previous,
  currency,
  goodWhenUp,
}: {
  label: string;
  value: string;
  previous: string;
  currency: Parameters<typeof MoneyText>[0]['currency'];
  goodWhenUp?: boolean;
}) {
  const locale = useLocale();
  const change = pctChange(value, previous);
  const up = change !== null && change > 0;
  const good = change === null || change === 0 ? null : goodWhenUp ? up : !up;
  return (
    <View style={{ width: '50%', minWidth: 140, gap: 2, paddingRight: space.sm }}>
      <Txt variant="footnote" tone="label2">
        {label}
      </Txt>
      <MoneyText variant="title3" value={value} currency={currency} numberOfLines={1} adjustsFontSizeToFit />
      <Txt variant="caption" tone={good === null ? 'label3' : good ? 'positive' : 'negative'} numeric>
        {change === null ? 'No previous data' : `${up ? '↑' : change < 0 ? '↓' : ''} ${fmtPct(Math.abs(change), locale)} vs previous`}
      </Txt>
    </View>
  );
}
