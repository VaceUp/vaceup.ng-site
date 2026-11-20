import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlatList } from 'react-native';

import { Badge, Card, EmptyState, Note, ProgressBar, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import type { InstructorStudent } from '@/lib/workspace';
import { spacing, type, useTheme } from '@/theme';

export default function StudentsScreen() {
  const { colors } = useTheme();
  const [students, setStudents] = useState<InstructorStudent[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (nextPage: number, append: boolean) => {
    setError('');
    try {
      const result = await api.instructorStudents(nextPage);
      setCount(result.count);
      setStudents((current) => (append ? [...current, ...result.results] : result.results));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load your students.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(1, false); }, [load]);

  const statusTone = (status: string) => (status === 'completed' ? 'success' : status === 'active' ? 'gold' : 'neutral') as 'success' | 'gold' | 'neutral';

  return (
    <Screen>
      {error ? <Note tone="error">{error}</Note> : null}
      {!error && !loading && students.length === 0
        ? <EmptyState icon="users" title="No students yet" body="Learners who enroll in your courses appear here with their progress." />
        : (
          <FlatList
            data={students}
            keyExtractor={(item) => String(item.id)}
            refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.gold} onRefresh={() => { setRefreshing(true); void load(1, false); }} />}
            renderItem={({ item }) => (
              <Card style={styles.card}>
                <View style={styles.head}>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.subheading, { color: colors.text }]}>{item.student.full_name}</Text>
                    <Text style={[type.small, { color: colors.textMuted }]}>{item.course.title}</Text>
                  </View>
                  <Badge label={item.status} tone={statusTone(item.status)} />
                </View>
                <ProgressBar percent={Number(item.progress_percent ?? 0)} />
                <Text style={[type.small, { color: colors.textMuted }]}>
                  {Math.round(Number(item.progress_percent ?? 0))}% · enrolled {new Date(item.enrolled_at).toLocaleDateString()}
                </Text>
              </Card>
            )}
            onEndReached={() => { if (students.length < count) { const next = page + 1; setPage(next); void load(next, true); } }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={students.length < count && page > 1 ? <Text style={[type.small, { color: colors.textMuted, padding: spacing(2), textAlign: 'center' }]}>Loading more...</Text> : undefined}
          />
        )}
      {students.length > 0 ? <Text style={[type.caption, { color: colors.textMuted, textAlign: 'center' }]}>{count} students across your courses</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing(2.5), marginBottom: spacing(2) },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing(2) },
});
