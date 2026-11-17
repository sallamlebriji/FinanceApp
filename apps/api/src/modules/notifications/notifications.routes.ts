import type { NotificationDTO } from '@mizan/shared';
import { Router } from 'express';
import { notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { uid } from '../../middleware/auth';

export const notificationsRouter = Router();

notificationsRouter.get('/', async (req, res) => {
  const userId = uid(req);
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  const items: NotificationDTO[] = rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }));
  res.json({ items, unread });
});

notificationsRouter.post('/read-all', async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: uid(req), readAt: null }, data: { readAt: new Date() } });
  res.status(204).end();
});

notificationsRouter.post('/:id/read', async (req, res) => {
  const r = await prisma.notification.updateMany({
    where: { id: String(req.params.id), userId: uid(req) },
    data: { readAt: new Date() },
  });
  if (r.count === 0) throw notFound('Notification');
  res.status(204).end();
});
