import { formatMoney, type Currency, type ReportDTO } from '@mizan/shared';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { prisma } from '../../lib/prisma';
import { dateValue, isoDate } from '../../lib/serialize';

const MONTHS_FMT = (locale: string) => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
const DAY_FMT = (locale: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const n = (v: string) => Number(v);
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

/* ---------- XLSX ---------- */

/**
 * Workbook with real numbers (not text) so people can keep calculating: Summary, Monthly,
 * Categories, Payees, and every transaction in the period. Amounts carry a 2-dp number format;
 * transfers and debt movements are listed but flagged, matching how reports treat them.
 */
export async function reportXlsx(userId: string, r: ReportDTO): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Mizan';
  wb.created = new Date();
  const money = '#,##0.00';
  const header = (ws: ExcelJS.Worksheet) => {
    const row = ws.getRow(1);
    row.font = { bold: true };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEBFA' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  };

  const sum = wb.addWorksheet('Summary');
  sum.columns = [
    { header: 'Figure', key: 'k', width: 30 },
    { header: `This period (${r.baseCurrency})`, key: 'v', width: 22, style: { numFmt: money } },
    { header: `Previous period (${r.baseCurrency})`, key: 'p', width: 24, style: { numFmt: money } },
  ];
  header(sum);
  sum.addRows([
    { k: 'Period', v: `${r.range.from} → ${r.range.to}`, p: `${r.previousRange.from} → ${r.previousRange.to}` },
    { k: 'Income', v: n(r.totals.income), p: n(r.previousTotals.income) },
    { k: 'Spending', v: n(r.totals.expense), p: n(r.previousTotals.expense) },
    { k: 'Net cash flow', v: n(r.totals.net), p: n(r.previousTotals.net) },
    { k: 'Savings rate (%)', v: r.totals.savingsRate === null ? '—' : n(r.totals.savingsRate) },
    { k: 'Average daily spending', v: n(r.totals.averageDailySpend) },
    { k: 'Transactions', v: r.totals.transactionCount },
  ]);
  sum.getCell('B6').numFmt = '0.0';
  sum.getCell('B8').numFmt = '0';
  if (r.totals.unconverted.length) {
    sum.addRow({ k: `Not converted (no exchange rate): ${r.totals.unconverted.join(', ')}` });
  }

  const mon = wb.addWorksheet('Monthly');
  mon.columns = [
    { header: 'Month', key: 'm', width: 14 },
    { header: 'Income', key: 'i', width: 16, style: { numFmt: money } },
    { header: 'Spending', key: 'e', width: 16, style: { numFmt: money } },
    { header: 'Net', key: 'n', width: 16, style: { numFmt: money } },
  ];
  header(mon);
  for (const m of r.monthly) mon.addRow({ m: m.month, i: n(m.income), e: n(m.expense), n: n(m.net) });

  const cat = wb.addWorksheet('Categories');
  cat.columns = [
    { header: 'Type', key: 't', width: 10 },
    { header: 'Category', key: 'c', width: 26 },
    { header: `Amount (${r.baseCurrency})`, key: 'a', width: 18, style: { numFmt: money } },
    { header: 'Share (%)', key: 's', width: 12, style: { numFmt: '0.0' } },
    { header: `Previous period (${r.baseCurrency})`, key: 'p', width: 24, style: { numFmt: money } },
  ];
  header(cat);
  for (const c of r.expenseByCategory) cat.addRow({ t: 'Expense', c: c.name, a: n(c.amount), s: n(c.percent), p: n(c.previous) });
  for (const c of r.incomeByCategory) cat.addRow({ t: 'Income', c: c.name, a: n(c.amount), s: n(c.percent) });

  const pay = wb.addWorksheet('Payees');
  pay.columns = [
    { header: 'Description', key: 'd', width: 34 },
    { header: 'Transactions', key: 'c', width: 14 },
    { header: `Spent (${r.baseCurrency})`, key: 'a', width: 18, style: { numFmt: money } },
  ];
  header(pay);
  for (const p of r.topPayees) pay.addRow({ d: p.description, c: p.count, a: n(p.amount) });

  const txs = await prisma.transaction.findMany({
    where: { userId, date: { gte: dateValue(r.range.from), lte: dateValue(r.range.to) } },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    include: { category: { select: { name: true } }, account: { select: { name: true } }, toAccount: { select: { name: true } } },
    take: 50_000,
  });
  const tx = wb.addWorksheet('Transactions');
  tx.columns = [
    { header: 'Date', key: 'date', width: 12, style: { numFmt: 'yyyy-mm-dd' } },
    { header: 'Type', key: 'type', width: 10 },
    { header: 'Description', key: 'desc', width: 32 },
    { header: 'Category', key: 'cat', width: 20 },
    { header: 'Account', key: 'acc', width: 18 },
    { header: 'To account', key: 'to', width: 18 },
    { header: 'Amount', key: 'amt', width: 14, style: { numFmt: money } },
    { header: 'Currency', key: 'cur', width: 10 },
    { header: 'In reports', key: 'rep', width: 11 },
    { header: 'Note', key: 'note', width: 30 },
  ];
  header(tx);
  for (const t of txs) {
    const signed = t.type === 'INCOME' ? n(t.amount.toString()) : -n(t.amount.toString());
    tx.addRow({
      date: t.date,
      type: t.type === 'INCOME' ? 'Income' : t.type === 'EXPENSE' ? 'Expense' : 'Transfer',
      desc: t.description,
      cat: t.category?.name ?? '',
      acc: t.account.name,
      to: t.toAccount?.name ?? '',
      amt: signed,
      cur: t.currency,
      rep: t.type !== 'TRANSFER' && !t.debtId ? 'Yes' : 'No',
      note: t.note ?? '',
    });
  }
  tx.autoFilter = { from: 'A1', to: 'J1' };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ---------- PDF ---------- */

// The standard PDF fonts only cover WinAnsi: swap the narrow/no-break spaces and the
// minus sign Intl produces for plain equivalents so figures never render as boxes.
const pdfText = (s: string) => s.replace(/[  ]/g, ' ').replace(/−/g, '-');

/** A one-to-two page statement-style summary for the period. */
export function reportPdf(r: ReportDTO, opts: { locale: string; name: string }): Promise<Buffer> {
  const { locale } = opts;
  const fm = (v: string, c: Currency = r.baseCurrency) => pdfText(formatMoney(v, c, { locale }));
  const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, info: { Title: 'Mizan report', Author: 'Mizan' } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const ink = '#1C1C1E';
  const muted = '#6E6E73';
  const accent = '#4B3FD1';
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.fillColor(accent).font('Helvetica-Bold').fontSize(11).text('MIZAN', left, 48);
  doc.fillColor(ink).fontSize(22).text('Financial report', left, 66);
  const df = DAY_FMT(locale);
  doc
    .fillColor(muted)
    .font('Helvetica')
    .fontSize(10)
    .text(pdfText(`${opts.name} · ${df.format(d(r.range.from))} – ${df.format(d(r.range.to))} · amounts in ${r.baseCurrency}`));
  doc.moveDown(1.2);

  // Key figures — four columns.
  const figures: [string, string][] = [
    ['Income', fm(r.totals.income)],
    ['Spending', fm(r.totals.expense)],
    ['Net cash flow', fm(r.totals.net)],
    ['Savings rate', r.totals.savingsRate === null ? '—' : pdfText(new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(Number(r.totals.savingsRate) / 100))],
  ];
  const colW = width / 4;
  const y0 = doc.y;
  figures.forEach(([label, value], i) => {
    doc.fillColor(muted).fontSize(9).text(label, left + i * colW, y0, { width: colW - 8 });
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(13).text(value, left + i * colW, y0 + 13, { width: colW - 8 });
    doc.font('Helvetica');
  });
  doc.y = y0 + 44;
  const busiest = [...r.byWeekday].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
  const weekdayNote = busiest && Number(busiest.amount) > 0 ? ` You spend most on ${WEEKDAYS[busiest.weekday]}s.` : '';
  doc
    .fillColor(muted)
    .fontSize(9)
    .text(
      pdfText(
        `${r.totals.transactionCount} transactions · average spending ${fm(r.totals.averageDailySpend)} a day.${weekdayNote} Transfers between your accounts and debt movements are not counted as income or spending.`,
      ),
      left,
      doc.y,
      { width },
    );
  if (r.totals.unconverted.length) {
    doc.text(`No exchange rate recorded for ${r.totals.unconverted.join(', ')}, so those amounts are left out of the totals.`, { width });
  }

  const table = (title: string, cols: { label: string; w: number; align?: 'left' | 'right' }[], rows: string[][]) => {
    if (!rows.length) return;
    if (doc.y > doc.page.height - 160) doc.addPage();
    doc.moveDown(1.4);
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(12).text(title, left, doc.y);
    doc.moveDown(0.4);
    const drawRow = (cells: string[], bold = false, color = ink) => {
      if (doc.y > doc.page.height - 70) doc.addPage();
      const y = doc.y;
      let x = left;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(color);
      cells.forEach((cell, i) => {
        const c = cols[i]!;
        doc.text(pdfText(cell), x, y, { width: c.w * width - 6, align: c.align ?? 'left', lineBreak: false, ellipsis: true });
        x += c.w * width;
      });
      doc.y = y + 16;
      doc.moveTo(left, doc.y - 3).lineTo(left + width, doc.y - 3).lineWidth(0.5).strokeColor('#E5E5EA').stroke();
    };
    drawRow(cols.map((c) => c.label), true, muted);
    rows.forEach((r) => drawRow(r));
  };

  const pct = (v: string) => pdfText(new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(Number(v) / 100));
  const hasPrevious = r.expenseByCategory.some((c) => Number(c.previous) !== 0);
  table(
    'Spending by category',
    hasPrevious
      ? [
          { label: 'Category', w: 0.4 },
          { label: 'Amount', w: 0.22, align: 'right' },
          { label: 'Share', w: 0.14, align: 'right' },
          { label: 'Previous period', w: 0.24, align: 'right' },
        ]
      : [
          { label: 'Category', w: 0.56 },
          { label: 'Amount', w: 0.26, align: 'right' },
          { label: 'Share', w: 0.18, align: 'right' },
        ],
    r.expenseByCategory.map((c) => [c.name, fm(c.amount), pct(c.percent), ...(hasPrevious ? [fm(c.previous)] : [])]),
  );
  const mf = MONTHS_FMT(locale);
  table(
    'Month by month',
    [
      { label: 'Month', w: 0.34 },
      { label: 'Income', w: 0.22, align: 'right' },
      { label: 'Spending', w: 0.22, align: 'right' },
      { label: 'Net', w: 0.22, align: 'right' },
    ],
    r.monthly.map((m) => [mf.format(d(`${m.month}-01`)), fm(m.income), fm(m.expense), fm(m.net)]),
  );
  table(
    'Where the money went',
    [
      { label: 'Description', w: 0.58 },
      { label: 'Transactions', w: 0.18, align: 'right' },
      { label: 'Spent', w: 0.24, align: 'right' },
    ],
    r.topPayees.map((p) => [p.description, String(p.count), fm(p.amount)]),
  );
  table(
    'Largest expenses',
    [
      { label: 'Date', w: 0.2 },
      { label: 'Description', w: 0.5 },
      { label: 'Amount', w: 0.3, align: 'right' },
    ],
    r.largestExpenses.map((t) => [df.format(d(t.date)), t.description, fm(t.amount, t.currency)]),
  );
  // Footer on every page, drawn inside the bottom margin so it never triggers a page break.
  const footer = pdfText(`Generated by Mizan on ${df.format(new Date(`${isoDate(new Date())}T00:00:00Z`))}`);
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.fillColor(muted).font('Helvetica').fontSize(8).text(`${footer} · page ${i + 1} of ${range.count}`, left, doc.page.height - 32, { width, align: 'center', lineBreak: false });
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  return done;
}
