import { QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { refreshSession } from '@/lib/api';
import { queryClient } from '@/lib/query';
import { useAuth } from '@/stores/auth';
import { useColors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const status = useAuth((s) => s.status);
  const c = useColors();

  // Restore the session from the refresh token in SecureStore before showing anything.
  useEffect(() => {
    refreshSession().finally(() => SplashScreen.hideAsync().catch(() => {}));
  }, []);

  if (status === 'restoring') return null;

  const signedIn = status === 'signedIn';
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
