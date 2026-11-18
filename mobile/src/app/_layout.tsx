import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Redirect, Stack, usePathname } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useAuth } from '@/state/auth';

const AUTH_ROUTES = ['/login', '/register'];

/** Route guard: restores the secure-store session on cold start, then keeps
 * signed-out users on the auth group and signed-in users in the tabs. */
function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useAuth((state) => state.status);
  const restore = useAuth((state) => state.restore);
  const pathname = usePathname();

  useEffect(() => {
    void restore();
  }, [restore]);

  if (status === 'restoring') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page }}>
        <ActivityIndicator color={colors.navy950} size="large" />
      </View>
    );
  }

  const onAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  if (status === 'signed-out' && !onAuthRoute) return <Redirect href="/login" />;
  if (status === 'signed-in' && onAuthRoute) return <Redirect href="/(tabs)/home" />;
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthGate>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { fontWeight: '700', color: colors.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.page },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="course/[id]" options={{ title: 'Course' }} />
        <Stack.Screen name="learn/[id]" options={{ title: 'Your course' }} />
        <Stack.Screen name="challenge" options={{ title: 'Community challenge' }} />
      </Stack>
    </AuthGate>
  );
}
