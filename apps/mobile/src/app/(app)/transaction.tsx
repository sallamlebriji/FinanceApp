import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  positiveAmountSchema,
  type TransactionCreateInput,
  type TransactionUpdateInput,
} from '@mizan/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { Copy, Trash2 } from 'lucide-react-native';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { CategoryIcon } from '@/components/category-icon';
import { SheetHeader } from '@/components/sheet-header';
import { Button, Chip, ErrorState, Field, Loading, Segmented, Txt } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAccounts, useCategories, useDeleteTransaction, useDuplicateTransaction, useSaveTransaction, useTransaction } from '@/lib/data';
import { shiftDays, toInputAmount, useLocale, useToday } from '@/lib/format';
import { confirmDestructive, hapticSuccess, notify } from '@/lib/native';
import { noOutline, radius, space, type, useColors } from '@/theme';

type Kind = 'EXPENSE' | 'INCOME' | 'TRANSFER';
const KINDS: { value: Kind; label: string }[] = [
  { value: 'EXPENSE', label: 'Expense' },
  { value: 'INCOME', label: 'Income' },
  { value: 'TRANSFER', label: 'Transfer' },
];

interface Form {
  type: Kind;
  amount: string;
  toAmount: string;
  description: string;
  categoryId: string;
  accountId: string;
  toAccountId: string;
  date: string;
  paymentMethod: string;
  note: string;
}
type Errors = Partial<Record<keyof Form, string>>;

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function TransactionSheet() {
  const params = useLocalSearchParams<{ id?: string; type?: Kind; accountId?: string }>();
  const editingId = params.id;
  const existing = useTransaction(editingId);
  const accounts = useAccounts();
  const locale = useLocale();

  if (editingId && existing.isPending) return <Loading />;
  if (editingId && existing.isError) return <ErrorState message={errorMessage(existing.error)} onRetry={() => existing.refetch()} />;
  if (accounts.isPending) return <Loading />;

  const tx = existing.data;
  return (
    <Composer
      key={tx?.id ?? 'new'}
      editingId={editingId}
      initial={
        tx
          ? {
              type: tx.type,
              amount: toInputAmount(tx.amount, locale),
              toAmount: tx.toAmount ? toInputAmount(tx.toAmount, locale) : '',
              description: tx.description,
              categoryId: tx.categoryId ?? '',
              accountId: tx.accountId,
              toAccountId: tx.toAccountId ?? '',
              date: tx.date,
              paymentMethod: tx.paymentMethod ?? '',
              note: tx.note ?? '',
            }
          : {
              type: params.type ?? 'EXPENSE',
              accountId: params.accountId ?? accounts.data?.[0]?.id ?? '',
            }
      }
    />
  );
}

