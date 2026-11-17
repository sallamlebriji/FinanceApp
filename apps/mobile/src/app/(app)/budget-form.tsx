import { positiveAmountSchema, SUPPORTED_CURRENCIES, type BudgetDTO, type Currency } from '@mizan/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { CategoryIcon } from '@/components/category-icon';
import { SheetHeader } from '@/components/sheet-header';
import { Button, Chip, Field, Loading, Segmented, Txt } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useBudgets, useCategories, useDeleteBudget, useSaveBudget } from '@/lib/data';
import { toInputAmount, useLocale } from '@/lib/format';
import { confirmDestructive, hapticSuccess, notify } from '@/lib/native';
import { useAuth } from '@/stores/auth';
import { space, useColors } from '@/theme';

const close = () => (router.canGoBack() ? router.back() : router.replace('/budgets'));

export default function BudgetForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const budgets = useBudgets();
  if (id && budgets.isPending) return <Loading />;
  const existing = budgets.data?.find((b) => b.id === id);
  return <Form key={existing?.id ?? 'new'} existing={existing} />;
}

function Form({ existing }: { existing?: BudgetDTO }) {
  const c = useColors();
  const locale = useLocale();
  const base = useAuth((s) => s.settings?.baseCurrency ?? 'MAD');
  const { data: categories = [] } = useCategories();
  const save = useSaveBudget();
  const remove = useDeleteBudget();
  const [name, setName] = useState(existing?.name ?? '');
  const [period, setPeriod] = useState<'MONTHLY' | 'WEEKLY'>(existing?.period ?? 'MONTHLY');
  const [amount, setAmount] = useState(existing?.amount ? toInputAmount(existing?.amount, locale) : '');
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? base);
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? '');
  const [errors, setErrors] = useState<{ name?: string; amount?: string; form?: string }>({});
  const expenseCategories = categories.filter((x) => x.type === 'EXPENSE' && !x.parentId);

  async function submit() {
    const e: typeof errors = {};
    const finalName = name.trim() || categories.find((x) => x.id === categoryId)?.name || '';
    if (!finalName) e.name = 'Enter a name.';
    if (!positiveAmountSchema.safeParse(amount).success) e.amount = 'Enter an amount greater than zero.';
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      await save.mutateAsync({ id: existing?.id, data: { name: finalName, period, amount, currency, categoryId: categoryId || null } });
      hapticSuccess();
      close();
    } catch (err) {
      setErrors({ form: errorMessage(err) });
    }
  }

  async function onDelete() {
    if (!existing) return;
    const ok = await confirmDestructive(`Delete “${existing.name}”?`, 'Your transactions stay as they are. This can’t be undone.', 'Delete');
    if (!ok) return;
    try {
      await remove.mutateAsync(existing.id);
      close();
    } catch (err) {
      notify('Couldn’t delete', errorMessage(err));
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SheetHeader title={existing ? 'Edit Budget' : 'New Budget'} onCancel={close} onConfirm={submit} busy={save.isPending} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 48 }}>
        <View style={{ gap: space.sm }}>
          <Txt variant="subhead" tone="label2" weight="500">
            Category
          </Txt>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Chip label="All spending" selected={!categoryId} onPress={() => setCategoryId('')} />
            {expenseCategories.map((cat) => (
              <Chip
                key={cat.id}
                label={cat.name}
                selected={categoryId === cat.id}
                onPress={() => setCategoryId(cat.id)}
                leading={<CategoryIcon icon={cat.icon} color={cat.color} size={22} />}
              />
            ))}
          </View>
        </View>

        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          error={errors.name}
          placeholder={categories.find((x) => x.id === categoryId)?.name ?? 'Everyday spending'}
          hint={categoryId ? 'Leave empty to use the category name.' : undefined}
          maxLength={60}
        />

        <View style={{ gap: space.sm }}>
          <Txt variant="subhead" tone="label2" weight="500">
            Resets every
          </Txt>
          <Segmented
            label="Budget period"
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'MONTHLY', label: 'Month' },
              { value: 'WEEKLY', label: 'Week' },
            ]}
          />
        </View>

        <Field
          label={`Limit (${currency})`}
          value={amount}
          onChangeText={(v) => setAmount(v.replace(/[^\d.,]/g, ''))}
          keyboardType="decimal-pad"
          placeholder="0,00"
          error={errors.amount}
        />

        <View style={{ gap: space.sm }}>
          <Txt variant="subhead" tone="label2" weight="500">
            Currency
          </Txt>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: space.sm }}>
            {SUPPORTED_CURRENCIES.map((cur) => (
              <Chip key={cur} label={cur} selected={currency === cur} onPress={() => setCurrency(cur)} />
            ))}
          </View>
        </View>

        {errors.form ? (
          <Txt variant="subhead" tone="negative" accessibilityRole="alert">
            {errors.form}
          </Txt>
        ) : null}

        {existing ? <Button title="Delete Budget" icon={Trash2} variant="destructive" onPress={onDelete} loading={remove.isPending} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
