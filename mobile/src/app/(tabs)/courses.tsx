import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { Card, EmptyState, Field, Note, Screen, Badge } from '@/components/ui';
import { api } from '@/lib/api';
import type { Course } from '@/lib/types';
import { colors, spacing, type } from '@/constants/theme';

export default function CoursesScreen() {
  const [search, setSearch] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);

  const load = useCallback(async (query: string, nextPage: number, append: boolean) => {
    setError('');
    try {
      const result = await api.courses({ search: query || undefined, page: nextPage });
      setCount(result.count);
      setCourses((current) => (append ? [...current, ...result.results] : result.results));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load the catalog.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load('', 1, false); }, [load]);

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setPage(1); void load(search, 1, false); }} tintColor={colors.navy950} />}
    >
      <Field
        label="Search the catalog"
        value={search}
        onChangeText={setSearch}
        placeholder="Try: Excel, Design, Web"
        returnKeyType="search"
        onSubmitEditing={() => { setLoading(true); setPage(1); void load(search, 1, false); }}
      />

      {error ? <Note tone="error">{error}</Note> : null}
      {!error && !loading && courses.length === 0
        ? <EmptyState icon="compass" title="Nothing matches yet" body="Try a different search term, or pull down to refresh the catalog." />
        : null}

      {courses.map((course) => (
        <Link key={course.id} href={`/course/${course.id}`} asChild>
          <Pressable accessibilityRole="button" style={styles.row}>
            <Card style={styles.card}>
              <View style={styles.head}>
                <View style={styles.titleBlock}>
                  <Text style={type.subheading} numberOfLines={2}>{course.title}</Text>
                  <Text style={[type.small, styles.muted]} numberOfLines={2}>{course.tagline || course.category}</Text>
                </View>
                <Badge label={Number(course.numeric_price) > 0 ? `NGN ${course.price}` : 'Free'} tone={Number(course.numeric_price) > 0 ? 'neutral' : 'success'} />
              </View>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}><Feather name="bar-chart" size={13} color={colors.textMuted} /><Text style={[type.caption, styles.muted]}>{course.level || 'All levels'}</Text></View>
                <View style={styles.metaItem}><Feather name="clock" size={13} color={colors.textMuted} /><Text style={[type.caption, styles.muted]}>{course.duration || 'Self-paced'}</Text></View>
                <View style={styles.spacer} />
                <View style={styles.metaItem}><Text style={[type.caption, { color: colors.focus, fontWeight: '700' }]}>View course</Text><Feather name="chevron-right" size={13} color={colors.focus} /></View>
              </View>
            </Card>
          </Pressable>
        </Link>
      ))}

      {courses.length < count ? (
        <LoadMoreButton label="Load more courses" onPress={() => { const next = page + 1; setPage(next); void load(search, next, true); }} loading={loading && page > 1} />
      ) : null}
      {!loading && courses.length > 0 ? <Text style={[type.caption, styles.muted, styles.countLine]}>{count} courses</Text> : null}
    </Screen>
  );
}

function LoadMoreButton({ label, onPress, loading }: { label: string; onPress: () => void; loading?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={loading} style={styles.loadMore}>
      <Text style={styles.loadLabel}>{loading ? 'Loading...' : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: spacing(1) },
  card: { gap: spacing(2.5) },
  head: { flexDirection: 'row', gap: spacing(3), alignItems: 'flex-start' },
  titleBlock: { flex: 1, gap: spacing(1) },
  muted: { color: colors.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  spacer: { flex: 1 },
  loadMore: {
    minHeight: 44, borderRadius: 12, backgroundColor: colors.navy100,
    alignItems: 'center', justifyContent: 'center', paddingVertical: spacing(2.5),
  },
  loadLabel: { ...type.small, fontWeight: '700', color: colors.navy950 },
  countLine: { textAlign: 'center' },
});
