# Progress

_Last updated: 2026-11-17 — end of Phase 3 (mobile MVP)._

## Working — web (verified in the browser against MySQL)

- Register, sign in, sign out, session restore from refresh cookie, email verification and password reset links
  (logged to the API console in dev), change password, list/revoke devices, sign out everywhere, delete account.
- Dashboard: net worth (multi-currency, converted only with recorded rates), income, spending, cash flow, savings
  rate, deltas vs previous period, period selector, cash-flow chart, spending by category, recent activity, budgets,
  savings goals (read-only), net worth trend, empty/loading/error states.
- Accounts: create, edit, archive/restore, delete when unused (else offers archive), per-currency totals, detail page
  with 12-month balance history and running balance.
- Transactions: quick entry (`N`), income/expense/transfer incl. cross-currency, edit, duplicate, delete with Undo,
  search, type/account/category/date filters, sort, pagination, day grouping, CSV export.
- Categories: 18 defaults per user, custom categories with icon/colour, one level of subcategories, safe delete.
- Budgets: monthly/weekly, category or overall, live progress, alerts at 50/75/90/100 % (deduplicated).
- Settings: profile, base currency, timezone, number format, week start, alert toggle, exchange rates.

## Working — mobile (`apps/mobile`, Expo SDK 58)

Verified in the Expo **web preview** (375 × 812, dark and light) against the real API and database. Native builds
use the same code; they have **not** yet been run on a physical iPhone/Android device or simulator from this machine.

- Sign in, create account, forgot password; refresh token stored in the iOS Keychain / Android Keystore
  (`expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`), rotated on every refresh; session restored at launch.
  The web preview keeps the token in memory only (sign in again after a reload) — by design.
- Home: period (Month / 3 Months / Year), net worth, the balance beam, income / spending / savings rate with deltas,
  6-month cash-flow chart, top spending categories, budgets, recent activity, pull to refresh.
- Activity: search, type filter, day-grouped infinite list, tap to edit.
- New/edit transaction sheet: expense / income / transfer (incl. cross-currency amount received), category, account,
  Today / Yesterday / custom date, payment method, note, duplicate, delete with confirmation, success haptic.
  Verified: a 37,25 MAD expense moved net worth 59 410,78 → 59 373,53 and spending 7 941,28 → 7 978,53; deleting it
  restored both exactly.
- Accounts: per-currency totals, list, archived toggle, detail with running-balance history, create / edit /
  archive / restore / delete (API refuses deleting accounts with history and says why).
- Budgets: list with status badges and progress, create / edit / delete (category or all spending, month or week).
- Settings: name, main currency, budget alerts, time zone (read-only), sign out, sign out everywhere, delete account
  (password + confirmation).

## Tests

| Suite | Count | Result |
| --- | --- | --- |
| `packages/shared` (Vitest) — money, FX, balances, transfers, debt exclusion, net worth, budgets, goals, dates/TZ, amount validation | 24 | ✅ |
| `apps/api` (Vitest + Supertest, real MySQL test DB) — auth & rotation/reuse, isolation, ledger, FX transfers, dashboard, budgets/alerts, CSV | 22 | ✅ (see flaky note below) |
| `apps/web`, `apps/mobile` | — | No component tests yet; both typecheck under TS strict |

## Known gaps / issues

- **Flaky API test run on Windows:** about 1 run in 4, the Vitest worker process crashes natively
  (exit code `0xC0000409`) while running `test/finance.test.ts`; no assertion fails, and re-running passes. Likely the
  native Argon2 module under Node 24 on Windows — to investigate (try `pool: 'threads'` or Linux CI).
- Mobile: not yet run on device/simulator; app icon and splash are Expo placeholders; no swipe actions on rows; no
  unsaved-changes confirmation when swiping a sheet away; custom date is typed (needs a native date picker);
  categories and exchange rates are managed on the web only.
- Not built yet: savings/debts/recurring/analytics/import UIs, attachments upload, PDF/XLSX export, AI.
- UI copy is English only; dates/numbers follow `fr-MA`.
- Web bundle 1.1 MB (no route code-splitting yet).
- Email is not sent in production yet (console transport).
- ESLint config not set up yet; TypeScript strict passes in all packages.
- `npm audit`: 4 dev-tooling advisories, none in a shipped bundle — 3 moderate in Expo's CLI (`@expo/fingerprint` →
  `minimatch`; the only "fix" downgrades Expo to SDK 52, so wait for a patched Expo release) and 1 low in an `esbuild`
  nested under `tsup` (affects only esbuild's dev server, which nothing here runs).
- Dev environment: this machine runs other projects' MySQL on 3306–3308 and dev servers on 4000/5173; Mizan uses
  3317 / 4100 / 5180 / 8095.
