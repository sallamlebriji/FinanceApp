import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { generateAll } from './modules/recurring/recurring.service';

const server = createApp().listen(env.PORT, () => {
  logger.info(`Mizan API listening on http://localhost:${env.PORT} (docs: /api/docs)`);
});

// Recurring transactions: catch up at start, then hourly. Idempotent, so overlapping runs or
// several API instances never double-post.
const runRecurring = () => void generateAll().catch((err) => logger.error({ err }, 'Recurring job failed'));
runRecurring();
setInterval(runRecurring, 60 * 60 * 1000).unref();

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
