# Mizan — personal finance

A premium personal finance platform for web, iOS and Android, built for the Moroccan market (MAD by default,
EUR/USD supported). Monorepo: `apps/api` (Express + Prisma + MySQL), `apps/web` (React + Vite), `apps/mobile` (Expo), `packages/shared`
(decimal-safe finance rules and validation). Docs in [`docs/`](docs).

## Run locally

Requirements: Node ≥ 20.19, MySQL 8.4 (or MariaDB 10.4+).

```bash
npm install
cp apps/api/.env.example apps/api/.env        # then fill DATABASE_URL and the two JWT secrets
npm run db:deploy -w @mizan/api
npm run db:seed -w @mizan/api                 # optional demo data
npm run dev:api                               # http://localhost:4100  (docs: /api/docs)
npm run dev:web                               # http://localhost:5180
```

Mobile (Expo SDK 58):

```bash
cd apps/mobile
npx expo start                                # scan the QR code with Expo Go, or press i / a for a simulator
npm run web                                   # browser preview at http://localhost:8095
```

The phone must be on the same network as the API; in development the app calls `http://<Metro host>:4100/api`.
Set `EXPO_PUBLIC_API_URL` for any other API.

Demo account (local seed only): `demo@mizan.local` / `MizanDemo2026`.

## Test

```bash
npm test            # shared unit tests + API integration tests (needs TEST_DATABASE_URL)
npm run typecheck
```

See [`docs/PROGRESS.md`](docs/PROGRESS.md) for what works today and [`docs/ROADMAP.md`](docs/ROADMAP.md) for what's next.
