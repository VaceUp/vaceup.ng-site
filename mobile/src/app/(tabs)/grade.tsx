import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { Card, EmptyState, Note, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import type { Assignment } from '@/lib/types';
import { spacing, type, useTheme } from '@/theme';

export default function GradeScreen() {
  const { colors } = useTheme();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await api.assignments();
      setAssignments(result.results);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load your assignments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.gold} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} />}
    >
      {error ? <Note tone="error">{error}</Note> : null}
      {!error && !loading && assignments.length === 0
        ? <EmptyState icon="edit-3" title="No assignments yet" body="Assignments you create for your courses appear here with their submissions." />
        : assignments.map((assignment) => (
          <Link key={assignment.id} href={`/assignment/${assignment.id}`} asChild>
            <Pressable accessibilityRole="button">
              <Card style={styles.row}>
                <View style={styles.head}>
                  <Text style={[type.subheading, { color: colors.text, flex: 1 }]} numberOfLines={2}>{assignment.title}</Text>
                  <Feather name="chevron-right" size={16} color={colors.textMuted} />
                </View>
                <View style={styles.metaRow}>
                  {assignment.due_at ? <Text style={[type.small, { color: colors.textMuted }]}>Due {new Date(assignment.due_at).toLocaleDateString()}</Text> : null}
                  {assignment.max_score ? <Text style={[type.small, { color: colors.textMuted }]}>· {assignment.max_score} points</Text> : null}
                </View>
                <Text style={[type.small, { color: colors.focus, fontWeight: '700' }]}>Open submissions</Text>
              </Card>
            </Pressable>
          </Link>
        ))}
      {loading ? <Note>Loading your assignments...</Note> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing(2) },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(2) },
  metaRow: { flexDirection: 'row', gap: spacing(2) },
});
