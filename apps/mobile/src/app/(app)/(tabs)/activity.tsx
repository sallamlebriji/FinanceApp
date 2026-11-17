import type { TransactionDTO } from '@mizan/shared';
import { router } from 'expo-router';
import { Plus, Search } from 'lucide-react-native';
import { useDeferredValue, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TransactionRow } from '@/components/transaction-row';
import { Button, EmptyState, ErrorState, IconButton, Loading, Segmented, Separator, Txt } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useTransactionFeed } from '@/lib/data';
import { dayLabel, useLocale, useToday } from '@/lib/format';
import { minTarget, noOutline, radius, space, type, useColors } from '@/theme';

type Filter = 'ALL' | 'EXPENSE' | 'INCOME' | 'TRANSFER';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'EXPENSE', label: 'Spending' },
  { value: 'INCOME', label: 'Income' },
  { value: 'TRANSFER', label: 'Transfers' },
];

export default function Activity() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const locale = useLocale();
  const today = useToday();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const q = useDeferredValue(search.trim());
  const feed = useTransactionFeed({ q: q || undefined, type: filter === 'ALL' ? undefined : filter });

  const sections = useMemo(() => {
    const out: { title: string; data: TransactionDTO[] }[] = [];
    for (const page of feed.data?.pages ?? []) {
      for (const tx of page.items) {
        const title = dayLabel(tx.date, today, locale);
        const last = out[out.length - 1];
        if (last && last.title === title) last.data.push(tx);
        else out.push({ title, data: [tx] });
      }
    }
    return out;
  }, [feed.data, today, locale]);

  const header = (
    <View style={{ paddingTop: insets.top + space.sm, gap: space.md, paddingBottom: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: minTarget }}>
        <Txt variant="largeTitle" accessibilityRole="header">
          Activity
        </Txt>
        <IconButton icon={Plus} label="New Transaction" onPress={() => router.push('/transaction')} prominent />
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          backgroundColor: c.fill,
          borderRadius: radius.control,
          paddingHorizontal: space.md,
          minHeight: 40,
        }}
      >
        <Search size={18} color={c.label3} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search transactions"
          placeholderTextColor={c.label3}
          accessibilityLabel="Search transactions"
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          style={[type.body, noOutline, { flex: 1, minWidth: 0, color: c.label, paddingVertical: space.sm }]}
        />
      </View>
      <Segmented label="Transaction type" value={filter} options={FILTERS} onChange={setFilter} />
    </View>
  );

  return (
    <SectionList
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, maxWidth: 720, width: '100%', alignSelf: 'center' }}
      sections={sections}
      keyExtractor={(t) => t.id}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={header}
      renderSectionHeader={({ section }) => (
        <Txt variant="footnote" tone="label2" weight="600" accessibilityRole="header" style={{ marginTop: space.lg, marginBottom: space.sm }}>
          {section.title}
        </Txt>
      )}
      renderItem={({ item, index, section }) => (
        <View
          style={{
            backgroundColor: c.surface,
            borderTopLeftRadius: index === 0 ? radius.card : 0,
            borderTopRightRadius: index === 0 ? radius.card : 0,
            borderBottomLeftRadius: index === section.data.length - 1 ? radius.card : 0,
            borderBottomRightRadius: index === section.data.length - 1 ? radius.card : 0,
            overflow: 'hidden',
          }}
        >
          {index > 0 ? <Separator inset={space.lg + 36 + space.md} /> : null}
          <TransactionRow tx={item} />
        </View>
      )}
      ListEmptyComponent={
        feed.isPending ? (
          <Loading />
        ) : feed.isError ? (
          <ErrorState message={errorMessage(feed.error)} onRetry={() => feed.refetch()} />
        ) : q || filter !== 'ALL' ? (
          <EmptyState title="No matches" message="Try another search or show all transaction types." />
        ) : (
          <EmptyState
            title="No transactions yet"
            message="Everything you spend, earn or move between accounts will appear here, newest first."
            action={<Button title="Add Transaction" icon={Plus} onPress={() => router.push('/transaction')} />}
          />
        )
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
      }}
      ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator style={{ marginTop: space.lg }} color={c.label3} /> : undefined}
      refreshControl={<RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={() => void feed.refetch()} tintColor={c.label3} />}
    />
  );
}
