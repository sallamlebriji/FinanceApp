import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { uid } from '../../middleware/auth';
import { reportPdf, reportXlsx } from './reports.export';
import { getReport } from './reports.service';

export const reportsRouter = Router();

reportsRouter.get('/', async (req, res) => {
  res.json(await getReport(uid(req), req.query));
});

async function context(userId: string) {
  const [user, settings] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } }),
    prisma.userSettings.findUniqueOrThrow({ where: { userId }, select: { locale: true } }),
  ]);
  return { name: user.name, locale: settings.locale };
}

reportsRouter.get('/export.xlsx', async (req, res) => {
  const userId = uid(req);
  const report = await getReport(userId, req.query);
  const buf = await reportXlsx(userId, report);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="mizan-report-${report.range.from}-${report.range.to}.xlsx"`);
  res.send(buf);
});

reportsRouter.get('/export.pdf', async (req, res) => {
  const userId = uid(req);
  const report = await getReport(userId, req.query);
  const buf = await reportPdf(report, await context(userId));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="mizan-report-${report.range.from}-${report.range.to}.pdf"`);
  res.send(buf);
});
