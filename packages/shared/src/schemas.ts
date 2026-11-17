import { z } from 'zod';
import { ACCOUNT_TYPES, CATEGORY_ICONS, PAYMENT_METHODS } from './constants';
import { isISODate, PERIOD_PRESETS } from './dates';
import { money, SUPPORTED_CURRENCIES } from './money';

/* ---------- primitives ---------- */

export const currencySchema = z.enum(SUPPORTED_CURRENCIES);

/** Decimal amount as a string (never a float). Accepts "12", "12.5", "12,50". */
export const amountSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim().replace(/\s/g, '').replace(',', '.'))
  // abort: later refinements parse the value with decimal.js, which throws on malformed input
  // such as "12.5,3" — stop here so callers get a validation error, not an exception.
  .refine((v) => /^-?\d{1,13}(\.\d{1,2})?$/.test(v), { message: 'Enter an amount with up to 2 decimals', abort: true });

export const positiveAmountSchema = amountSchema.refine((v) => money(v).gt(0), {
  message: 'Amount must be greater than zero',
});

export const nonNegativeAmountSchema = amountSchema.refine((v) => money(v).gte(0), {
  message: 'Amount cannot be negative',
});

export const isoDateSchema = z.string().refine(isISODate, { message: 'Use a valid date (YYYY-MM-DD)' });
export const idSchema = z.string().min(1).max(40);
export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #4B3FD1');

/* ---------- auth ---------- */

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128, 'Use at most 128 characters')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), { message: 'Include at least one letter and one number' });

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(191);

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(80),
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });
export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema });

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
});

export const updateSettingsSchema = z.object({
  baseCurrency: currencySchema.optional(),
  timezone: z
    .string()
    .max(64)
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'Unknown time zone')
    .optional(),
  locale: z.enum(['fr-MA', 'en-US', 'ar-MA']).optional(),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]).optional(),
  budgetAlerts: z.boolean().optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/* ---------- accounts ---------- */

export const accountCreateSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(60),
  type: z.enum(ACCOUNT_TYPES),
  currency: currencySchema.default('MAD'),
  openingBalance: amountSchema.default('0'),
  color: colorSchema.optional(),
  institution: z.string().trim().max(80).optional().nullable(),
  includeInNetWorth: z.boolean().default(true),
});
export type AccountCreateInput = z.input<typeof accountCreateSchema>;

export const accountUpdateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  type: z.enum(ACCOUNT_TYPES).optional(),
  openingBalance: amountSchema.optional(),
  color: colorSchema.optional(),
  institution: z.string().trim().max(80).optional().nullable(),
  includeInNetWorth: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});
export type AccountUpdateInput = z.input<typeof accountUpdateSchema>;

/* ---------- categories ---------- */

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(40),
  type: z.enum(['INCOME', 'EXPENSE']),
  icon: z.enum(CATEGORY_ICONS).default('dots'),
  color: colorSchema.default('#7D8590'),
  parentId: idSchema.optional().nullable(),
});
export type CategoryCreateInput = z.input<typeof categoryCreateSchema>;

export const categoryUpdateSchema = categoryCreateSchema.partial().omit({ type: true });

/* ---------- transactions ---------- */

const transactionBase = z.object({
  amount: positiveAmountSchema,
  date: isoDateSchema,
  accountId: idSchema,
  description: z.string().trim().min(1, 'Add a short description').max(140),
  note: z.string().trim().max(1000).optional().nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional().nullable(),
});

export const transactionCreateSchema = z.discriminatedUnion('type', [
  transactionBase.extend({ type: z.literal('INCOME'), categoryId: idSchema.optional().nullable() }),
  transactionBase.extend({ type: z.literal('EXPENSE'), categoryId: idSchema.optional().nullable() }),
  transactionBase.extend({
    type: z.literal('TRANSFER'),
    toAccountId: idSchema,
    /** Required only when the two accounts use different currencies. */
    toAmount: positiveAmountSchema.optional().nullable(),
  }),
]);
export type TransactionCreateInput = z.input<typeof transactionCreateSchema>;

