import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { Badge, Button, Card, EmptyState, Note, ProgressBar, Screen, Separator } from '@/components/ui';
import { api } from '@/lib/api';
import { registerForPushNotifications } from '@/lib/notifications';
import type { InstructorDashboard, WorkspaceApplication, WorkspaceOverview } from '@/lib/workspace';
import { light, radius, spacing, type, useTheme } from '@/theme';
import { useAuth } from '@/state/auth';

const GOLD = light.gold;
const NAVY = light.navy950;

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const user = useAuth((state) => state.user);
  const [overview, setOverview] = useState<WorkspaceOverview | null>(null);
  const [instructor, setInstructor] = useState<InstructorDashboard | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const role = useAuth.getState().user?.role;
    try {
      if (role === 'instructor' || role === 'admin') {
        const [overviewData, instructorData] = await Promise.all([api.overview(), api.instructorDashboard()]);
        setOverview(overviewData);
        setInstructor(instructorData);
      } else {
        setOverview(await api.overview());
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load your workspace.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // First signed-in screen: ask for notification permission once per install.
  useEffect(() => { void registerForPushNotifications(); }, []);

  const firstName = (user?.full_name ?? '').split(' ')[0] || 'there';
  const isTutor = user?.role === 'instructor' || user?.role === 'admin';
  const count = (key: string) => overview?.counts[key] ?? 0;
  const continueCourses = overview?.recent_courses?.filter((course) => course.enrollment_id) ?? [];

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={GOLD} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} />}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>YOUR LEARNING WORKSPACE</Text>
        <Text style={styles.greeting}>{isTutor ? `Teach on, ${firstName}.` : `Keep moving forward, ${firstName}.`}</Text>
        <Text style={styles.heroSub}>
          {isTutor
            ? 'Check your students, grade submissions and see how your courses are doing.'
            : 'Pick up a lesson, check your next class, and see the progress you have earned.'}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.refreshChip}>
          <Feather name="refresh-cw" size={13} color={GOLD} />
          <Text style={styles.refreshLabel}>Refresh</Text>
        </Pressable>
      </View>

      {error ? <Note tone="error">{error}</Note> : null}

      {overview?.approved_applications?.map((application) => (
        <ApplicationTask key={application.id} application={application} />
      ))}

      {overview?.tasks?.map((task) => (
        <Pressable
          key={task.kind}
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/courses')}
          style={({ pressed }) => [styles.taskChip, { backgroundColor: colors.surface, borderColor: colors.line }, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.taskChipLabel, { color: colors.text }]}>{task.label}</Text>
          <View style={styles.taskChipEnd}>
            <Text style={[styles.taskChipLabel, { color: colors.text }]}>{task.count}</Text>
            <Feather name="arrow-right" size={14} color={GOLD} />
          </View>
        </Pressable>
      ))}

      <View style={styles.statsRow}>
        {isTutor ? (
          <>
            <StatCard icon="book-open" label="Courses" value={count('courses')} />
            <StatCard icon="users" label="Students" value={count('students')} />
            <StatCard icon="check-circle" label="Active" value={instructor?.enrollments?.active ?? 0} />
            <StatCard icon="award" label="Completed" value={count('completed_courses')} />
          </>
        ) : (
          <>
            <StatCard icon="book-open" label="Enrolled courses" value={count('courses')} />
            <StatCard icon="check-square" label="Lessons completed" value={count('lessons_completed')} />
            <StatCard icon="award" label="Courses completed" value={count('completed_courses')} />
            <StatCard icon="file-text" label="Valid certificates" value={count('certificates')} />
          </>
        )}
      </View>

      {isTutor ? (
        <>
          <Separator />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent enrollments</Text>
          {instructor?.recent_enrollments?.length
            ? instructor.recent_enrollments.map((row, index) => (
              <Card key={`${index}-${row.student_name}`} style={styles.recentCard}>
                <View style={styles.recentHead}>
                  <Feather name="user-plus" size={15} color={GOLD} />
                  <Text style={[styles.recentName, { color: colors.text }]}>{row.student_name}</Text>
                  <Text style={[type.small, { color: colors.focus, fontWeight: '700' }]}>{row.progress_percent}%</Text>
                </View>
                <Text style={[type.small, { color: colors.textMuted }]}>{row.course_title}</Text>
              </Card>
            ))
            : <EmptyState icon="users" title="No students yet" body="When learners enroll in your courses, they appear here." />}
          <Button label="Grade submissions" icon="edit-3" onPress={() => router.push('/(tabs)/grade')} wide />
        </>
      ) : (
        <>
          <View style={styles.continueHead}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Continue learning</Text>
            <Link href="/(tabs)/courses" asChild>
              <Pressable accessibilityRole="link" style={styles.allCoursesLink}>
                <Text style={[type.small, { color: GOLD, fontWeight: '700' }]}>All courses</Text>
                <Feather name="arrow-right" size={13} color={GOLD} />
              </Pressable>
            </Link>
          </View>
          {continueCourses.length
            ? continueCourses.map((course) => (
              <Link key={course.id} href={`/learn/${course.enrollment_id}`} asChild>
                <Pressable accessibilityRole="button">
                  <Card style={styles.courseCard}>
                    <View style={styles.courseHead}>
                      <Text style={[styles.courseTitle, { color: colors.text }]} numberOfLines={2}>{course.title}</Text>
                      <Badge label={`${Math.round(Number(course.progress_percent ?? 0))}%`} tone="gold" />
                    </View>
                    <ProgressBar percent={Number(course.progress_percent ?? 0)} />
                    <Text style={[type.small, { color: colors.textMuted }]}>
                      {course.lesson_count ? `${course.lesson_count} lessons · ` : ''}{course.instructor_name}
                    </Text>
                  </Card>
                </Pressable>
              </Link>
            ))
            : (
              <Card>
                <EmptyState icon="book-open" title="Your learning starts here" body="Once you enroll in a course, your lessons and progress will appear here." />
                <Button label="Explore courses" onPress={() => router.push('/(tabs)/courses')} />
              </Card>
            )}
        </>
      )}
    </Screen>
  );
}

