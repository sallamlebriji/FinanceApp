# API

Base URL: `/api`. Interactive docs (development): **http://localhost:4100/api/docs** — generated from the same Zod
schemas the API validates with (`apps/api/src/docs/openapi.ts`), so it cannot drift.

## Conventions

- Amounts are **decimal strings** (`"1234.50"`), never JSON numbers. Inputs accept `"12,50"` too.
- Dates are calendar dates `YYYY-MM-DD`.
- Errors: `{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [...] } }`.
- Auth: `Authorization: Bearer <accessToken>` (15 min). Refresh via `POST /auth/refresh`.
- Rate limits: 300 req/min per IP globally; 20 per 15 min on login, register, password reset.

## Endpoints (implemented)

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `POST /auth/verify-email` · `POST /auth/forgot-password` · `POST /auth/reset-password` · `GET/PATCH/DELETE /auth/me` · `POST /auth/resend-verification` · `POST /auth/change-password` · `GET /auth/sessions` · `DELETE /auth/sessions/:id` · `POST /auth/logout-all` |
| Settings | `GET/PATCH /settings` |
| Dashboard | `GET /dashboard?preset=this-month\|last-month\|last-3-months\|this-year\|last-12-months` or `?from=&to=` |
| Accounts | `GET/POST /accounts` · `GET/PATCH/DELETE /accounts/:id` · `GET /accounts/:id/history` |
| Transactions | `GET /transactions` (q, type, accountId, categoryId, from, to, minAmount, maxAmount, sort, order, page, pageSize) · `GET /transactions/export.csv` · `POST /transactions` · `GET/PATCH/DELETE /transactions/:id` · `POST /transactions/:id/duplicate` |
| Categories | `GET/POST /categories` · `PATCH /categories/:id` · `DELETE /categories/:id?reassignTo=` |
| Budgets | `GET/POST /budgets` · `PATCH/DELETE /budgets/:id` |
| Exchange rates | `GET/POST /exchange-rates` · `DELETE /exchange-rates/:id` |
| Notifications | `GET /notifications` · `POST /notifications/read-all` · `POST /notifications/:id/read` |
| Health | `GET /health` |

## Native clients

Send `X-Client-Platform: native`. Login/refresh then return `refreshToken` in the JSON body (no cookie), and
`POST /auth/refresh` expects `{ "refreshToken": "…" }`. Store it in Expo SecureStore.

## Security notes

- Refresh tokens rotate on every use; replaying an old one revokes the whole session family.
- Refresh/logout reject cross-origin browser requests (`Origin` allowlist from `CORS_ORIGINS`).
- CSV export neutralises spreadsheet formula injection (`=`, `+`, `-`, `@` prefixes).
- Passwords: Argon2id (m=19 MiB, t=2, p=1); 5 failed logins lock the account for 15 minutes; login errors are generic.
