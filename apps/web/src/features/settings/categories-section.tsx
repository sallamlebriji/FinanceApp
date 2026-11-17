import { CATEGORY_ICONS, type CategoryDTO } from '@mizan/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { CATEGORY_ICON_MAP, CategoryIcon } from '@/components/ui/category-icon';
import { Confirm } from '@/components/ui/confirm';
import { Field, Input, Select } from '@/components/ui/field';
import { Segmented } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { useCategories, useCategoryMutations } from '@/features/transactions/api';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/format';
import { SettingsSection } from './settings-ui';

const COLORS = ['#E8853D', '#3B82C4', '#8A63D2', '#D9506A', '#C2569B', '#D6A21E', '#2E9C8F', '#2E9E62', '#5A6ACF', '#7D8590'];

function CategorySheet({
  open,
  onOpenChange,
  category,
  type,
  parents,
}: {
  open: boolean;
  onOpenChange(o: boolean): void;
  category: CategoryDTO | null;
  type: 'EXPENSE' | 'INCOME';
  parents: CategoryDTO[];
}) {
  const { save } = useCategoryMutations();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>('dots');
  const [color, setColor] = useState(COLORS[0]!);
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setIcon(category?.icon ?? 'dots');
    setColor(category?.color ?? COLORS[0]!);
    setParentId(category?.parentId ?? '');
    setError(undefined);
  }, [open, category]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Enter a name');
    try {
      await save.mutateAsync({
        id: category?.id,
        data: category ? { name: name.trim(), icon, color, parentId: parentId || null } : { name: name.trim(), icon, color, type, parentId: parentId || null },
      });
      toast.success(category ? 'Category updated' : 'Category added');
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={category ? 'Edit category' : `New ${type === 'INCOME' ? 'income' : 'expense'} category`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" form="category-form" loading={save.isPending}>
            {category ? 'Save changes' : 'Add category'}
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex items-center gap-3">
          <CategoryIcon icon={icon} color={color} size="lg" />
          <Field label="Name" error={error} className="flex-1">
            {(p) => <Input {...p} autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />}
          </Field>
        </div>
        <Field label="Inside (optional)" hint="Make it a subcategory. Budgets and reports roll it up into the parent.">
          {(p) => (
            <Select {...p} value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">None — top level</option>
              {parents
                .filter((c) => c.id !== category?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          )}
        </Field>
        <fieldset>
          <legend className="mb-2 text-subhead font-medium text-label-2">Icon</legend>
          <div className="grid grid-cols-8 gap-1">
            {CATEGORY_ICONS.map((k) => {
              const Icon = CATEGORY_ICON_MAP[k]!;
              return (
                <button
                  key={k}
                  type="button"
                  aria-label={k}
                  aria-pressed={icon === k}
                  onClick={() => setIcon(k)}
                  className={cn('flex size-10 items-center justify-center rounded-lg text-label-2 hover:bg-fill', icon === k && 'bg-accent-soft text-accent')}
                >
                  <Icon className="size-[18px]" aria-hidden />
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-subhead font-medium text-label-2">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={cn('size-8 rounded-full ring-offset-2 ring-offset-[var(--surface)]', color === c && 'ring-2 ring-[var(--label)]')}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </fieldset>
      </form>
    </Sheet>
  );
}

export function CategoriesSection() {
  const { data = [] } = useCategories();
  const { remove } = useCategoryMutations();
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [sheet, setSheet] = useState<{ open: boolean; category: CategoryDTO | null }>({ open: false, category: null });
  const [confirm, setConfirm] = useState<CategoryDTO | null>(null);

  const ofType = data.filter((c) => c.type === type);
  const top = ofType.filter((c) => !c.parentId);
  const childrenOf = (id: string) => ofType.filter((c) => c.parentId === id);

  const row = (c: CategoryDTO, nested = false) => (
    <li key={c.id} className={cn('flex min-h-12 items-center gap-3 py-1.5 pr-3', nested ? 'pl-14' : 'pl-5')}>
      <CategoryIcon icon={c.icon} color={c.color} size="sm" />
      <span className="flex-1 truncate text-body">{c.name}</span>
      <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={`Edit ${c.name}`} onClick={() => setSheet({ open: true, category: c })}>
        <Pencil className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" className="rounded-full hover:text-negative" aria-label={`Delete ${c.name}`} onClick={() => setConfirm(c)}>
        <Trash2 className="size-4" />
      </Button>
    </li>
  );

  return (
    <SettingsSection id="categories" title="Categories" footer="Deleting a category keeps its transactions; they become uncategorised.">
      <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
        <Segmented<'EXPENSE' | 'INCOME'>
          label="Category type"
          value={type}
          onChange={(v) => setType(v)}
          options={[
            { value: 'EXPENSE' as const, label: 'Spending' },
            { value: 'INCOME' as const, label: 'Income' },
          ]}
        />
        <Button variant="plain" size="sm" onClick={() => setSheet({ open: true, category: null })}>
          <Plus className="size-4" aria-hidden /> Add
        </Button>
      </div>
      <ul className="divide-y divide-[var(--separator)]">
        {top.map((c) => [row(c), ...childrenOf(c.id).map((ch) => row(ch, true))])}
      </ul>
      <CategorySheet open={sheet.open} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))} category={sheet.category} type={type} parents={top} />
      <Confirm
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete “${confirm?.name}”?`}
        message="Transactions in this category will stay, without a category. Budgets for it will be removed."
        confirmLabel="Delete category"
        loading={remove.isPending}
        onConfirm={() =>
          confirm &&
          remove.mutate(confirm.id, {
            onSuccess: () => {
              toast.success('Category deleted');
              setConfirm(null);
            },
            onError: (e) => {
              toast.error(errorMessage(e));
              setConfirm(null);
            },
          })
        }
      />
    </SettingsSection>
  );
}
