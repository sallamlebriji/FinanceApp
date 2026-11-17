import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { Cog, House, Landmark, PieChart, ReceiptText, type LucideIcon } from 'lucide-react-native';
import { Platform } from 'react-native';
import { useColors } from '@/theme';

/**
 * Top-level navigation: the platform's own tab bar (UITabBar on iOS, Material 3 navigation bar
 * on Android). Five single-word sections, always visible, never used for actions — adding a
 * transaction is a toolbar button on Home and Activity.
 */
export default function TabsLayout() {
  const c = useColors();
  if (Platform.OS === 'web') return <WebTabs />;
  return (
    <NativeTabs tintColor={c.accent}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity">
        <NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet.rectangle" md="receipt_long" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="accounts">
        <NativeTabs.Trigger.Label>Accounts</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'building.columns', selected: 'building.columns.fill' }} md="account_balance" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="budgets">
        <NativeTabs.Trigger.Label>Budgets</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.pie', selected: 'chart.pie.fill' }} md="donut_small" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

/** Browser preview only: native tabs fall back to a top strip on web, so use a bottom tab bar. */
function WebTabs() {
  const c = useColors();
  const icon =
    (Icon: LucideIcon) =>
    ({ color }: { color: unknown }) => <Icon size={24} color={String(color)} strokeWidth={2} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.label3,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.separator, height: 60, paddingBottom: 6 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon(House) }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: icon(ReceiptText) }} />
      <Tabs.Screen name="accounts" options={{ title: 'Accounts', tabBarIcon: icon(Landmark) }} />
      <Tabs.Screen name="budgets" options={{ title: 'Budgets', tabBarIcon: icon(PieChart) }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon(Cog) }} />
    </Tabs>
  );
}
