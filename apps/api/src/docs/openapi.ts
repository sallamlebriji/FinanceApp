import {
  accountCreateSchema,
  accountUpdateSchema,
  budgetCreateSchema,
  budgetUpdateSchema,
  contributionCreateSchema,
  debtCreateSchema,
  debtPaymentCreateSchema,
  debtUpdateSchema,
  goalCreateSchema,
  goalUpdateSchema,
  recurringCreateSchema,
  recurringUpdateSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  periodQuerySchema,
  registerSchema,
  resetPasswordSchema,
  transactionCreateSchema,
  transactionQuerySchema,
  transactionUpdateSchema,
  updateSettingsSchema,
  verifyEmailSchema,
} from '@mizan/shared';
import { z } from 'zod';

type Schema = z.ZodType;
interface Route {
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string;
  tag: string;
  summary: string;
  body?: Schema;
  query?: Schema;
  auth?: boolean;
}

const json = (s: Schema) => z.toJSONSchema(s, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;

const routes: Route[] = [
  { method: 'post', path: '/auth/register', tag: 'Auth', summary: 'Create an account', body: registerSchema, auth: false },
  { method: 'post', path: '/auth/login', tag: 'Auth', summary: 'Sign in', body: loginSchema, auth: false },
  { method: 'post', path: '/auth/refresh', tag: 'Auth', summary: 'Rotate refresh token (cookie, or body for native clients)', auth: false },
  { method: 'post', path: '/auth/logout', tag: 'Auth', summary: 'Sign out this device', auth: false },
  { method: 'post', path: '/auth/verify-email', tag: 'Auth', summary: 'Confirm email address', body: verifyEmailSchema, auth: false },
  { method: 'post', path: '/auth/forgot-password', tag: 'Auth', summary: 'Request a reset link', body: forgotPasswordSchema, auth: false },
  { method: 'post', path: '/auth/reset-password', tag: 'Auth', summary: 'Set a new password', body: resetPasswordSchema, auth: false },
  { method: 'get', path: '/auth/me', tag: 'Auth', summary: 'Current user and settings' },
  { method: 'patch', path: '/auth/me', tag: 'Auth', summary: 'Update profile' },
  { method: 'delete', path: '/auth/me', tag: 'Auth', summary: 'Delete account (password required)' },
  { method: 'post', path: '/auth/resend-verification', tag: 'Auth', summary: 'Resend verification email' },
  { method: 'post', path: '/auth/change-password', tag: 'Auth', summary: 'Change password', body: changePasswordSchema },
  { method: 'get', path: '/auth/sessions', tag: 'Auth', summary: 'Active sessions' },
  { method: 'delete', path: '/auth/sessions/{id}', tag: 'Auth', summary: 'Revoke a session' },
  { method: 'post', path: '/auth/logout-all', tag: 'Auth', summary: 'Sign out everywhere' },
  { method: 'get', path: '/settings', tag: 'Settings', summary: 'Get preferences' },
  { method: 'patch', path: '/settings', tag: 'Settings', summary: 'Update preferences', body: updateSettingsSchema },
  { method: 'get', path: '/dashboard', tag: 'Dashboard', summary: 'Dashboard figures for a period', query: periodQuerySchema },
  { method: 'get', path: '/accounts', tag: 'Accounts', summary: 'List accounts with balances' },
  { method: 'post', path: '/accounts', tag: 'Accounts', summary: 'Create an account', body: accountCreateSchema },
  { method: 'get', path: '/accounts/{id}', tag: 'Accounts', summary: 'Get an account' },
  { method: 'get', path: '/accounts/{id}/history', tag: 'Accounts', summary: 'Balance history and running balance' },
  { method: 'patch', path: '/accounts/{id}', tag: 'Accounts', summary: 'Update or archive an account', body: accountUpdateSchema },
  { method: 'delete', path: '/accounts/{id}', tag: 'Accounts', summary: 'Delete an unused account' },
  { method: 'get', path: '/transactions', tag: 'Transactions', summary: 'Search, filter, sort, paginate', query: transactionQuerySchema },
  { method: 'get', path: '/transactions/export.csv', tag: 'Transactions', summary: 'Export as CSV', query: transactionQuerySchema },
  { method: 'post', path: '/transactions', tag: 'Transactions', summary: 'Create income, expense or transfer', body: transactionCreateSchema },
  { method: 'get', path: '/transactions/{id}', tag: 'Transactions', summary: 'Get a transaction' },
  { method: 'patch', path: '/transactions/{id}', tag: 'Transactions', summary: 'Update a transaction', body: transactionUpdateSchema },
  { method: 'post', path: '/transactions/{id}/duplicate', tag: 'Transactions', summary: 'Duplicate onto today' },
  { method: 'delete', path: '/transactions/{id}', tag: 'Transactions', summary: 'Delete a transaction' },
  { method: 'get', path: '/categories', tag: 'Categories', summary: 'List categories' },
  { method: 'post', path: '/categories', tag: 'Categories', summary: 'Create a category', body: categoryCreateSchema },
  { method: 'patch', path: '/categories/{id}', tag: 'Categories', summary: 'Update a category', body: categoryUpdateSchema },
  { method: 'delete', path: '/categories/{id}', tag: 'Categories', summary: 'Delete (optional ?reassignTo=)' },
  { method: 'get', path: '/budgets', tag: 'Budgets', summary: 'List budgets with progress' },
  { method: 'post', path: '/budgets', tag: 'Budgets', summary: 'Create a budget', body: budgetCreateSchema },
  { method: 'patch', path: '/budgets/{id}', tag: 'Budgets', summary: 'Update a budget', body: budgetUpdateSchema },
  { method: 'delete', path: '/budgets/{id}', tag: 'Budgets', summary: 'Delete a budget' },
  { method: 'get', path: '/goals', tag: 'Savings goals', summary: 'List savings goals with progress (?archived=true to include archived)' },
  { method: 'post', path: '/goals', tag: 'Savings goals', summary: 'Create a savings goal', body: goalCreateSchema },
  { method: 'get', path: '/goals/{id}', tag: 'Savings goals', summary: 'Goal with its contributions' },
  { method: 'patch', path: '/goals/{id}', tag: 'Savings goals', summary: 'Update or archive a goal', body: goalUpdateSchema },
  { method: 'delete', path: '/goals/{id}', tag: 'Savings goals', summary: 'Delete a goal and its contributions' },
  { method: 'post', path: '/goals/{id}/contributions', tag: 'Savings goals', summary: 'Add a deposit or withdrawal', body: contributionCreateSchema },
  { method: 'delete', path: '/goals/{id}/contributions/{contributionId}', tag: 'Savings goals', summary: 'Remove a contribution' },
  { method: 'get', path: '/recurring', tag: 'Recurring', summary: 'List recurring rules (posts anything due first)' },
  { method: 'post', path: '/recurring', tag: 'Recurring', summary: 'Create a rule; occurrences up to today are posted at once', body: recurringCreateSchema },
  { method: 'patch', path: '/recurring/{id}', tag: 'Recurring', summary: 'Change amount, description, category or end date; pause or resume', body: recurringUpdateSchema },
  { method: 'delete', path: '/recurring/{id}', tag: 'Recurring', summary: 'Delete a rule (transactions it created are kept)' },
  { method: 'get', path: '/debts', tag: 'Debts', summary: 'List debts (?settled=false to hide settled ones)' },
  { method: 'post', path: '/debts', tag: 'Debts', summary: 'Record money borrowed or lent', body: debtCreateSchema },
  { method: 'get', path: '/debts/{id}', tag: 'Debts', summary: 'Debt with its repayments' },
  { method: 'patch', path: '/debts/{id}', tag: 'Debts', summary: 'Update counterparty, due date or note', body: debtUpdateSchema },
  { method: 'delete', path: '/debts/{id}', tag: 'Debts', summary: 'Delete a debt and the account movements it created' },
  { method: 'post', path: '/debts/{id}/payments', tag: 'Debts', summary: 'Record a repayment', body: debtPaymentCreateSchema },
  { method: 'delete', path: '/debts/{id}/payments/{paymentId}', tag: 'Debts', summary: 'Remove a repayment' },
  { method: 'get', path: '/exchange-rates', tag: 'Exchange rates', summary: 'Rate history' },
  { method: 'post', path: '/exchange-rates', tag: 'Exchange rates', summary: 'Record a rate' },
  { method: 'delete', path: '/exchange-rates/{id}', tag: 'Exchange rates', summary: 'Delete a rate' },
  { method: 'get', path: '/notifications', tag: 'Notifications', summary: 'Latest notifications' },
  { method: 'post', path: '/notifications/read-all', tag: 'Notifications', summary: 'Mark all as read' },
  { method: 'post', path: '/notifications/{id}/read', tag: 'Notifications', summary: 'Mark one as read' },
];

function queryParams(schema: Schema) {
  const s = json(schema) as { properties?: Record<string, unknown>; required?: string[] };
  return Object.entries(s.properties ?? {}).map(([name, schema]) => ({
    name,
    in: 'query',
    required: s.required?.includes(name) ?? false,
    schema,
  }));
}

export function buildOpenApi() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of routes) {
    const params = [
      ...(r.path.includes('{id}') ? [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] : []),
      ...(r.query ? queryParams(r.query) : []),
    ];
    paths[r.path] ??= {};
    paths[r.path]![r.method] = {
      tags: [r.tag],
      summary: r.summary,
      ...(r.auth === false ? { security: [] } : {}),
      ...(params.length ? { parameters: params } : {}),
      ...(r.body ? { requestBody: { required: true, content: { 'application/json': { schema: json(r.body) } } } } : {}),
      responses: {
        '200': { description: 'OK' },
        '400': { description: 'Validation error' },
        '401': { description: 'Unauthenticated' },
        '404': { description: 'Not found' },
      },
    };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'Mizan API',
      version: '0.1.0',
      description: 'Personal finance API. Amounts are decimal strings; dates are YYYY-MM-DD calendar dates.',
    },
    servers: [{ url: '/api' }],
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    security: [{ bearer: [] }],
    paths,
  };
}
