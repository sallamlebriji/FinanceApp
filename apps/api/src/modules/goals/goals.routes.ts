import { Router } from 'express';
import { uid } from '../../middleware/auth';
import * as svc from './goals.service';

export const goalsRouter = Router();

goalsRouter.get('/', async (req, res) => {
  res.json({ items: await svc.listGoals(uid(req), req.query.archived === 'true') });
});

goalsRouter.post('/', async (req, res) => {
  res.status(201).json(await svc.createGoal(uid(req), req.body));
});

goalsRouter.get('/:id', async (req, res) => {
  res.json(await svc.getGoal(uid(req), String(req.params.id)));
});

goalsRouter.patch('/:id', async (req, res) => {
  res.json(await svc.updateGoal(uid(req), String(req.params.id), req.body));
});

goalsRouter.delete('/:id', async (req, res) => {
  await svc.deleteGoal(uid(req), String(req.params.id));
  res.status(204).end();
});

goalsRouter.post('/:id/contributions', async (req, res) => {
  res.status(201).json(await svc.addContribution(uid(req), String(req.params.id), req.body));
});

goalsRouter.delete('/:id/contributions/:contributionId', async (req, res) => {
  res.json(await svc.deleteContribution(uid(req), String(req.params.id), String(req.params.contributionId)));
});
