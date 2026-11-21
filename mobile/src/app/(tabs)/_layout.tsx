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

/** Students get the learning tabs; tutors and admins get the teaching tabs.
 * Every screen stays declared (dropping them from the navigator breaks
 * expo-router); the ones outside the current role's tab bar are hidden
 * from it with href: null. */
export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const role = useAuth((state) => state.user?.role);
  const isTutor = role === 'instructor' || role === 'admin';

  const hidden = (isStudentTab: boolean) =>
    isTutor === isStudentTab ? { href: null as unknown as undefined } : {};

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
      <Tabs.Screen name="courses" options={{ title: 'Courses', href: null, tabBarIcon: ({ color, size }) => <Feather name={TAB_ICONS.courses} size={size} color={color as string} />, ...hidden(true) }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn', href: null, tabBarIcon: ({ color, size }) => <Feather name={TAB_ICONS.learn} size={size} color={color as string} />, ...hidden(true) }} />
      <Tabs.Screen name="grade" options={{ title: 'Grade', href: null, tabBarIcon: ({ color, size }) => <Feather name={TAB_ICONS.grade} size={size} color={color as string} />, ...hidden(false) }} />
      <Tabs.Screen name="students" options={{ title: 'Students', href: null, tabBarIcon: ({ color, size }) => <Feather name={TAB_ICONS.students} size={size} color={color as string} />, ...hidden(false) }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts', tabBarIcon: ({ color, size }) => <Feather name={TAB_ICONS.alerts} size={size} color={color as string} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Feather name={TAB_ICONS.profile} size={size} color={color as string} /> }} />
    </Tabs>
  );
}