export const transactionUpdateSchema = z.object({
  amount: positiveAmountSchema.optional(),
  date: isoDateSchema.optional(),
  accountId: idSchema.optional(),
  toAccountId: idSchema.optional().nullable(),
  toAmount: positiveAmountSchema.optional().nullable(),
  categoryId: idSchema.optional().nullable(),
  description: z.string().trim().min(1).max(140).optional(),
  note: z.string().trim().max(1000).optional().nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional().nullable(),
});
export type TransactionUpdateInput = z.input<typeof transactionUpdateSchema>;

export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  q: z.string().trim().max(100).optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']).optional(),
  accountId: idSchema.optional(),
  categoryId: idSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  minAmount: amountSchema.optional(),
  maxAmount: amountSchema.optional(),
  sort: z.enum(['date', 'amount', 'description']).default('date'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type TransactionQuery = z.input<typeof transactionQuerySchema>;

/* ---------- budgets ---------- */

export const budgetCreateSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(60),
  period: z.enum(['MONTHLY', 'WEEKLY']),
  amount: positiveAmountSchema,
  currency: currencySchema.default('MAD'),
  categoryId: idSchema.optional().nullable(),
});
export type BudgetCreateInput = z.input<typeof budgetCreateSchema>;
export const budgetUpdateSchema = budgetCreateSchema.partial();

/* ---------- reporting ---------- */

export const periodQuerySchema = z
  .object({
    preset: z.enum(PERIOD_PRESETS).optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .refine((v) => (v.from ? !!v.to : true) && (!v.from || !v.to || v.from <= v.to), {
    message: 'Provide a valid from/to range',
  });
export type PeriodQuery = z.infer<typeof periodQuerySchema>;

/* ---------- savings goals ---------- */

export const goalCreateSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(60),
  targetAmount: positiveAmountSchema,
  currency: currencySchema.default('MAD'),
  deadline: isoDateSchema.optional().nullable(),
  icon: z.enum(CATEGORY_ICONS).default('piggy'),
  color: colorSchema.default('#4B3FD1'),
});
export type GoalCreateInput = z.input<typeof goalCreateSchema>;
export const goalUpdateSchema = goalCreateSchema.partial().extend({ archived: z.boolean().optional() });
export type GoalUpdateInput = z.input<typeof goalUpdateSchema>;

/** A contribution adds to a goal; `withdraw` takes money back out. Both are positive amounts. */
export const contributionCreateSchema = z.object({
  amount: positiveAmountSchema,
  kind: z.enum(['DEPOSIT', 'WITHDRAWAL']).default('DEPOSIT'),
  date: isoDateSchema,
  note: z.string().trim().max(255).optional().nullable(),
});
export type ContributionCreateInput = z.input<typeof contributionCreateSchema>;

/* ---------- debts ---------- */

export const debtCreateSchema = z.object({
  direction: z.enum(['BORROWED', 'LENT']),
  counterparty: z.string().trim().min(1, 'Enter who the debt is with').max(80),
  principal: positiveAmountSchema,
  currency: currencySchema.default('MAD'),
  startDate: isoDateSchema,
  dueDate: isoDateSchema.optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
  /** When set, the money received (borrowed) or handed over (lent) moves through this account. */
  accountId: idSchema.optional().nullable(),
});
export type DebtCreateInput = z.input<typeof debtCreateSchema>;
export const debtUpdateSchema = z.object({
  counterparty: z.string().trim().min(1).max(80).optional(),
  dueDate: isoDateSchema.optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
});
export type DebtUpdateInput = z.input<typeof debtUpdateSchema>;

export const debtPaymentCreateSchema = z.object({
  amount: positiveAmountSchema,
  date: isoDateSchema,
  note: z.string().trim().max(255).optional().nullable(),
  /** When set, the repayment moves through this account (out if you borrowed, in if you lent). */
  accountId: idSchema.optional().nullable(),
});
export type DebtPaymentCreateInput = z.input<typeof debtPaymentCreateSchema>;
