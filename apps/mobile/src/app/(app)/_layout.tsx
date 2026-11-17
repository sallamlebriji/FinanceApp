import { Stack } from 'expo-router';
import type { ComponentProps } from 'react';
import { useColors } from '@/theme';

/**
 * Signed-in stack. Tabs carry navigation; focused tasks (new/edit transaction, account,
 * budget) are sheets: one at a time, swipe to dismiss, with Cancel and a prominent Save.
 */
export default function AppLayout() {
  const c = useColors();
  const sheet: ComponentProps<typeof Stack.Screen>['options'] = {
    presentation: 'formSheet',
    sheetGrabberVisible: true,
    sheetAllowedDetents: [1],
    sheetCornerRadius: 20,
    headerShown: false,
    contentStyle: { backgroundColor: c.bg },
  };
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.accent,
        headerTitleStyle: { color: c.label },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: c.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="account/[id]" options={{ title: '' }} />
      <Stack.Screen name="transaction" options={sheet} />
      <Stack.Screen name="account-form" options={sheet} />
      <Stack.Screen name="budget-form" options={sheet} />
    </Stack>
  );
}
