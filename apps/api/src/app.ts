import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { corsOrigins, env, isProd } from './config/env';
import { buildOpenApi } from './docs/openapi';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { requireAuth } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import { apiLimiter } from './middleware/security';
import { accountsRouter } from './modules/accounts/accounts.routes';
import { authRouter } from './modules/auth/auth.routes';
import { budgetsRouter } from './modules/budgets/budgets.routes';
import { categoriesRouter } from './modules/categories/categories.routes';
import { debtsRouter } from './modules/debts/debts.routes';
import { goalsRouter } from './modules/goals/goals.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { ratesRouter } from './modules/exchange-rates/rates.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { settingsRouter } from './modules/settings/settings.routes';
import { transactionsRouter } from './modules/transactions/transactions.routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY);

  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (env.NODE_ENV !== 'test') app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));

  app.get('/api/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  });

  if (!isProd) {
    const spec = buildOpenApi();
    app.get('/api/openapi.json', (_req, res) => res.json(spec));
    app.use('/api/docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(spec));
  }

  const api = express.Router();
  api.use(apiLimiter);
  api.use('/auth', authRouter);

  const secured = express.Router();
  secured.use(requireAuth);
  secured.use('/settings', settingsRouter);
  secured.use('/dashboard', dashboardRouter);
  secured.use('/accounts', accountsRouter);
  secured.use('/transactions', transactionsRouter);
  secured.use('/categories', categoriesRouter);
  secured.use('/budgets', budgetsRouter);
  secured.use('/goals', goalsRouter);
  secured.use('/debts', debtsRouter);
  secured.use('/exchange-rates', ratesRouter);
  secured.use('/notifications', notificationsRouter);
  api.use(secured);

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
