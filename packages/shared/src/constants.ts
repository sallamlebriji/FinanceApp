/**
 * Default categories created for every new user. `icon` is a semantic key mapped to
 * Lucide on web and SF Symbols / Material Symbols on mobile.
 */
export interface DefaultCategory {
  key: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  icon: string;
  color: string;
}

export const DEFAULT_EXPENSE_CATEGORIES: DefaultCategory[] = [
  { key: 'food', name: 'Food', type: 'EXPENSE', icon: 'basket', color: '#E8853D' },
  { key: 'transport', name: 'Transport', type: 'EXPENSE', icon: 'car', color: '#3B82C4' },
  { key: 'housing', name: 'Housing', type: 'EXPENSE', icon: 'home', color: '#8A63D2' },
  { key: 'healthcare', name: 'Healthcare', type: 'EXPENSE', icon: 'health', color: '#D9506A' },
  { key: 'shopping', name: 'Shopping', type: 'EXPENSE', icon: 'bag', color: '#C2569B' },
  { key: 'entertainment', name: 'Entertainment', type: 'EXPENSE', icon: 'ticket', color: '#D6A21E' },
  { key: 'restaurants', name: 'Restaurants', type: 'EXPENSE', icon: 'restaurant', color: '#CF6A45' },
  { key: 'subscriptions', name: 'Subscriptions', type: 'EXPENSE', icon: 'repeat', color: '#5A6ACF' },
  { key: 'education', name: 'Education', type: 'EXPENSE', icon: 'book', color: '#2E9C8F' },
  { key: 'bills', name: 'Bills', type: 'EXPENSE', icon: 'bolt', color: '#C9952B' },
  { key: 'travel', name: 'Travel', type: 'EXPENSE', icon: 'plane', color: '#2F93B8' },
  { key: 'other-expense', name: 'Other', type: 'EXPENSE', icon: 'dots', color: '#7D8590' },
];

export const DEFAULT_INCOME_CATEGORIES: DefaultCategory[] = [
  { key: 'salary', name: 'Salary', type: 'INCOME', icon: 'briefcase', color: '#2E9E62' },
  { key: 'freelance', name: 'Freelance', type: 'INCOME', icon: 'laptop', color: '#3A9A8A' },
  { key: 'business', name: 'Business', type: 'INCOME', icon: 'store', color: '#4C7FC0' },
  { key: 'investments', name: 'Investments', type: 'INCOME', icon: 'trend', color: '#6B5BD2' },
  { key: 'gifts', name: 'Gifts', type: 'INCOME', icon: 'gift', color: '#C65C8E' },
  { key: 'other-income', name: 'Other', type: 'INCOME', icon: 'dots', color: '#7D8590' },
];

export const DEFAULT_CATEGORIES = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES];

export const CATEGORY_ICONS = [
  'basket', 'car', 'home', 'health', 'bag', 'ticket', 'restaurant', 'repeat', 'book', 'bolt', 'plane', 'dots',
  'briefcase', 'laptop', 'store', 'trend', 'gift', 'coffee', 'phone', 'wifi', 'fuel', 'baby', 'paw', 'gym',
  'shirt', 'tools', 'heart', 'piggy', 'card', 'cash',
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export const ACCOUNT_TYPES = ['BANK', 'CASH', 'SAVINGS', 'CUSTOM'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const PAYMENT_METHODS = ['CARD', 'CASH', 'TRANSFER', 'DIRECT_DEBIT', 'CHEQUE', 'MOBILE', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CARD: 'Card',
  CASH: 'Cash',
  TRANSFER: 'Bank transfer',
  DIRECT_DEBIT: 'Direct debit',
  CHEQUE: 'Cheque',
  MOBILE: 'Mobile payment',
  OTHER: 'Other',
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  BANK: 'Bank account',
  CASH: 'Cash',
  SAVINGS: 'Savings',
  CUSTOM: 'Other',
};
