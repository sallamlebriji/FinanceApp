# Database

MySQL 8.4 (MariaDB 10.4+ also works) through Prisma 7. Schema: `apps/api/prisma/schema.prisma`.
Migrations: `apps/api/prisma/migrations`. Seed (dev only): `apps/api/prisma/seed.ts`.

## Conventions

- Money: `DECIMAL(18,2)`; exchange rates `DECIMAL(18,8)`. Never `FLOAT`/`DOUBLE`.
- Dates of financial events: `DATE` (calendar day in the user's timezone). Audit timestamps: `DATETIME(3)` UTC.
- IDs: `cuid` strings. Every user-owned table has `userId` + FK `ON DELETE CASCADE` from `users`.
- Table names are lowercase snake_case via `@@map` (portable across OS case-sensitivity).

## Tables

| Table | Purpose | Notable constraints / indexes |
| --- | --- | --- |
| `users` | Identity, Argon2id hash, lockout counters | `email` unique |
| `user_settings` | Base currency, timezone, locale, week start, budget alerts | `userId` unique |
| `accounts` | Bank / cash / savings / custom; currency; opening balance; archive flag | `(userId, isArchived)` |
| `categories` | Income/expense categories, icon, colour, one level of subcategories | `(userId, type)`, self-FK cascade |
| `transactions` | Ledger: INCOME, EXPENSE, TRANSFER (single row) | `(userId, date)`, `(userId, type, date)`, `(accountId, date)`, `toAccountId`, `categoryId`, `debtId`, unique `(recurringId, recurrenceDate)` |
| `budgets` | Monthly/weekly limit, optional category | `(userId, isActive)` |
| `savings_goals`, `savings_contributions` | Goals and dated contributions (negative = withdrawal) | contribution ↔ transaction unique |
| `debts`, `debt_payments` | Borrowed/lent, partial payments | payment ↔ transaction unique |
| `recurring_transactions` | Templates with frequency, interval, anchor day, `nextDate` | `(userId, isActive, nextDate)` |
| `notifications` | Budget thresholds etc. | unique `(userId, dedupeKey)` — an alert can only be created once |
| `attachments` | Files linked to a transaction | `storageKey` unique |
| `refresh_tokens` | SHA-256 of refresh tokens, family, rotation chain | `tokenHash` unique, `familyId` |
| `auth_tokens` | Email verification / password reset (hashed, single-use, expiring) | `tokenHash` unique |
| `import_batches` | Bank statement import sessions | `(userId, createdAt)` |
| `exchange_rates` | Explicit rate history (`1 base = rate quote`) | unique `(userId, base, quote, date)` |

## Integrity rules

- `transactions.accountId/toAccountId → accounts` is `RESTRICT`: an account with history cannot be deleted (the API
  offers archiving instead). Deleting a user removes transactions first, then cascades.
- Duplicate recurring generation is prevented by the unique `(recurringId, recurrenceDate)` key.
- Budget alerts are idempotent via `notifications.dedupeKey = budget:{id}:{periodStart}:{threshold}`.

## Commands

```bash
npm run db:migrate -w @mizan/api     # create + apply a migration (dev)
npm run db:deploy -w @mizan/api      # apply migrations (CI / prod)
npm run db:seed -w @mizan/api        # demo data (refuses NODE_ENV=production)
```

Backups (production): nightly `mysqldump --single-transaction --routines` to encrypted object storage with 30-day
retention, plus point-in-time recovery from binlogs on the managed instance — see `ROADMAP.md`, Phase 6.
