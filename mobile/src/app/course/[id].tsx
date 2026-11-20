import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyState, Note, Screen, Separator } from '@/components/ui';
import { api } from '@/lib/api';
import type { Course } from '@/lib/types';
import { light as colors, spacing, type } from '@/theme';

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [enrolled, setEnrolled] = useState(false);

  useEffect(() => {
    if (!id) return;
    let live = true;
    api.course(id)
      .then((result) => {
        if (live) setCourse(result);
      })
      .catch((failure) => {
        if (live) setError(failure instanceof Error ? failure.message : 'Could not load this course.');
      });
    return () => { live = false; };
  }, [id]);

  const enroll = async () => {
    if (!course) return;
    setBusy(true); setNotice('');
    try {
      await api.enroll(course.id);
      setEnrolled(true);
      setNotice(`You are enrolled in ${course.title}. Find it under Learn to start your lessons.`);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'Enrollment failed.';
      setNotice('');
      setError(message);
      // A paid course needs the web checkout for now; open it there.
      if (failure instanceof Error && /payment|pay|purchase|price/i.test(message)) {
        setNotice('This course is paid. Complete the purchase once on the VaceUp website, then come back - your lessons appear here automatically.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (error && !course) {
    return <Screen><Note tone="error">{error}</Note></Screen>;
  }
  if (!course) {
    return <Screen><EmptyState icon="loader" title="Loading course" body="Fetching the course outline and brief." /></Screen>;
  }

  const isFree = Number(course.numeric_price) === 0;
  const outcomes = (course.learning_outcomes ?? '').split('\n').filter((line) => line.trim());

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {course.image
          ? <Image source={{ uri: course.image }} style={styles.hero} resizeMode="cover" />
          : <View style={[styles.hero, styles.heroFallback]}><Text style={styles.heroLetter}>{course.title.charAt(0)}</Text></View>}
        <View style={{ padding: spacing(4), gap: spacing(2) }}>
          <Text style={type.title}>{course.title}</Text>
          <Text style={[type.body, styles.muted]}>{course.tagline || course.description.slice(0, 140)}</Text>
          <View style={styles.metaRow}>
            <Text style={[type.caption, styles.metaChip]}>{course.category}</Text>
            <Text style={[type.caption, styles.metaChip]}>{course.level || 'All levels'}</Text>
            <Text style={[type.caption, styles.metaChip]}>{isFree ? 'Free' : `NGN ${course.price}`}</Text>
          </View>
        </View>
      </Card>

      {notice ? <Note tone="success">{notice}</Note> : null}
      {error ? <Note tone="error">{error}</Note> : null}

      <Button
        label={enrolled ? 'Enrolled - open Learn' : isFree ? 'Enroll for free' : 'Buy and enroll'}
        onPress={() => {
          if (enrolled) { router.push('/(tabs)/learn'); return; }
          if (!isFree) {
            // v1: paid checkout stays on the web; open the site course page.
            void Linking.openURL(`https://vaceup.ng/courses/`);
            return;
          }
          void enroll();
        }}
        loading={busy}
        icon={enrolled ? 'check-circle' : undefined}
        wide
      />

      <Card style={styles.stack}>
        <Text style={type.heading}>About this course</Text>
        <Text style={[type.body, styles.muted]}>{course.description}</Text>
      </Card>

      {outcomes.length > 0 ? (
        <Card style={styles.stack}>
          <Text style={type.heading}>What you will learn</Text>
          {outcomes.map((line, index) => (
            <View key={`${index}-${line}`} style={styles.outcome}>
              <Text style={[type.small, styles.outcomeText]}>{line.replace(/^-\s*/, '')}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Card style={styles.stack}>
        <Text style={type.heading}>Course outline</Text>
        <Text style={[type.body, styles.muted]}>{course.outline || 'The full lesson list appears in your Learn tab after enrollment.'}</Text>
        <Separator />
        <Text style={[type.small, styles.muted]}>Lessons, quizzes and feedback live under the Learn tab once you enroll.</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing(4), paddingBottom: spacing(8), gap: spacing(4) },
  hero: { width: '100%', aspectRatio: 16 / 9 },
  heroFallback: { backgroundColor: colors.navy800, alignItems: 'center', justifyContent: 'center' },
  heroLetter: { ...type.title, color: colors.white },
  muted: { color: colors.textMuted },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  metaChip: {
    color: colors.navy950, backgroundColor: colors.navy100,
    borderRadius: 999, paddingHorizontal: spacing(2.5), paddingVertical: spacing(1), overflow: 'hidden',
  },
  stack: { gap: spacing(2.5) },
  outcome: {
    flexDirection: 'row', gap: spacing(2), alignItems: 'flex-start',
    paddingLeft: spacing(2), borderLeftWidth: 2, borderLeftColor: colors.gold,
  },
  outcomeText: { flex: 1, color: colors.text },
});
