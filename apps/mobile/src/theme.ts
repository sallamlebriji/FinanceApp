import { Platform, useColorScheme, type TextStyle } from 'react-native';

/**
 * Mizan colour tokens — the same role-named palette as the web app (docs/DESIGN_SYSTEM.md),
 * contrast-checked in both appearances. Never hard-code a colour in a screen; read it from here.
 */
const light = {
  bg: '#F4F4F6',
  surface: '#FFFFFF',
  surface2: '#F9F9FB',
  fill: 'rgba(120,120,128,0.12)',
  fillStrong: 'rgba(120,120,128,0.2)',
  separator: 'rgba(60,60,67,0.14)',
  label: '#111114',
  label2: '#55555F',
  label3: '#6B6B75',
  accent: '#4B3FD1',
  accentFg: '#FFFFFF',
  accentSoft: 'rgba(75,63,209,0.1)',
  positive: '#18794A',
  negative: '#C2362B',
  negativeSoft: 'rgba(194,54,43,0.1)',
  warning: '#9A5A00',
  warningSoft: 'rgba(154,90,0,0.12)',
  seriesIncome: '#4B3FD1',
  seriesExpense: '#EB6834',
};

const dark: typeof light = {
  bg: '#0C0C0F',
  surface: '#17171B',
  surface2: '#1F1F24',
  fill: 'rgba(120,120,128,0.24)',
  fillStrong: 'rgba(120,120,128,0.36)',
  separator: 'rgba(84,84,88,0.55)',
  label: '#F4F4F6',
  label2: '#A9A9B3',
  label3: '#8E8E98',
  accent: '#9D95FF',
  accentFg: '#0C0C0F',
  accentSoft: 'rgba(157,149,255,0.16)',
  positive: '#4CC38A',
  negative: '#FF7B70',
  negativeSoft: 'rgba(255,123,112,0.14)',
  warning: '#F2B24C',
  warningSoft: 'rgba(242,178,76,0.14)',
  seriesIncome: '#9085E9',
  seriesExpense: '#D95926',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

/**
 * Type scale follows the iOS default ("Large") Dynamic Type sizes; React Native scales these
 * with the person's text-size setting (allowFontScaling is on by default). Android maps them
 * to the system font (Roboto) at the same sizes, which sit close to Material 3's scale.
 */
export const type = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
} satisfies Record<string, TextStyle>;

export type TypeStyle = keyof typeof type;

/** Tabular figures so amounts line up in lists. */
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

export const radius = { control: 10, card: 16, sheet: 20 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

/** 44 pt (iOS) / 48 dp (Material) minimum hit target. */
export const minTarget = Platform.OS === 'android' ? 48 : 44;

/**
 * react-native-web draws the browser's default focus outline on inputs; our fields draw their
 * own focus border instead (web preview only — native inputs have no outline).
 */
export const noOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;