function ApplicationTask({ application }: { application: WorkspaceApplication }) {
  const { colors } = useTheme();
  return (
    <Card style={styles.applicationCard}>
      <Text style={styles.applicationEyebrow}>APPLICATION ACCEPTED</Text>
      <Text style={[type.heading, { color: colors.text }]}>Finish your enrollment</Text>
      <Text style={[type.small, { color: colors.textMuted }]}>
        The academy accepted your application. Complete the course payment to unlock your lessons and live classes.
      </Text>
      <Separator />
      <View style={styles.applicationRow}>
        <View style={{ flex: 1 }}>
          <Text style={[type.subheading, { color: colors.text }]}>{application.course_title}</Text>
          <Text style={[type.small, { color: colors.textMuted }]}>
            Tuition ₦{Number(application.price).toLocaleString()} / accepted {application.reviewed_at ? new Date(application.reviewed_at).toLocaleDateString() : 'recently'}
          </Text>
        </View>
        <Button
          label="Pay and enroll"
          icon="arrow-right"
          onPress={() => { void import('react-native').then(({ Linking }) => Linking.openURL('https://vaceup.ng/checkout/')); }}
        />
      </View>
    </Card>
  );
}

function StatCard({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: number | string }) {
  const { colors } = useTheme();
  return (
    <Card style={styles.statCard}>
      <Feather name={icon} size={15} color={colors.focus} />
      <Text style={[type.heading, { color: colors.text }]}>{value}</Text>
      <Text style={[type.caption, { color: colors.textMuted }]}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: NAVY,
    borderRadius: radius.xl,
    padding: spacing(5),
    gap: spacing(2.5),
  },
  eyebrow: { ...type.caption, color: GOLD, letterSpacing: 1.5 },
  greeting: { ...type.title, color: '#FFFFFF' },
  heroSub: { ...type.body, color: light.navy200 },
  refreshChip: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing(1.5),
    minHeight: 32, paddingHorizontal: spacing(2.5), borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth, borderColor: light.navy200,
  },
  refreshLabel: { ...type.caption, color: GOLD },
  taskChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(3),
    minHeight: 52, paddingHorizontal: spacing(4), borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  taskChipLabel: { ...type.small, fontWeight: '700', flex: 1 },
  taskChipEnd: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  statCard: { flex: 1, minWidth: '46%', padding: spacing(3), gap: spacing(1), alignItems: 'flex-start' },
  sectionTitle: { ...type.heading },
  continueHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  allCoursesLink: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), minHeight: 32 },
  courseCard: { gap: spacing(2.5) },
  courseHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing(2) },
  courseTitle: { ...type.subheading, flex: 1 },
  recentCard: { gap: spacing(1.5) },
  recentHead: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  recentName: { ...type.subheading, flex: 1 },
  applicationCard: { gap: spacing(2.5) },
  applicationEyebrow: { ...type.caption, letterSpacing: 1.2, color: GOLD },
  applicationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
});
