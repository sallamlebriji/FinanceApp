# Architecture

Mizan is an npm-workspaces monorepo. One TypeScript codebase per runtime, one shared package
for every financial rule so web, mobile and the API can never disagree on a number.

```
FINANCE APP/
├── apps/
│   ├── api/        Express 5 · Prisma 7 · MySQL 8.4 · JWT · Zod · Swagger (dev)
│   ├── web/        React 19 · Vite 8 · Tailwind 4 · TanStack Query · Zustand · RHF · Recharts
│   └── mobile/     Expo SDK 58 · React Native 0.88 · Expo Router (native tabs, form sheets) · SecureStore
├── packages/
│   └── shared/     money (decimal.js) · dates/timezones · finance rules · Zod schemas · DTO types
├── docs/
└── .local/         project MySQL instance (gitignored, dev only)
```

## Layering

| Layer | Where | Rule |
| --- | --- | --- |
| Financial rules | `packages/shared/src/finance.ts`, `money.ts`, `currency.ts`, `dates.ts` | Pure functions, decimal.js only, unit-tested. No I/O. |
| Validation | `packages/shared/src/schemas.ts` | Same Zod schema validates the web form and the API body. |
| API routes | `apps/api/src/modules/*/*.routes.ts` | HTTP only: parse, call service, respond. |
| API services | `apps/api/src/modules/*/*.service.ts` | Ownership checks, DB transactions, call shared rules. |
| Data access | Prisma client (`apps/api/src/lib/prisma.ts`) | Every query is scoped by `userId`. |
| Web data | `apps/web/src/features/*/api.ts` | TanStack Query hooks; every financial mutation invalidates balances, budgets and the dashboard. |
| Web UI | `apps/web/src/components/ui`, `features/*` | Small components; no business maths in components. |
| Mobile data | `apps/mobile/src/lib/data.ts` | Same endpoints and query keys as the web; infinite feed for Activity. |
| Mobile UI | `apps/mobile/src/app` (routes), `src/components` | Expo Router file routes; tokens in `src/theme.ts` mirror the web's. |

## Key decisions

1. **Balances are derived, never stored.** `balance = opening + income − expenses − transfers out + transfers in`,
   computed with two grouped SQL aggregates (`accounts.service.ts`). Edits and deletes can never leave a stale balance.
2. **A transfer is one ledger row** (`accountId` debited by `amount`, `toAccountId` credited by `toAmount`).
   One INSERT is atomic by nature; cross-currency transfers store the implied rate on the row and in `exchange_rates`.
3. **Calendar dates, not timestamps.** Transactions carry a `DATE` in the user's timezone (default `Africa/Casablanca`);
   period maths runs on plain dates (`dates.ts`), so month boundaries never drift with DST.
4. **Currencies are never mixed implicitly.** Totals are grouped by currency and converted only through a recorded rate;
   anything without a rate is reported as `unconverted` instead of being silently added.
5. **Debt-linked rows are excluded from income/expense reports** (`isReportable`) — they move balances only, which
   prevents double counting loans and repayments (Phase 4 builds the Debts UI on this).
6. **Auth:** short-lived JWT access token in memory; opaque refresh token rotated on every use, stored as SHA-256,
   grouped in families with reuse detection. Browsers get it as an `httpOnly; SameSite=Strict; Path=/api/auth` cookie,
   native apps in the body (`X-Client-Platform: native`) for SecureStore.
7. **Prisma 7 + `@prisma/adapter-mariadb`** (works with MySQL 8 and MariaDB). Tables are explicitly mapped to
   lowercase snake_case so migrations behave the same on Windows (case-insensitive) and Linux (case-sensitive).
8. **No app-level theme switch:** light/dark follow the system (HIG `dark-mode.md`).
9. **One React version across the monorepo** (`overrides` in the root `package.json`): React Native's renderer requires
   the exact React version Expo ships, so the web pins the same one.
10. **Mobile uses the platforms' own navigation:** `NativeTabs` (UITabBar / Material navigation bar) and native-stack
    form sheets. The browser preview of the mobile app (`npm run web -w @mizan/mobile`) swaps in a JS bottom tab bar,
    because native tabs fall back to a top strip on web.

## Local services

| Service | Port | Start |
| --- | --- | --- |
| MySQL 8.4 (project instance) | 3317 | `"C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --defaults-file=".local/mysql.ini"` |
| API | 4100 | `npm run dev:api` (Swagger UI at `/api/docs`) |
| Web | 5180 | `npm run dev:web` (proxies `/api` → 4100) |
| Mobile (Metro) | 8081 | `npx expo start` in `apps/mobile` — Expo Go or a dev build; reaches the API at `http://<Metro host>:4100` |
| Mobile web preview | 8095 | `npm run web -w @mizan/mobile` (needs `http://localhost:8095` in `CORS_ORIGINS`) |

Ports were chosen to avoid clashing with other local projects on this machine (3306/3307/3308, 4000, 5173 are in use).
