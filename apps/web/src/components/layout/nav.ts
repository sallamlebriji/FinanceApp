import { ArrowLeftRight, Gauge, LayoutGrid, Settings, Wallet, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  /** Single-word label for the compact tab bar (HIG tab-bars.md). */
  short: string;
  icon: LucideIcon;
}

/**
 * Only modules that are implemented appear in navigation — no dead ends. Savings, Debts,
 * Analytics and the AI assistant are added as their phases ship (docs/ROADMAP.md).
 */
export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: LayoutGrid },
  { to: '/transactions', label: 'Transactions', short: 'Activity', icon: ArrowLeftRight },
  { to: '/accounts', label: 'Accounts', short: 'Accounts', icon: Wallet },
  { to: '/budgets', label: 'Budgets', short: 'Budgets', icon: Gauge },
  { to: '/settings', label: 'Settings', short: 'Settings', icon: Settings },
];
