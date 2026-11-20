import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useTheme } from '@/theme';
import { useAuth } from '@/state/auth';

const TAB_ICONS = {
  home: 'home',
  courses: 'compass',
  learn: 'book-open',
  grade: 'edit-3',
  students: 'users',
  alerts: 'bell',
  profile: 'user',
} as const;

/** Students get the learning tabs; tutors and admins get the teaching tabs. */
export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const role = useAuth((state) => state.user?.role);
  const isTutor = role === 'instructor' || role === 'admin';

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: '700', color: colors.text },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontWeight: '600', fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        sceneStyle: { backgroundColor: colors.page },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Feather name={TAB_ICONS.home} size={size} color={color as string} /> }} />
      {isTutor ? (
        <>
          <Tabs.Screen name="grade" options={{ title: 'Grade', tabBarIcon: ({ color, size }) => <Feather name={TAB_ICONS.grade} size={size} color={color as string} /> }} />
          <Tabs.Screen name="students" options={{ title: 'Students', tabBarIcon: ({ color, size }) => <Feather name={TAB_ICONS.students} size={size} color={color as string} /> }} />
        </>
      ) : (
        <>
          <Tabs.Screen name="courses" options={{ title: 'Courses', tabBarIcon: ({ color, size }) => <Feather name={TAB_ICONS.courses} size={size} color={color as string} /> }} />
          <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: ({ color, size }) => <Feather name={TAB_ICONS.learn} size={size} color={color as string} /> }} />
        </>
      )}
      <Tabs.Screen name="alerts" options={{ title: 'Alerts', tabBarIcon: ({ color, size }) => <Feather name={TAB_ICONS.alerts} size={size} color={color as string} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Feather name={TAB_ICONS.profile} size={size} color={color as string} /> }} />
    </Tabs>
  );
}
