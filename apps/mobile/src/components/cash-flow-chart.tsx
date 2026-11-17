import { money, type Currency } from '@mizan/shared';
import { View } from 'react-native';
import Svg, { G, Line, Rect } from 'react-native-svg';
import { fmtMoney, fmtMonth, useLocale } from '@/lib/format';
import { space, useColors } from '@/theme';
import { Txt } from './ui';

/**
 * Income vs spending by month — grouped bars (2 series, one axis), the same form and validated
 * colours as the web dashboard. A text headline and an accessibility summary carry the data.
 */
export function CashFlowChart({
  data,
  currency,
  width,
}: {
  data: { month: string; income: string; expense: string }[];
  currency: Currency;
  width: number;
}) {
  const c = useColors();
  const locale = useLocale();
  const months = data.slice(-6);
  const max = months.reduce((m, d) => Math.max(m, Number(d.income), Number(d.expense)), 0) || 1;
  const height = 120;
  const slot = width / Math.max(months.length, 1);
  const bar = Math.min(14, slot / 3.2);

  const summary = months
    .map(
      (d) =>
        `${fmtMonth(d.month, locale, 'long')}: income ${fmtMoney(d.income, currency, locale)}, spending ${fmtMoney(d.expense, currency, locale)}`,
    )
    .join('. ');

  const surplusMonths = months.filter((d) => money(d.income).gte(money(d.expense))).length;

  return (
    <View style={{ gap: space.md }}>
      <Txt variant="subhead" tone="label2">
        {months.length ? `Income covered spending in ${surplusMonths} of the last ${months.length} months.` : 'No months to compare yet.'}
      </Txt>
      <View accessible accessibilityRole="image" accessibilityLabel={summary || 'No data'}>
        <Svg width={width} height={height}>
          <Line x1={0} y1={height - 0.5} x2={width} y2={height - 0.5} stroke={c.separator} strokeWidth={1} />
          {months.map((d, i) => {
            const x = i * slot + slot / 2;
            const hi = (Number(d.income) / max) * (height - 8);
            const he = (Number(d.expense) / max) * (height - 8);
            return (
              <G key={d.month}>
                <Rect x={x - bar - 1} y={height - hi} width={bar} height={Math.max(hi, 0)} rx={3} fill={c.seriesIncome} />
                <Rect x={x + 1} y={height - he} width={bar} height={Math.max(he, 0)} rx={3} fill={c.seriesExpense} />
              </G>
            );
          })}
        </Svg>
        <View style={{ flexDirection: 'row' }}>
          {months.map((d) => (
            <Txt key={d.month} variant="caption" tone="label3" style={{ width: slot, textAlign: 'center' }} numberOfLines={1}>
              {fmtMonth(d.month, locale)}
            </Txt>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: space.lg }} importantForAccessibility="no-hide-descendants">
        <Legend color={c.seriesIncome} label="Income" />
        <Legend color={c.seriesExpense} label="Spending" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Txt variant="footnote" tone="label2">
        {label}
      </Txt>
    </View>
  );
}
