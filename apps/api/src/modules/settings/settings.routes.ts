import { updateSettingsSchema } from '@mizan/shared';
import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { uid } from '../../middleware/auth';
import { toSettingsDTO } from '../auth/auth.service';

export const settingsRouter = Router();

settingsRouter.get('/', async (req, res) => {
  const s = await prisma.userSettings.upsert({ where: { userId: uid(req) }, create: { userId: uid(req) }, update: {} });
  res.json(toSettingsDTO(s));
});

settingsRouter.patch('/', async (req, res) => {
  const data = updateSettingsSchema.parse(req.body);
  const s = await prisma.userSettings.upsert({
    where: { userId: uid(req) },
    create: { userId: uid(req), ...data },
    update: data,
  });
  res.json(toSettingsDTO(s));
});
