import { ArrowLeftRight, Gauge, HandCoins, LayoutGrid, PiggyBank, Repeat, Settings, Wallet, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  /** Single-word label for the compact tab bar (HIG tab-bars.md). */
  short: string;
  icon: LucideIcon;
  /** Shown in the compact tab bar. Planning pages share one "Plan" tab there. */
  tab?: boolean;
}

/** Only modules that are implemented appear in navigation — no dead ends. */
export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: LayoutGrid, tab: true },
  { to: '/transactions', label: 'Transactions', short: 'Activity', icon: ArrowLeftRight, tab: true },
  { to: '/recurring', label: 'Recurring', short: 'Recurring', icon: Repeat },
  { to: '/accounts', label: 'Accounts', short: 'Accounts', icon: Wallet, tab: true },
  { to: '/budgets', label: 'Budgets', short: 'Plan', icon: Gauge, tab: true },
  { to: '/goals', label: 'Savings goals', short: 'Goals', icon: PiggyBank },
  { to: '/debts', label: 'Debts', short: 'Debts', icon: HandCoins },
  { to: '/settings', label: 'Settings', short: 'Settings', icon: Settings, tab: true },
];

/** Pages reached from the compact "Plan" tab; they show a switcher between each other. */
export const PLAN_PAGES = [
  { to: '/budgets', label: 'Budgets' },
  { to: '/goals', label: 'Goals' },
  { to: '/debts', label: 'Debts' },
] as const;
