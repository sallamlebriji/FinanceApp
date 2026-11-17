import { Router } from 'express';
import { uid } from '../../middleware/auth';
import * as svc from './accounts.service';

export const accountsRouter = Router();

accountsRouter.get('/', async (req, res) => {
  res.json({ items: await svc.listAccounts(uid(req), req.query.includeArchived === 'true') });
});

accountsRouter.post('/', async (req, res) => {
  res.status(201).json(await svc.createAccount(uid(req), req.body));
});

accountsRouter.get('/:id', async (req, res) => {
  res.json(await svc.getAccount(uid(req), String(req.params.id)));
});

accountsRouter.get('/:id/history', async (req, res) => {
  const months = Math.min(Math.max(Number(req.query.months) || 12, 1), 60);
  res.json(await svc.accountHistory(uid(req), String(req.params.id), months));
});

accountsRouter.patch('/:id', async (req, res) => {
  res.json(await svc.updateAccount(uid(req), String(req.params.id), req.body));
});

accountsRouter.delete('/:id', async (req, res) => {
  await svc.deleteAccount(uid(req), String(req.params.id));
  res.status(204).end();
});
