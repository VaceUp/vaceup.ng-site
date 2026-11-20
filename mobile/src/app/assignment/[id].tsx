import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { Button, Card, EmptyState, Field, Note, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import type { Submission } from '@/lib/types';
import { spacing, type, useTheme } from '@/theme';

/** Submissions for one assignment, with inline grading (score + feedback). */
export default function AssignmentSubmissionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [maxScore, setMaxScore] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const assignment = await api.assignment(id);
      setMaxScore(assignment.max_score ?? null);
      const result = await api.assignmentSubmissions(Number(id));
      setSubmissions(result.results);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load the submissions.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const openGrade = (submission: Submission) => {
    setOpenId(submission.id);
    setScore(submission.grade !== null && submission.grade !== undefined ? String(submission.grade) : '');
    setFeedback(submission.feedback ?? '');
    setSavedId(null);
  };

  const save = async (submission: Submission) => {
    if (!score.trim()) { setError('Enter a score before saving.'); return; }
    setBusy(true); setError('');
    try {
      await api.gradeSubmission(Number(id), Number(submission.id), Number(score), feedback.trim());
      setSavedId(submission.id);
      setOpenId(null);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save the grade.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      {error ? <Note tone="error">{error}</Note> : null}
      {loading ? <Note>Loading submissions...</Note> : null}
      {!loading && submissions.length === 0
        ? <EmptyState icon="inbox" title="No submissions yet" body="Learner submissions for this assignment appear here as they come in." />
        : submissions.map((submission) => {
          const studentName = typeof submission.student === 'object' ? submission.student.full_name : `Learner ${submission.student}`;
          const isOpen = openId === submission.id;
          const saved = savedId === submission.id;
          return (
            <Card key={submission.id} style={styles.card}>
              <Pressable accessibilityRole="button" onPress={() => setOpenId(isOpen ? null : submission.id)} style={styles.head}>
                <View style={{ flex: 1 }}>
                  <Text style={[type.subheading, { color: colors.text }]}>{studentName}</Text>
                  <Text style={[type.small, { color: colors.textMuted }]}>
                    {submission.submitted_at ? `Submitted ${new Date(submission.submitted_at).toLocaleString()}` : 'Not submitted'}
                    {submission.is_late ? ' · late' : ''}
                  </Text>
                </View>
                <Text style={[type.small, { color: submission.grade !== null && submission.grade !== undefined ? colors.success : colors.textMuted, fontWeight: '700' }]}>
                  {submission.grade !== null && submission.grade !== undefined ? `${submission.grade}` : submission.status}
                </Text>
                <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
              </Pressable>
              {isOpen ? (
                <View style={styles.gradeForm}>
                  {submission.content ? <Text style={[type.body, { color: colors.text }]}>{submission.content}</Text> : null}
                  {saved ? <Note tone="success">Grade saved.</Note> : null}
                  <Field
                    label={`Score${maxScore ? ` (out of ${maxScore})` : ''}`}
                    keyboardType="numbers-and-punctuation"
                    value={score}
                    onChangeText={setScore}
                    disabled={busy}
                  />
                  <Field
                    label="Feedback for the learner"
                    multiline
                    numberOfLines={4}
                    value={feedback}
                    onChangeText={setFeedback}
                    placeholder="What they did well and what to improve."
                    disabled={busy}
                  />
                  <Button label="Save grade" onPress={() => void save(submission)} loading={busy} wide />
                </View>
              ) : null}
            </Card>
          );
        })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing(2.5), marginBottom: spacing(2) },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  gradeForm: { gap: spacing(3) },
});
