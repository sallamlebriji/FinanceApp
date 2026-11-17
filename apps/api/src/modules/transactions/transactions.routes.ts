import { Router } from 'express';
import { uid } from '../../middleware/auth';
import * as svc from './transactions.service';

export const transactionsRouter = Router();

transactionsRouter.get('/', async (req, res) => {
  res.json(await svc.listTransactions(uid(req), req.query as never));
});

transactionsRouter.get('/export.csv', async (req, res) => {
  const csv = await svc.exportTransactionsCsv(uid(req), req.query as never);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="mizan-transactions-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

transactionsRouter.post('/', async (req, res) => {
  res.status(201).json(await svc.createTransaction(uid(req), req.body));
});

transactionsRouter.get('/:id', async (req, res) => {
  res.json(await svc.getTransaction(uid(req), String(req.params.id)));
});

transactionsRouter.patch('/:id', async (req, res) => {
  res.json(await svc.updateTransaction(uid(req), String(req.params.id), req.body));
});

transactionsRouter.post('/:id/duplicate', async (req, res) => {
  res.status(201).json(await svc.duplicateTransaction(uid(req), String(req.params.id)));
});

transactionsRouter.delete('/:id', async (req, res) => {
  await svc.deleteTransaction(uid(req), String(req.params.id));
  res.status(204).end();
});