function Composer({ editingId, initial }: { editingId?: string; initial: Partial<Form> }) {
  const c = useColors();
  const today = useToday();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const save = useSaveTransaction();
  const remove = useDeleteTransaction();
  const duplicate = useDuplicateTransaction();

  const [f, setF] = useState<Form>({
    type: 'EXPENSE',
    amount: '',
    toAmount: '',
    description: '',
    categoryId: '',
    accountId: '',
    toAccountId: '',
    date: today,
    paymentMethod: '',
    note: '',
    ...initial,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [customDate, setCustomDate] = useState(f.date !== today && f.date !== shiftDays(today, -1));
  const [more, setMore] = useState(!!(f.note || f.paymentMethod));
  const [amountFocused, setAmountFocused] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!f.accountId && accounts[0]) set('accountId', accounts[0].id);
  }, [accounts, f.accountId]);

  const from = accounts.find((a) => a.id === f.accountId);
  const to = accounts.find((a) => a.id === f.toAccountId);
  const crossCurrency = f.type === 'TRANSFER' && !!from && !!to && from.currency !== to.currency;
  const visibleCategories = useMemo(() => categories.filter((x) => x.type === f.type && !x.parentId), [categories, f.type]);

  function validate(): boolean {
    const e: Errors = {};
    if (!positiveAmountSchema.safeParse(f.amount).success) e.amount = 'Enter an amount greater than zero, with up to 2 decimals.';
    if (!f.description.trim()) e.description = 'Add a short description.';
    if (!f.accountId) e.accountId = 'Choose an account.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) e.date = 'Use the format YYYY-MM-DD.';
    if (f.type === 'TRANSFER') {
      if (!f.toAccountId) e.toAccountId = 'Choose where the money goes.';
      else if (f.toAccountId === f.accountId) e.toAccountId = 'Choose a different account.';
      if (crossCurrency && !positiveAmountSchema.safeParse(f.toAmount).success) e.toAmount = `Enter the amount received in ${to?.currency}.`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    const common = {
      amount: f.amount,
      date: f.date,
      accountId: f.accountId,
      description: f.description.trim(),
      note: f.note.trim() || null,
      paymentMethod: (f.paymentMethod || null) as TransactionCreateInput['paymentMethod'],
    };
    const data: TransactionCreateInput | TransactionUpdateInput = editingId
      ? f.type === 'TRANSFER'
        ? { ...common, toAccountId: f.toAccountId, toAmount: crossCurrency ? f.toAmount : null }
        : { ...common, categoryId: f.categoryId || null }
      : f.type === 'TRANSFER'
        ? { ...common, type: 'TRANSFER', toAccountId: f.toAccountId, toAmount: crossCurrency ? f.toAmount : null }
        : { ...common, type: f.type, categoryId: f.categoryId || null };
    try {
      await save.mutateAsync({ id: editingId, data });
      hapticSuccess();
      close();
    } catch (e) {
      setErrors({ amount: errorMessage(e) });
    }
  }

  async function onDelete() {
    if (!editingId) return;
    const ok = await confirmDestructive('Delete this transaction?', 'Balances and budgets will be recalculated. This can’t be undone.', 'Delete');
    if (!ok) return;
    try {
      await remove.mutateAsync(editingId);
      close();
    } catch (e) {
      notify('Couldn’t delete', errorMessage(e));
    }
  }

  async function onDuplicate() {
    if (!editingId) return;
    try {
      await duplicate.mutateAsync(editingId);
      hapticSuccess();
      close();
    } catch (e) {
      notify('Couldn’t duplicate', errorMessage(e));
    }
  }

  const currency = from?.currency ?? 'MAD';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SheetHeader
        title={editingId ? 'Edit Transaction' : 'New Transaction'}
        onCancel={close}
        onConfirm={submit}
        busy={save.isPending}
        confirmLabel={editingId ? 'Save' : 'Add'}
      />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 48 }}>
        {editingId ? null : (
          <Segmented
            label="Transaction type"
            value={f.type}
            options={KINDS}
            onChange={(v) => setF((s) => ({ ...s, type: v, categoryId: '' }))}
          />
        )}

        {/* Amount — the one large field: what people came here to type. */}
        <View style={{ gap: space.xs }}>
          <Txt variant="subhead" tone="label2" weight="500">
            Amount
          </Txt>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: c.surface,
              borderRadius: radius.card,
              paddingHorizontal: space.lg,
              borderWidth: 1.5,
              borderColor: errors.amount ? c.negative : amountFocused ? c.accent : c.surface,
            }}
          >
            <TextInput
              value={f.amount}
              onChangeText={(v) => set('amount', v.replace(/[^\d.,]/g, ''))}
              placeholder="0,00"
              placeholderTextColor={c.label3}
              keyboardType="decimal-pad"
              autoFocus={!editingId}
              onFocus={() => setAmountFocused(true)}
              onBlur={() => setAmountFocused(false)}
              accessibilityLabel={`Amount in ${currency}`}
              accessibilityHint={errors.amount}
              style={[type.title1, noOutline, { flex: 1, minWidth: 0, color: c.label, paddingVertical: space.md, fontVariant: ['tabular-nums'] }]}
            />
            <Txt variant="title3" tone="label3">
              {currency}
            </Txt>
          </View>
          {errors.amount ? (
            <Txt variant="footnote" tone="negative" accessibilityRole="alert">
              {errors.amount}
            </Txt>
          ) : null}
        </View>

        <Field
          label="Description"
          value={f.description}
          onChangeText={(v) => set('description', v)}
          placeholder={f.type === 'INCOME' ? 'Salary, refund…' : f.type === 'TRANSFER' ? 'Move to savings…' : 'Groceries, taxi…'}
          error={errors.description}
          maxLength={140}
          returnKeyType="done"
        />

        {f.type !== 'TRANSFER' ? (
          <ChoiceGroup label="Category">
            <Chip label="None" selected={!f.categoryId} onPress={() => set('categoryId', '')} />
            {visibleCategories.map((cat) => (
              <Chip
                key={cat.id}
                label={cat.name}
                selected={f.categoryId === cat.id}
                onPress={() => set('categoryId', cat.id)}
                leading={<CategoryIcon icon={cat.icon} color={cat.color} size={22} />}
              />
            ))}
          </ChoiceGroup>
        ) : null}

        <ChoiceGroup label={f.type === 'TRANSFER' ? 'From' : 'Account'} error={errors.accountId}>
          {accounts.map((a) => (
            <Chip key={a.id} label={`${a.name} · ${a.currency}`} selected={f.accountId === a.id} onPress={() => set('accountId', a.id)} />
          ))}
        </ChoiceGroup>

        {f.type === 'TRANSFER' ? (
          <>
            <ChoiceGroup label="To" error={errors.toAccountId}>
              {accounts
                .filter((a) => a.id !== f.accountId)
                .map((a) => (
                  <Chip key={a.id} label={`${a.name} · ${a.currency}`} selected={f.toAccountId === a.id} onPress={() => set('toAccountId', a.id)} />
                ))}
            </ChoiceGroup>
            {crossCurrency ? (
              <Field
                label={`Amount received (${to?.currency})`}
                value={f.toAmount}
                onChangeText={(v) => set('toAmount', v.replace(/[^\d.,]/g, ''))}
                keyboardType="decimal-pad"
                error={errors.toAmount}
                hint="The exchange rate is recorded from the two amounts."
              />
            ) : null}
          </>
        ) : null}

        <ChoiceGroup label="Date" error={errors.date}>
          <Chip
            label="Today"
            selected={!customDate && f.date === today}
            onPress={() => {
              setCustomDate(false);
              set('date', today);
            }}
          />
          <Chip
            label="Yesterday"
            selected={!customDate && f.date === shiftDays(today, -1)}
            onPress={() => {
              setCustomDate(false);
              set('date', shiftDays(today, -1));
            }}
          />
          <Chip label="Other Date" selected={customDate} onPress={() => setCustomDate(true)} />
        </ChoiceGroup>
        {customDate ? (
          <Field
            label="Date (YYYY-MM-DD)"
            value={f.date}
            onChangeText={(v) => set('date', v.trim())}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            autoCorrect={false}
          />
        ) : null}

        {more ? (
          <>
            <ChoiceGroup label="Payment method">
              <Chip label="Not set" selected={!f.paymentMethod} onPress={() => set('paymentMethod', '')} />
              {PAYMENT_METHODS.map((m) => (
                <Chip key={m} label={PAYMENT_METHOD_LABELS[m]} selected={f.paymentMethod === m} onPress={() => set('paymentMethod', m)} />
              ))}
            </ChoiceGroup>
            <Field
              label="Note"
              value={f.note}
              onChangeText={(v) => set('note', v)}
              multiline
              maxLength={1000}
              style={{ minHeight: 88, textAlignVertical: 'top', paddingTop: space.md }}
            />
          </>
        ) : (
          <Button title="Add Note or Payment Method" variant="plain" onPress={() => setMore(true)} />
        )}

        {editingId ? (
          <View style={{ gap: space.md }}>
            <Button title="Duplicate" icon={Copy} variant="secondary" onPress={onDuplicate} loading={duplicate.isPending} />
            <Button title="Delete Transaction" icon={Trash2} variant="destructive" onPress={onDelete} loading={remove.isPending} />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ChoiceGroup({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Txt variant="subhead" tone="label2" weight="500">
        {label}
      </Txt>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {children}
      </View>
      {error ? (
        <Txt variant="footnote" tone="negative" accessibilityRole="alert">
          {error}
        </Txt>
      ) : null}
    </View>
  );
}
