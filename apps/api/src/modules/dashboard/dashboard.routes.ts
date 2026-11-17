import { Router } from 'express';
import { uid } from '../../middleware/auth';
import { getDashboard } from './dashboard.service';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (req, res) => {
  res.json(await getDashboard(uid(req), req.query));
});
