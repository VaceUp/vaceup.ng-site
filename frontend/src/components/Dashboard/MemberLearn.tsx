'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { webUrl, type WorkspaceCourseDetail, type WorkspaceLesson } from '@/lib/workspace-api';
import { WorkspaceHeading, WorkspacePanel, WorkspaceEmpty, WorkspaceFeedback, WorkspaceRefresh, WorkspaceLink, WorkspaceButton, styles } from './WorkspaceUI';

function Lesson({ lesson, completed, student, onComplete }: { lesson: WorkspaceLesson; completed: boolean; student: boolean; onComplete: () => void }) {
  const [busy, setBusy] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [videoError, setVideoError] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const play = async () => {
    setVideoBusy(true); setError(''); setVideoError(false); setSource(null);
    try {
      const result = await api.request<{ playback_url: string }>(`/lessons/${lesson.id}/play/`, { cache: 'no-store' });
      const url = webUrl(result.playback_url);
      if (!url) throw new Error('Missing video');
      if (mounted.current) setSource(url);
    } catch { if (mounted.current) setError('We could not open this video. Refresh its access link or contact your tutor.'); }
    finally { if (mounted.current) setVideoBusy(false); }
  };
  const complete = async () => {
    setBusy(true); setError('');
    try { await api.request('/enrollments/complete-lesson/', { method: 'POST', body: JSON.stringify({ lesson: lesson.id }) }); if (mounted.current) onComplete(); }
    catch { if (mounted.current) setError('Completion could not be confirmed. Refresh the course before trying again.'); }
    finally { if (mounted.current) setBusy(false); }
  };
  return <WorkspacePanel><div className={styles.stack}><div className={styles.row}><h2>{lesson.title}</h2>{completed && <span className={styles.badge}><Check aria-hidden="true" />Completed</span>}</div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {lesson.has_video && <div className={styles.stack}><WorkspaceButton loading={videoBusy} onClick={() => void play()}>{source ? 'Refresh video access' : 'Load lesson video'}</WorkspaceButton>
      {source && <>{!videoError && <video className={styles.video} src={source} controls playsInline preload="metadata" onError={() => setVideoError(true)} aria-label={lesson.title} />}
      {videoError && <p role="status">This video could not play here. Try refreshing its access link, or open the provider below.</p>}
      <a className={styles.action} href={source} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open video provider in a new tab</a></>}
    </div>}
    {lesson.content ? <div className={styles.lessonContent}>{lesson.content}</div> : <p className={styles.muted}>{lesson.has_video ? 'This lesson is delivered by video.' : 'No lesson material has been added yet. Contact your tutor.'}</p>}
    {student && <WorkspaceButton primary disabled={completed || (!lesson.content && !lesson.has_video)} loading={busy} onClick={() => void complete()}>{completed ? 'Lesson completed' : 'Mark lesson complete'}</WorkspaceButton>}
  </div></WorkspacePanel>;
}
function LearnContent() {
  const query = useSearchParams();
  const id = query.get('course');
  const valid = !!id && /^\d+$/.test(id) && Number(id) > 0;
  const { user } = useAuth();
  const [selected, setSelected] = useState<number | null>(null);
  const resource = useWorkspaceResource<WorkspaceCourseDetail>(valid ? `/dashboard/courses/${id}/` : null);
  const data = resource.data;
  const lessons = data?.course.modules.flatMap(module => module.lessons) || [];
  const lesson = lessons.find(item => item.id === selected) || lessons.find(item => !data?.completed_lesson_ids.includes(item.id)) || lessons[0];
  if (!valid) return <WorkspaceEmpty title="Choose a course first" action={<WorkspaceLink href="/dashboard/courses">My courses</WorkspaceLink>}>Open a course from your enrollments to access its lessons.</WorkspaceEmpty>;
  return <><WorkspaceHeading title={data?.course.title || 'Your course'} description={user?.role === 'instructor' ? 'Review the published lesson content your learners can access.' : 'Choose a lesson and mark it complete when you finish studying.'} action={<WorkspaceRefresh loading={resource.loading} onRefresh={resource.refresh} />} />
    <WorkspaceLink href="/dashboard/courses">Back to my courses</WorkspaceLink>
    <WorkspaceFeedback {...resource} hasData={!!data} onRetry={resource.refresh} />
    {data && (lessons.length ? <div className={`${styles.split} ${styles.lessonSplit}`}><nav className={styles.lessonNav} aria-label="Course lessons">{data.course.modules.map(module => <details key={module.id} open><summary>{module.title}</summary>{module.lessons.map(item => <WorkspaceButton key={item.id} className={styles.lessonButton} aria-current={lesson?.id === item.id ? 'step' : undefined} onClick={() => setSelected(item.id)}>{data.completed_lesson_ids.includes(item.id) && <Check aria-hidden="true" />}{item.title}</WorkspaceButton>)}</details>)}</nav>
      {lesson && <Lesson key={`${id}:${lesson.id}`} lesson={lesson} student={user?.role === 'student'} completed={data.completed_lesson_ids.includes(lesson.id)} onComplete={() => { setSelected(lesson.id); resource.refresh(); }} />}
    </div> : <WorkspaceEmpty title="Lessons are on their way">Your tutor has not added lessons to this course yet.</WorkspaceEmpty>)}
  </>;
}
export default function MemberLearn() { return <Suspense fallback={<p role="status">Loading course...</p>}><LearnContent /></Suspense>; }
