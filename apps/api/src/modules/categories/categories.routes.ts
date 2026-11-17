import { categoryCreateSchema, categoryUpdateSchema, type CategoryDTO } from '@mizan/shared';
import { Router } from 'express';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { prisma, type Category } from '../../lib/prisma';
import { uid } from '../../middleware/auth';

export const toCategoryDTO = (c: Category): CategoryDTO => ({
  id: c.id,
  name: c.name,
  type: c.type,
  icon: c.icon,
  color: c.color,
  parentId: c.parentId,
  isDefault: c.isDefault,
});

/** Validates that a parent exists, belongs to the user, shares the type and is top-level (max 2 levels). */
async function assertValidParent(userId: string, parentId: string, type: 'INCOME' | 'EXPENSE', selfId?: string) {
  if (parentId === selfId) throw badRequest('A category cannot be its own parent');
  const parent = await prisma.category.findFirst({ where: { id: parentId, userId } });
  if (!parent) throw notFound('Parent category');
  if (parent.type !== type) throw badRequest('A subcategory must have the same type as its parent');
  if (parent.parentId) throw badRequest('Subcategories can only be one level deep');
}

export const categoriesRouter = Router();

categoriesRouter.get('/', async (req, res) => {
  const rows = await prisma.category.findMany({
    where: { userId: uid(req) },
    orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
  });
  res.json({ items: rows.map(toCategoryDTO) });
});

categoriesRouter.post('/', async (req, res) => {
  const userId = uid(req);
  const input = categoryCreateSchema.parse(req.body);
  if (input.parentId) await assertValidParent(userId, input.parentId, input.type);
  const dup = await prisma.category.findFirst({
    where: { userId, type: input.type, name: input.name, parentId: input.parentId ?? null },
  });
  if (dup) throw conflict('A category with this name already exists');
  const c = await prisma.category.create({ data: { ...input, parentId: input.parentId ?? null, userId } });
  res.status(201).json(toCategoryDTO(c));
});

categoriesRouter.patch('/:id', async (req, res) => {
  const userId = uid(req);
  const id = String(req.params.id);
  const current = await prisma.category.findFirst({ where: { id, userId } });
  if (!current) throw notFound('Category');
  const input = categoryUpdateSchema.parse(req.body);
  if (input.parentId) {
    await assertValidParent(userId, input.parentId, current.type, id);
    const hasChildren = await prisma.category.count({ where: { parentId: id } });
    if (hasChildren) throw badRequest('A category with subcategories cannot become a subcategory');
  }
  const c = await prisma.category.update({ where: { id }, data: input });
  res.json(toCategoryDTO(c));
});

/**
 * Deleting a category keeps its transactions (they become uncategorised) unless
 * `reassignTo` is provided. Subcategories must be removed or moved first.
 */
categoriesRouter.delete('/:id', async (req, res) => {
  const userId = uid(req);
  const id = String(req.params.id);
  const current = await prisma.category.findFirst({ where: { id, userId } });
  if (!current) throw notFound('Category');
  const children = await prisma.category.count({ where: { parentId: id } });
  if (children) throw conflict('Move or delete its subcategories first');
  const reassignTo = typeof req.query.reassignTo === 'string' ? req.query.reassignTo : undefined;
  if (reassignTo) {
    const target = await prisma.category.findFirst({ where: { id: reassignTo, userId, type: current.type } });
    if (!target || target.id === id) throw badRequest('Choose another category of the same type');
  }
  await prisma.$transaction([
    prisma.transaction.updateMany({ where: { userId, categoryId: id }, data: { categoryId: reassignTo ?? null } }),
    prisma.category.delete({ where: { id } }),
  ]);
  res.status(204).end();
});
