# Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 0 — Audit | Workspace audit, HIG references, architecture | ✅ Done |
| 1 — Design foundation | Tokens, type, colour (validated), components, navigation, light/dark | ✅ Done |
| 2 — Web MVP | Auth, accounts, transactions, categories, dashboard, budgets, settings — on real MySQL | ✅ Done (see PROGRESS.md for gaps) |
| 3 — Mobile MVP | Expo app: auth (SecureStore), home, quick entry, transactions, accounts, budgets, settings; native tabs + form sheets | ✅ Done in web preview — device/simulator run, icon, swipe actions, date picker still open (PROGRESS.md) |
| 4 — Advanced | Savings goals & contributions, debts & payments, recurring generation (idempotent job), analytics + PDF/XLSX/CSV, bank statement import (CSV → XLSX → PDF), attachments | Planned — schema already in place |
| 5 — AI | Gemini assistant via backend tools that query the user's own aggregates; no free-form SQL; answers cite figures | Planned |
| 6 — Quality & deploy | Security review, perf (code-split, query plans), a11y audit, CI, backups, HTTPS, App Store / Play builds | Planned |

## Before production (must do)

- Mobile: run on iOS simulator / Android emulator and real devices (`npx expo start`, Expo Go or a dev build), real
  app icon + splash, EAS build profiles, `EXPO_PUBLIC_API_URL` pointing at the HTTPS API.

- Production mail transport (SMTP/API) in `apps/api/src/modules/auth/mailer.ts` — dev logs links to the console.
- `DB_SSL=true` against a managed MySQL with TLS; nightly encrypted backups + PITR.
- Serve web and API under one origin (or set `CORS_ORIGINS`) behind HTTPS; `TRUST_PROXY` set for real client IPs.
- Rate limiter store shared across instances (Redis) if running more than one API process.
- i18n: French and Arabic UI (RTL) — numbers/dates already follow the user locale.
