import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { Card, EmptyState, Note, ProgressBar, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import type { Enrollment } from '@/lib/types';
import { colors, spacing, type } from '@/constants/theme';

export default function LearnScreen() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setEnrollments(await api.myEnrollments());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load your enrollments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.navy950} />}
    >
      {error ? <Note tone="error">{error}</Note> : null}
      {!error && !loading && enrollments.length === 0
        ? (
            <Card>
              <EmptyState icon="book-open" title="Your learning shelf is empty" body="Enroll in a course from the catalog. Every lesson you complete shows progress here and on the web dashboard." />
              <Link href="/(tabs)/courses" asChild>
                <Pressable accessibilityRole="link" style={styles.browseLink}>
                  <Text style={[type.small, { color: colors.focus, fontWeight: '700' }]}>Browse courses</Text>
                  <Feather name="chevron-right" size={14} color={colors.focus} />
                </Pressable>
              </Link>
            </Card>
          )
        : enrollments.map((enrollment) => (
          <Link key={enrollment.id} href={`/learn/${enrollment.id}`} asChild>
            <Pressable accessibilityRole="button">
              <Card style={styles.card}>
                <View style={styles.head}>
                  <Text style={type.subheading} numberOfLines={2}>{enrollment.course.title}</Text>
                  {enrollment.is_completed
                    ? <Feather name="award" size={18} color={colors.goldDark} />
                    : <Feather name="play-circle" size={18} color={colors.focus} />}
                </View>
                <ProgressBar percent={enrollment.progress} />
                <Text style={[type.small, styles.muted]}>
                  {enrollment.is_completed ? 'Completed — certificate available' : `${enrollment.progress}% complete. Tap to continue.`}
                </Text>
              </Card>
            </Pressable>
          </Link>
        ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing(2.5) },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing(3) },
  muted: { color: colors.textMuted },
  browseLink: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), minHeight: 44, alignSelf: 'flex-start' },
});
