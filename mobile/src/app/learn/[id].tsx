import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { Button, Card, EmptyState, Note, ProgressBar, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import type { WorkspaceCourseDetail, WorkspaceLesson } from '@/lib/types';
import { light as colors, spacing, type } from '@/theme';

/** Lesson screen for one enrollment: module list, selected lesson, and the
 * mark-complete action that drives progress everywhere. */
export default function LearnDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<WorkspaceCourseDetail | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<WorkspaceLesson | null>(null);
  const [busy, setBusy] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const result = await api.courseDetail(id);
      setDetail(result);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load this course.');
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!detail || selected) return;
    const lessons = detail.course.modules.flatMap((module) => module.lessons);
    const next = lessons.find((lesson) => !detail.completed_lesson_ids.includes(lesson.id)) ?? lessons[0] ?? null;
    setSelected(next);
  }, [detail, selected]);

  const openVideo = async (lesson: WorkspaceLesson) => {
    const url = await api.lessonPlaybackUrl(lesson.id);
    if (url) {
      setVideoUrl(url);
      void Linking.openURL(url);
    }
  };

  const complete = async (lesson: WorkspaceLesson) => {
    setBusy(true); setError('');
    try {
      await api.completeLesson(lesson.id);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not mark this lesson complete.');
    } finally {
      setBusy(false);
    }
  };

  if (error && !detail) {
    return <Screen><Note tone="error">{error}</Note></Screen>;
  }
  if (!detail) {
    return <Screen><EmptyState icon="loader" title="Loading lessons" body="Fetching your course modules and progress." /></Screen>;
  }

  const lessons = detail.course.modules.flatMap((module) => module.lessons);
  const doneCount = detail.completed_lesson_ids.length;
  const percent = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0;
  const isDone = selected ? detail.completed_lesson_ids.includes(selected.id) : false;
  const videoOpen = videoUrl !== null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={styles.stack}>
        <Text style={type.heading}>{detail.course.title}</Text>
        <ProgressBar percent={percent} />
        <Text style={[type.small, styles.muted]}>{doneCount} of {lessons.length} lessons complete ({percent}%)</Text>
      </Card>

      {error ? <Note tone="error">{error}</Note> : null}
      {lessons.length === 0 ? <EmptyState icon="book-open" title="No lessons yet" body="Your tutor publishes the lessons here. Check back shortly." /> : null}

      {detail.course.modules.map((module) => (
        <Card key={module.id} style={styles.stack}>
          <Text style={[type.caption, styles.weekLabel]}>WEEK {module.week}</Text>
          <Text style={type.subheading}>{module.title}</Text>
          {module.lessons.map((lesson) => {
            const done = detail.completed_lesson_ids.includes(lesson.id);
            const active = selected?.id === lesson.id;
            return (
              <Pressable
                key={lesson.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setSelected(lesson)}
                style={[styles.lessonButton, active && styles.lessonActive]}
              >
                <Feather name={done ? 'check-circle' : 'circle'} size={16} color={done ? colors.success : colors.navy200} />
                <Text style={[type.small, { flex: 1 }, done && styles.doneText]} numberOfLines={2}>{lesson.title}</Text>
                {lesson.has_video && <Feather name="video" size={14} color={colors.textMuted} />}
              </Pressable>
            );
          })}
        </Card>
      ))}

      {selected ? (
        <Card style={styles.stack}>
          <Text style={type.heading}>{selected.title}</Text>
          {selected.content ? <Text style={type.body}>{selected.content}</Text> : <Text style={[type.body, styles.muted]}>This lesson opens as a video.</Text>}
          {selected.has_video ? (
            <Button label={videoOpen ? 'Open video again' : 'Open lesson video'} icon="play" onPress={() => void openVideo(selected)} />
          ) : null}
          <Button
            label={isDone ? 'Lesson completed' : 'Mark lesson complete'}
            icon={isDone ? 'check' : undefined}
            intent={isDone ? 'neutral' : 'primary'}
            disabled={isDone || (!selected.content && !selected.has_video)}
            loading={busy}
            wide
            onPress={() => void complete(selected)}
          />
          {isDone ? <Button label="Next lesson" icon="arrow-right" onPress={() => {
            const index = lessons.findIndex((lesson) => lesson.id === selected.id);
            const next = lessons.slice(index + 1).find((lesson) => !detail.completed_lesson_ids.includes(lesson.id)) ?? lessons[index + 1] ?? null;
            if (next) { setSelected(next); setVideoUrl(null); } else { router.back(); }
          }} /> : null}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing(4), paddingBottom: spacing(8), gap: spacing(4) },
  stack: { gap: spacing(2.5) },
  weekLabel: { color: colors.focus, letterSpacing: 1.5 },
  lessonButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing(2),
    minHeight: 48, paddingHorizontal: spacing(3), borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, backgroundColor: colors.surface,
  },
  lessonActive: { borderColor: colors.focus, backgroundColor: colors.navy100 },
  doneText: { color: colors.textMuted, textDecorationLine: 'line-through' },
  muted: { color: colors.textMuted },
});
