import type { AccountType, PaymentMethod } from './constants';
import type { DateRange, ISODate } from './dates';
import type { TransactionType } from './finance';
import type { Currency } from './money';

/** API response shapes shared by web and mobile clients. Amounts are decimal strings. */

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface SettingsDTO {
  baseCurrency: Currency;
  timezone: string;
  locale: 'fr-MA' | 'en-US' | 'ar-MA';
  weekStartsOn: 0 | 1;
  budgetAlerts: boolean;
}

export interface AuthResponse {
  user: UserDTO;
  settings: SettingsDTO;
  accessToken: string;
  /** Only returned to native clients; browsers receive an httpOnly cookie instead. */
  refreshToken?: string;
}

export interface AccountDTO {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  openingBalance: string;
  balance: string;
  color: string;
  institution: string | null;
  includeInNetWorth: boolean;
  isArchived: boolean;
  transactionCount: number;
  createdAt: string;
}

export interface CategoryDTO {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  icon: string;
  color: string;
  parentId: string | null;
  isDefault: boolean;
}

export interface TransactionDTO {
  id: string;
  type: TransactionType;
  amount: string;
  currency: Currency;
  date: ISODate;
  description: string;
  note: string | null;
  paymentMethod: PaymentMethod | null;
  accountId: string;
  toAccountId: string | null;
  toAmount: string | null;
  toCurrency: Currency | null;
  exchangeRate: string | null;
  categoryId: string | null;
  category: Pick<CategoryDTO, 'id' | 'name' | 'icon' | 'color'> | null;
  account: { id: string; name: string; color: string };
  toAccount: { id: string; name: string; color: string } | null;
  debtId: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface BudgetDTO {
  id: string;
  name: string;
  period: 'MONTHLY' | 'WEEKLY';
  amount: string;
  currency: Currency;
  categoryId: string | null;
  category: Pick<CategoryDTO, 'id' | 'name' | 'icon' | 'color'> | null;
  current: {
    range: DateRange;
    spent: string;
    remaining: string;
    percent: string;
    state: 'ok' | 'warning' | 'critical' | 'over';
    threshold: 50 | 75 | 90 | 100 | null;
  };
}

export interface MoneyFigure {
  amount: string;
  currency: Currency;
}

export interface DashboardDTO {
  range: DateRange;
  previousRange: DateRange;
  baseCurrency: Currency;
  netWorth: MoneyFigure & { unconverted: Currency[] };
  balancesByCurrency: MoneyFigure[];
  current: {
    income: string;
    expense: string;
    net: string;
    savingsRate: string | null;
    unconverted: Currency[];
  };
  previous: { income: string; expense: string; net: string; savingsRate: string | null };
  cashFlow: { month: string; income: string; expense: string; net: string }[];
  spendingByCategory: { categoryId: string | null; name: string; color: string; icon: string; amount: string; percent: string }[];
  netWorthSeries: { month: string; amount: string }[];
  recentTransactions: TransactionDTO[];
  budgets: BudgetDTO[];
  savingsGoals: { id: string; name: string; target: string; current: string; percent: string; currency: Currency }[];
  hasData: boolean;
}

export interface ExchangeRateDTO {
  id: string;
  base: Currency;
  quote: Currency;
  rate: string;
  date: ISODate;
  source: string;
}

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface GoalContributionDTO {
  id: string;
  /** Negative for withdrawals. */
  amount: string;
  date: ISODate;
  note: string | null;
}

export interface SavingsGoalDTO {
  id: string;
  name: string;
  targetAmount: string;
  currency: Currency;
  deadline: ISODate | null;
  icon: string;
  color: string;
  archived: boolean;
  saved: string;
  remaining: string;
  percent: string;
  completed: boolean;
  /** Amount to set aside each month to reach the target by the deadline, or null. */
  monthlyNeeded: string | null;
  contributions?: GoalContributionDTO[];
}

export interface DebtPaymentDTO {
  id: string;
  amount: string;
  date: ISODate;
  note: string | null;
  account: { id: string; name: string } | null;
}

export interface DebtDTO {
  id: string;
  direction: 'BORROWED' | 'LENT';
  counterparty: string;
  principal: string;
  currency: Currency;
  startDate: ISODate;
  dueDate: ISODate | null;
  note: string | null;
  paid: string;
  remaining: string;
  percent: string;
  settled: boolean;
  overdue: boolean;
  account: { id: string; name: string } | null;
  payments?: DebtPaymentDTO[];
}

export interface RecurringDTO {
  id: string;
  type: TransactionType;
  amount: string;
  currency: Currency;
  description: string;
  paymentMethod: PaymentMethod | null;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  interval: number;
  startDate: ISODate;
  endDate: ISODate | null;
  /** Next date a transaction will be created, or null when the schedule has ended. */
  nextDate: ISODate | null;
  isActive: boolean;
  account: { id: string; name: string; color: string };
  toAccount: { id: string; name: string; color: string } | null;
  category: Pick<CategoryDTO, 'id' | 'name' | 'icon' | 'color'> | null;
  /** Approximate monthly impact in the rule's currency (yearly ÷ 12, weekly × 52/12…). */
  monthlyAmount: string;
}
