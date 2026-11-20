import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Redirect, Stack, usePathname } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { spacing, type, useTheme } from '@/theme';
import { useAuth } from '@/state/auth';

const AUTH_ROUTES = ['/login', '/register'];

/** Route guard: restores the secure-store session on cold start, then keeps
 * signed-out users on the auth group and signed-in users in the tabs. */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const status = useAuth((state) => state.status);
  const restore = useAuth((state) => state.restore);
  const pathname = usePathname();

  useEffect(() => {
    void restore();
  }, [restore]);

  if (status === 'restoring') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page }}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  const onAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  if (status === 'signed-out' && !onAuthRoute) return <Redirect href="/login" />;
  if (status === 'signed-in' && onAuthRoute) return <Redirect href="/(tabs)/home" />;
  return <>{children}</>;
}

export default function RootLayout() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { fontWeight: '700', color: colors.text },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.page },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="course/[id]" options={{ title: 'Course' }} />
        <Stack.Screen name="learn/[id]" options={{ title: 'Your course' }} />
        <Stack.Screen name="assignment/[id]" options={{ title: 'Submissions' }} />
        <Stack.Screen name="challenge" options={{ title: 'Community challenge' }} />
      </Stack>
    </>
  );
}

/** Uncaught render errors become readable here — the same fix the website got
 * for its opaque 500s: show the cause instead of closing the app. */
export function ErrorBoundary({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.page, padding: spacing(6), justifyContent: 'center', gap: spacing(4) }}>
      <Text style={{ ...type.heading, color: colors.error }}>Something went wrong</Text>
      <Text style={{ ...type.body, color: colors.textMuted }}>
        Your work is safe. Try again, and if it keeps happening, send the details below to the VaceUp team.
      </Text>
      <Text style={{ ...type.small, color: colors.text }}>
        {error.message || 'Unknown error'}{error.digest ? ` (ref: ${error.digest})` : ''}
      </Text>
      <Pressable accessibilityRole="button" onPress={retry} style={{ minHeight: 44, alignItems: 'flex-start', justifyContent: 'center' }}>
        <Text style={{ color: colors.focus, fontWeight: '700' }}>Try again</Text>
      </Pressable>
    </View>
  );
}
