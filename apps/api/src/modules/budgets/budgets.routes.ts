import { Router } from 'express';
import { uid } from '../../middleware/auth';
import * as svc from './budgets.service';

export const budgetsRouter = Router();

budgetsRouter.get('/', async (req, res) => {
  res.json({ items: await svc.listBudgets(uid(req)) });
});

budgetsRouter.post('/', async (req, res) => {
  const dto = await svc.createBudget(uid(req), req.body);
  await svc.evaluateBudgetAlerts(uid(req));
  res.status(201).json(dto);
});

budgetsRouter.patch('/:id', async (req, res) => {
  const dto = await svc.updateBudget(uid(req), String(req.params.id), req.body);
  await svc.evaluateBudgetAlerts(uid(req));
  res.json(dto);
});

budgetsRouter.delete('/:id', async (req, res) => {
  await svc.deleteBudget(uid(req), String(req.params.id));
  res.status(204).end();
});
