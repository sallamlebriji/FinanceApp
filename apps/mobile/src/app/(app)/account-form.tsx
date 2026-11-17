import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES, amountSchema, SUPPORTED_CURRENCIES, type AccountType, type Currency } from '@mizan/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Switch, View } from 'react-native';
import { SheetHeader } from '@/components/sheet-header';
import { Button, Chip, Field, Loading, Txt } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { useAccounts, useDeleteAccount, useSaveAccount } from '@/lib/data';
import { toInputAmount, useLocale } from '@/lib/format';
import { confirmDestructive, hapticSuccess, notify } from '@/lib/native';
import { space, useColors } from '@/theme';

const COLORS = [
  { value: '#4B3FD1', name: 'Majorelle' },
  { value: '#18794A', name: 'Green' },
  { value: '#C2362B', name: 'Red' },
  { value: '#9A5A00', name: 'Amber' },
  { value: '#0E7490', name: 'Teal' },
  { value: '#7C3AED', name: 'Violet' },
  { value: '#BE185D', name: 'Rose' },
  { value: '#55555F', name: 'Graphite' },
];

const close = () => (router.canGoBack() ? router.back() : router.replace('/accounts'));

export default function AccountForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const accounts = useAccounts(true);
  if (id && accounts.isPending) return <Loading />;
  const existing = accounts.data?.find((a) => a.id === id);
  return <Form key={existing?.id ?? 'new'} existing={existing} />;
}

function Form({ existing }: { existing?: NonNullable<ReturnType<typeof useAccounts>['data']>[number] }) {
  const c = useColors();
  const locale = useLocale();
  const save = useSaveAccount();
  const remove = useDeleteAccount();
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<AccountType>(existing?.type ?? 'BANK');
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? 'MAD');
  const [opening, setOpening] = useState(existing?.openingBalance ? toInputAmount(existing?.openingBalance, locale) : '');
  const [institution, setInstitution] = useState(existing?.institution ?? '');
  const [color, setColor] = useState(existing?.color ?? COLORS[0]!.value);
  const [inNetWorth, setInNetWorth] = useState(existing?.includeInNetWorth ?? true);
  const [errors, setErrors] = useState<{ name?: string; opening?: string; form?: string }>({});

  async function submit() {
    const e: typeof errors = {};
    if (!name.trim()) e.name = 'Enter a name.';
    if (opening && !amountSchema.safeParse(opening).success) e.opening = 'Enter a number with up to 2 decimals.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const common = {
      name: name.trim(),
      type: kind,
      openingBalance: opening || '0',
      color,
      institution: institution.trim() || null,
      includeInNetWorth: inNetWorth,
    };
    try {
      await save.mutateAsync({ id: existing?.id, data: existing ? common : { ...common, currency } });
      hapticSuccess();
      close();
    } catch (err) {
      setErrors({ form: errorMessage(err) });
    }
  }

  async function toggleArchive() {
    if (!existing) return;
    try {
      await save.mutateAsync({ id: existing.id, data: { isArchived: !existing.isArchived } });
      close();
    } catch (err) {
      notify('Couldn’t update the account', errorMessage(err));
    }
  }

  async function onDelete() {
    if (!existing) return;
    const ok = await confirmDestructive(`Delete “${existing.name}”?`, 'This can’t be undone.', 'Delete');
    if (!ok) return;
    try {
      await remove.mutateAsync(existing.id);
      router.replace('/accounts');
    } catch (err) {
      // Accounts with history can't be deleted — the API explains and we offer Archive instead.
      notify('Account kept', err instanceof ApiError && err.status === 409 ? err.message : errorMessage(err));
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SheetHeader title={existing ? 'Edit Account' : 'New Account'} onCancel={close} onConfirm={submit} busy={save.isPending} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 48 }}>
        <Field label="Name" value={name} onChangeText={setName} error={errors.name} placeholder="Attijariwafa current account" maxLength={60} />

        <View style={{ gap: space.sm }}>
          <Txt variant="subhead" tone="label2" weight="500">
            Type
          </Txt>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {ACCOUNT_TYPES.map((t) => (
              <Chip key={t} label={ACCOUNT_TYPE_LABELS[t]} selected={kind === t} onPress={() => setKind(t)} />
            ))}
          </View>
        </View>

        {existing ? (
          <Txt variant="footnote" tone="label3">
            Currency: {existing.currency} (can’t be changed once the account exists).
          </Txt>
        ) : (
          <View style={{ gap: space.sm }}>
            <Txt variant="subhead" tone="label2" weight="500">
              Currency
            </Txt>
            <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {SUPPORTED_CURRENCIES.map((cur) => (
                <Chip key={cur} label={cur} selected={currency === cur} onPress={() => setCurrency(cur)} />
              ))}
            </View>
          </View>
        )}

        <Field
          label={`Opening balance (${existing?.currency ?? currency})`}
          value={opening}
          onChangeText={(v) => setOpening(v.replace(/[^\d.,-]/g, ''))}
          keyboardType="numbers-and-punctuation"
          placeholder="0,00"
          error={errors.opening}
          hint="What the account held before the first transaction you record."
        />
        <Field label="Bank or institution (optional)" value={institution} onChangeText={setInstitution} maxLength={80} />

        <View style={{ gap: space.sm }}>
          <Txt variant="subhead" tone="label2" weight="500">
            Colour
          </Txt>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {COLORS.map((col) => (
              <Chip
                key={col.value}
                label={col.name}
                selected={color.toLowerCase() === col.value.toLowerCase()}
                onPress={() => setColor(col.value)}
                leading={<View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: col.value }} />}
              />
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Txt>Include in net worth</Txt>
            <Txt variant="footnote" tone="label3">
              Turn off for accounts you only track, like a shared pot.
            </Txt>
          </View>
          <Switch
            value={inNetWorth}
            onValueChange={setInNetWorth}
            accessibilityLabel="Include in net worth"
            trackColor={{ true: c.accent, false: c.fillStrong }}
          />
        </View>

        {errors.form ? (
          <Txt variant="subhead" tone="negative" accessibilityRole="alert">
            {errors.form}
          </Txt>
        ) : null}

        {existing ? (
          <View style={{ gap: space.md }}>
            <Button
              title={existing.isArchived ? 'Restore Account' : 'Archive Account'}
              icon={existing.isArchived ? ArchiveRestore : Archive}
              variant="secondary"
              onPress={toggleArchive}
              accessibilityHint="Archived accounts keep their history but leave lists and pickers"
            />
            <Button title="Delete Account" icon={Trash2} variant="destructive" onPress={onDelete} loading={remove.isPending} />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
