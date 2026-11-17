import { Router } from 'express';
import { uid } from '../../middleware/auth';
import * as svc from './recurring.service';

export const recurringRouter = Router();

recurringRouter.get('/', async (req, res) => {
  await svc.generateForUser(uid(req));
  res.json({ items: await svc.listRecurring(uid(req)) });
});

recurringRouter.post('/', async (req, res) => {
  res.status(201).json(await svc.createRecurring(uid(req), req.body));
});

recurringRouter.patch('/:id', async (req, res) => {
  res.json(await svc.updateRecurring(uid(req), String(req.params.id), req.body));
});

recurringRouter.delete('/:id', async (req, res) => {
  await svc.deleteRecurring(uid(req), String(req.params.id));
  res.status(204).end();
});
