import { money, type Currency } from '@mizan/shared';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { fmtMoney, useLocale } from '@/lib/format';
import { useColors } from '@/theme';
import { Txt } from './ui';

/**
 * Mizan's signature element — a literal balance (ميزان). The beam tips toward whichever side
 * weighs more this period: income on the left, spending on the right. The same information is
 * always stated in text, so meaning never depends on the tilt or on colour.
 */
export function BalanceBeam({ income, expense, currency }: { income: string; expense: string; currency: Currency }) {
  const c = useColors();
  const locale = useLocale();
  const inc = money(income);
  const exp = money(expense);
  const heavier = inc.gt(exp) ? inc : exp;
  const ratio = heavier.isZero() ? 0 : exp.minus(inc).div(heavier).toNumber();
  const angle = Math.max(-1, Math.min(1, ratio)) * 7;

  const summary = heavier.isZero()
    ? 'No income or spending recorded in this period yet.'
    : inc.gte(exp)
      ? `Income outweighs spending by ${fmtMoney(inc.minus(exp).toFixed(2), currency, locale)}.`
      : `Spending outweighs income by ${fmtMoney(exp.minus(inc).toFixed(2), currency, locale)}.`;

  const tilt = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) tilt.setValue(angle);
      else Animated.timing(tilt, { toValue: angle, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [angle, tilt]);

  const rotate = tilt.interpolate({ inputRange: [-7, 7], outputRange: ['-7deg', '7deg'] });

  // The beam is drawn in a 240×92 box; its pivot (120, 38) sits at the centre of the beam layer.
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={{ gap: 4 }}>
      <View style={{ width: 240, height: 92, alignSelf: 'flex-start' }}>
        <Svg width={240} height={92} style={{ position: 'absolute' }}>
          <Path d="M120 40 L109 84 H131 Z" fill={c.fillStrong} />
          <Rect x={96} y={84} width={48} height={3} rx={1.5} fill={c.fillStrong} />
        </Svg>
        <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: 240, height: 76, transform: [{ rotate }] }}>
          <Svg width={240} height={76}>
            <Rect x={22} y={36} width={196} height={4} rx={2} fill={c.label} />
            <Line x1={34} y1={40} x2={34} y2={54} stroke={c.label3} strokeWidth={1.5} />
            <Line x1={206} y1={40} x2={206} y2={54} stroke={c.label3} strokeWidth={1.5} />
            <Path d="M16 54 H52 a18 9 0 0 1 -36 0Z" fill={c.seriesIncome} />
            <Path d="M188 54 H224 a18 9 0 0 1 -36 0Z" fill={c.seriesExpense} />
            <Circle cx={120} cy={38} r={4.5} fill={c.surface} stroke={c.label} strokeWidth={2} />
          </Svg>
        </Animated.View>
      </View>
      <Txt variant="subhead" tone="label2" importantForAccessibility="no">
        {summary}
      </Txt>
    </View>
  );
}
