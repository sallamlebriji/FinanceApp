import { defineConfig } from 'prisma/config';

// Prisma 7 no longer loads .env automatically; use Node's built-in loader (no dotenv dependency).
try {
  process.loadEnvFile('.env');
} catch {
  /* env provided by the environment (CI, production) */
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx --env-file=.env prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL!,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
