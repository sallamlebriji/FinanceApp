import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { env } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';

export * from '../generated/prisma/client';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

function createClient() {
  const url = new URL(env.DATABASE_URL);
  const isLocal = LOOPBACK.has(url.hostname);
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectionLimit: 10,
    // Fail fast instead of hanging requests when the database is unreachable.
    connectTimeout: 5_000,
    acquireTimeout: 8_000,
    // DATE columns are calendar dates; keep everything in UTC so they never shift.
    timezone: 'Z',
    // MySQL 8 caching_sha2_password: remote servers must use TLS. Fetching the server's RSA
    // key over plaintext is only acceptable on the loopback interface (local development).
    ...(env.DB_SSL ? { ssl: { rejectUnauthorized: true } } : isLocal ? { allowPublicKeyRetrieval: true } : {}),
  });
  return new PrismaClient({ adapter, log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? createClient();
if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
