import { useCallback, useEffect, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Badge, Card, EmptyState, Heading, Note, ProgressBar, Screen, Separator } from '@/components/ui';
import { api } from '@/lib/api';
import { registerForPushNotifications } from '@/lib/notifications';
import type { DashboardCourse, DashboardStats } from '@/lib/types';
import { colors, spacing, type } from '@/constants/theme';
import { useAuth } from '@/state/auth';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [courses, setCourses] = useState<DashboardCourse[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [statsResult, courseResult] = await Promise.all([api.dashboardStats(), api.dashboardCourses()]);
      setStats(statsResult);
      setCourses(courseResult);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load your dashboard.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // First signed-in screen: ask for notification permission once per install.
  useEffect(() => { void registerForPushNotifications(); }, []);

  const firstName = (user?.full_name ?? '').split(' ')[0] || 'there';

  const statRows: Array<{ icon: keyof typeof Feather.glyphMap; label: string; value: number | string }> = [
    { icon: 'book-open', label: 'Courses', value: stats?.courses_enrolled ?? 0 },
    { icon: 'clock', label: 'Hours learned', value: stats?.hours_learned ?? 0 },
    { icon: 'award', label: 'Certificates', value: stats?.certificates_earned ?? 0 },
    { icon: 'zap', label: 'Day streak', value: stats?.streak ?? 0 },
  ];

  return (
    <Screen
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.navy950} />}
    >
      <Heading title={`Hi ${firstName}`} subtitle="Pick up where you left off, or start something new." />

      {error ? <Note tone="error">{error}</Note> : null}

      <View style={styles.statsRow}>
        {statRows.map((item) => (
          <Card key={item.label} style={styles.statCard}>
            <Feather name={item.icon} size={16} color={colors.focus} />
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={[type.caption, styles.muted]}>{item.label}</Text>
          </Card>
        ))}
      </View>

      <Separator />

      <Heading title="Continue learning" />
      {!error && courses.length === 0
        ? (
            <Card>
              <EmptyState
                icon="compass"
                title="No courses yet"
                body="Browse the catalog and enroll in your first course. Your lessons will appear here."
              />
              <InlineButton onPress={() => router.push('/(tabs)/courses')} label="Browse courses" />
            </Card>
          )
        : courses.map((course) => (
          <Link key={course.id} href={`/learn/${course.id}`} asChild>
            <Pressable accessibilityRole="button" style={styles.courseRow}>
              <Card style={styles.courseCard}>
                <View style={styles.courseHead}>
                  <Text style={[type.subheading, { flex: 1 }]} numberOfLines={2}>{course.title}</Text>
                  <Badge label={`${course.completed_lessons}/${course.total_lessons}`} tone="gold" />
                </View>
                <ProgressBar percent={course.progress} />
                <View style={styles.courseFoot}>
                  <Text style={[type.small, styles.muted]}>{course.progress}% complete</Text>
                  <View style={styles.nextRow}>
                    <Feather name="play-circle" size={14} color={colors.focus} />
                    <Text style={[type.small, styles.nextLabel]} numberOfLines={1}>
                      {course.next_lesson || 'Review lessons'}
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          </Link>
        ))}
    </Screen>
  );
}

/** Local stand-in until ui.tsx grows a Link-aware button; same visual grammar. */
function InlineButton({ onPress, label }: { onPress: () => void; label: string }) {
  return <Pressable onPress={onPress} style={styles.inlineButton}><Text style={styles.inlineLabel}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: spacing(2) },
  statCard: { flex: 1, padding: spacing(3), gap: spacing(1), alignItems: 'flex-start' },
  statValue: { ...type.heading, color: colors.navy950 },
  muted: { color: colors.textMuted },
  courseRow: { marginTop: spacing(1) },
  courseCard: { gap: spacing(2.5) },
  courseHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(2) },
  courseFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(2) },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), flex: 1 },
  nextLabel: { color: colors.focus, fontWeight: '600', flexShrink: 1 },
  inlineButton: {
    minHeight: 44, paddingHorizontal: spacing(4), paddingVertical: spacing(2.5),
    borderRadius: 12, backgroundColor: colors.navy100, alignSelf: 'flex-start',
  },
  inlineLabel: { ...type.small, fontWeight: '700', color: colors.navy950 },
});
