import { Router } from 'express';
import { uid } from '../../middleware/auth';
import * as svc from './debts.service';

export const debtsRouter = Router();

debtsRouter.get('/', async (req, res) => {
  res.json({ items: await svc.listDebts(uid(req), req.query.settled !== 'false') });
});

debtsRouter.post('/', async (req, res) => {
  res.status(201).json(await svc.createDebt(uid(req), req.body));
});

debtsRouter.get('/:id', async (req, res) => {
  res.json(await svc.getDebt(uid(req), String(req.params.id)));
});

debtsRouter.patch('/:id', async (req, res) => {
  res.json(await svc.updateDebt(uid(req), String(req.params.id), req.body));
});

debtsRouter.delete('/:id', async (req, res) => {
  await svc.deleteDebt(uid(req), String(req.params.id));
  res.status(204).end();
});

debtsRouter.post('/:id/payments', async (req, res) => {
  res.status(201).json(await svc.addPayment(uid(req), String(req.params.id), req.body));
});

debtsRouter.delete('/:id/payments/:paymentId', async (req, res) => {
  res.json(await svc.deletePayment(uid(req), String(req.params.id), String(req.params.paymentId)));
});
