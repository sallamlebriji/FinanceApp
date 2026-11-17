import { money } from '@mizan/shared';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { CategoryIcon } from '@/components/category-icon';
import { Badge, Button, Card, EmptyState, ErrorState, IconButton, Loading, Progress, Screen, Txt } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useBudgets } from '@/lib/data';
import { fmtDate, fmtMoney, fmtPct, useLocale } from '@/lib/format';
import { space, useColors } from '@/theme';

const STATE = {
  ok: { tone: 'accent', badge: null },
  warning: { tone: 'warning', badge: { label: 'Close to limit', tone: 'warning' } },
  critical: { tone: 'negative', badge: { label: 'Almost spent', tone: 'negative' } },
  over: { tone: 'negative', badge: { label: 'Over budget', tone: 'negative' } },
} as const;

export default function Budgets() {
  const q = useBudgets();
  const c = useColors();
  const locale = useLocale();
  const budgets = q.data ?? [];
  const attention = budgets.filter((b) => b.current.state !== 'ok').length;

  return (
    <Screen
      title="Budgets"
      onRefresh={() => q.refetch()}
      refreshing={q.isRefetching}
      actions={<IconButton icon={Plus} label="New Budget" onPress={() => router.push('/budget-form')} prominent />}
      contentStyle={{ maxWidth: 720, width: '100%', alignSelf: 'center' }}
    >
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : budgets.length === 0 ? (
        <EmptyState
          title="Set a spending limit"
          message="Choose a category — or all spending — and an amount per month or week. Mizan warns you at 50, 75, 90 and 100 %."
          action={<Button title="Create Budget" icon={Plus} onPress={() => router.push('/budget-form')} />}
        />
      ) : (
        <>
          <Txt tone="label2">
            {attention === 0
              ? 'Every budget is on track.'
              : `${attention} of ${budgets.length} budget${budgets.length > 1 ? 's' : ''} ${attention > 1 ? 'need' : 'needs'} attention.`}
          </Txt>
          {budgets.map((b) => {
            const s = STATE[b.current.state];
            const remaining = money(b.current.remaining);
            const status = remaining.isNeg()
              ? `${fmtMoney(remaining.abs().toFixed(2), b.currency, locale)} over`
              : `${fmtMoney(b.current.remaining, b.currency, locale)} left`;
            const period = `${fmtDate(b.current.range.from, locale)} – ${fmtDate(b.current.range.to, locale)}`;
            return (
              <Pressable
                key={b.id}
                onPress={() => router.push({ pathname: '/budget-form', params: { id: b.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${b.name}, ${fmtPct(b.current.percent, locale)} used, ${status}, ${period}${s.badge ? `, ${s.badge.label}` : ''}`}
                accessibilityHint="Opens the budget to edit it"
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              >
                <Card style={{ gap: space.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <CategoryIcon icon={b.category?.icon ?? 'bag'} color={b.category?.color ?? c.accent} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt variant="headline" numberOfLines={1}>
                        {b.name}
                      </Txt>
                      <Txt variant="footnote" tone="label3">
                        {b.period === 'MONTHLY' ? 'Monthly' : 'Weekly'} · {b.category?.name ?? 'All spending'}
                      </Txt>
                    </View>
                    {s.badge ? <Badge label={s.badge.label} tone={s.badge.tone} /> : null}
                  </View>
                  <Progress value={Number(b.current.percent)} tone={s.tone} label={`${b.name} used`} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap' }}>
                    <Txt variant="subhead" numeric>
                      {fmtMoney(b.current.spent, b.currency, locale)} of {fmtMoney(b.amount, b.currency, locale)}
                    </Txt>
                    <Txt variant="subhead" tone={remaining.isNeg() ? 'negative' : 'label2'} numeric>
                      {status}
                    </Txt>
                  </View>
                  <Txt variant="caption" tone="label3">
                    {period}
                  </Txt>
                </Card>
              </Pressable>
            );
          })}
        </>
      )}
    </Screen>
  );
}
