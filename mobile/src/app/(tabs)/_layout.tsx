import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { colors } from '@/constants/theme';

const TAB_ICONS = {
  home: 'home',
  courses: 'compass',
  learn: 'book-open',
  alerts: 'bell',
  profile: 'user',
} as const;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: '700', color: colors.text },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.navy950,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontWeight: '600', fontSize: 11 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Feather name={TAB_ICONS.home} size={size} color={color as string} /> }} />
      <Tabs.Screen name="courses" options={{ title: 'Courses', tabBarIcon: ({ color, size }) => <Feather name={TAB_ICONS.courses} size={size} color={color as string} /> }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: ({ color, size }) => <Feather name={TAB_ICONS.learn} size={size} color={color as string} /> }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts', tabBarIcon: ({ color, size }) => <Feather name={TAB_ICONS.alerts} size={size} color={color as string} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Feather name={TAB_ICONS.profile} size={size} color={color as string} /> }} />
    </Tabs>
  );
}
