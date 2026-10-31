'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import {
  managementList, failureMessage, type ManagedCourse, type ManagedLesson, type ManagedModule,
} from '@/lib/course-management';
import { ConfirmDelete } from './AuthoringUI';
import {
  Action, AdminList, AdminRow, AdminSection, Drawer, EmptyState, Field, FormGrid, Pill, Skeleton,
  StatusNote, TextInput, adminStyles, controlClass, formClass, useToast,
} from './AdminUI';
import LessonForm from './LessonForm';

function ModuleForm({ module, courseId, suggestedWeek, formId, onSaved, onBusyChange }: {
  module: ManagedModule | null; courseId: number; suggestedWeek: number; formId: string;
  onSaved: () => void; onBusyChange?: (busy: boolean) => void;
}) {
  const [form, setForm] = useState({
    title: module?.title || '',
    week: module ? String(module.week) : String(suggestedWeek),
    duration_minutes: String(module?.duration_minutes ?? 0),
    order: module?.order ?? 0,
    meeting_url: module?.meeting_url || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const busyRef = useRef(onBusyChange);
  busyRef.current = onBusyChange;
  useEffect(() => () => { busyRef.current?.(false); }, []);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); busyRef.current?.(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        week: Number(form.week) || suggestedWeek,
        duration_minutes: Math.max(0, Number(form.duration_minutes) || 0),
        meeting_url: form.meeting_url.trim(),
      };
      if (module) payload.order = Math.max(0, Math.floor(Number(form.order) || 0));
      else payload.course = courseId;
      await api.request(module ? `/modules/${module.id}/` : '/modules/', {
        method: module ? 'PATCH' : 'POST', body: JSON.stringify(payload),
      });
      onSaved();
    } catch (err) {
      setError(failureMessage(err));
    } finally {
      setBusy(false); busyRef.current?.(false);
    }
  }

  return (
    <form id={formId} className={formClass} onSubmit={(event) => void save(event)}>
      {error && <StatusNote tone="error">{error}</StatusNote>}
      <FormGrid>
        <Field label="Module title" required>
          <TextInput autoFocus required maxLength={200} value={form.title} onChange={(event) => set('title', event.target.value)} />
        </Field>
        <Field label="Course week" required hint="The week this module runs in the course timetable.">
          <TextInput type="number" required min="1" step="1" inputMode="numeric" value={form.week} onChange={(event) => set('week', event.target.value)} />
        </Field>
        <Field label="Planned contact time (minutes)" optional>
          <TextInput type="number" min="0" step="1" inputMode="numeric" value={form.duration_minutes} onChange={(event) => set('duration_minutes', event.target.value)} />
        </Field>
        {module && (
          <Field label="Order in the course" hint={`Starts at 0. This module is currently number ${module.order + 1}.`}>
            <TextInput type="number" min="0" step="1" inputMode="numeric" value={form.order} onChange={(event) => set('order', Number(event.target.value))} />
          </Field>
        )}
      </FormGrid>
      <Field
        label="Google Meet link for live sessions"
        optional
        hint="Enrolled learners see this link on the module. Leave it blank for self-paced teaching."
      >
        <TextInput type="url" inputMode="url" placeholder="https://meet.google.com/abc-defg-hij" value={form.meeting_url} onChange={(event) => set('meeting_url', event.target.value)} />
      </Field>
    </form>
  );
}

export default function CourseCurriculum({ course }: { course: ManagedCourse }) {
  const toast = useToast();
  const [modules, setModules] = useState<ManagedModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const version = useRef(0);
  const [moduleOpen, setModuleOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<ManagedModule | null>(null);
  const [moduleSaving, setModuleSaving] = useState(false);
  const [lessonTarget, setLessonTarget] = useState<{ module: ManagedModule; lesson?: ManagedLesson } | null>(null);
  const [lessonSaving, setLessonSaving] = useState(false);
  const [lessonDirty, setLessonDirty] = useState(false);
  const [discardLesson, setDiscardLesson] = useState(false);
  const [deleting, setDeleting] = useState<{ endpoint: string; title: string; name: string; description: string } | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    const current = ++version.current;
    setLoading(true);
    setError('');
    try {
      const rows = await managementList<ManagedModule>(`/modules/?course=${encodeURIComponent(course.id)}`);
      if (current === version.current) setModules(rows);
    } catch (err) {
      if (current === version.current) setError(failureMessage(err));
    } finally {
      if (current === version.current) setLoading(false);
    }
  }, [course.id]);

  useEffect(() => { void load(); }, [load]);

  const suggestedWeek = modules.reduce((max, module) => Math.max(max, module.week), 0) + 1;
  const lessonCount = modules.reduce((total, module) => total + module.lessons.length, 0);

  const openNewModule = () => { setEditingModule(null); setModuleOpen(true); };
  const openModule = (module: ManagedModule) => { setEditingModule(module); setModuleOpen(true); };
  const closeModule = () => { setModuleOpen(false); setEditingModule(null); setModuleSaving(false); };

  const moduleSaved = async () => {
    toast.push(editingModule ? 'Module saved.' : 'Module added. Add its first lesson next.', 'success');
    closeModule();
    await load();
  };

  const openLesson = (module: ManagedModule, lesson?: ManagedLesson) => {
    setLessonDirty(false);
    setLessonTarget({ module, lesson });
  };
  const closeLesson = () => { setLessonTarget(null); setLessonDirty(false); setLessonSaving(false); };
  const requestCloseLesson = () => { if (lessonSaving) return; if (lessonDirty) setDiscardLesson(true); else closeLesson(); };

  const lessonSaved = async (saved: ManagedLesson, source: 'details' | 'video') => {
    toast.push(source === 'video' ? `Video attached to “${saved.title}”.` : `“${saved.title}” was saved.`, 'success');
    setLessonTarget((current) => (current ? { module: current.module, lesson: saved } : current));
    setLessonDirty(false);
    await load();
  };

  const askDeleteModule = (module: ManagedModule) => {
    setDeleteError('');
    setDeleting({
      endpoint: `/modules/${module.id}/`,
      title: 'Delete module',
      name: module.title,
      description: `Week ${module.week} · ${module.title} and its ${module.lessons.length} lesson(s) will be deleted permanently, together with student progress for those lessons. Uploaded video files are retained in storage.`,
    });
  };

  const askDeleteLesson = (module: ManagedModule, lesson: ManagedLesson) => {
    setDeleteError('');
    setDeleting({
      endpoint: `/lessons/${lesson.id}/`,
      title: 'Delete lesson',
      name: lesson.title,
      description: `“${lesson.title}” in ${module.title} will be deleted permanently, together with student progress and completion records for it. Uploaded video files are retained in storage.`,
    });
  };

  const remove = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await api.request(deleting.endpoint, { method: 'DELETE' });
      toast.push(deleting.title === 'Delete module' ? 'Module deleted.' : 'Lesson deleted.', 'success');
      setDeleting(null);
      await load();
    } catch (err) {
      setDeleteError(failureMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <AdminSection
        title="Modules and lessons"
        description="Modules map to course weeks. Their lessons are the paid content that drives student progress; the public outline above is only a syllabus."
        actions={<>
          <Action loading={loading} onClick={() => void load()}>Refresh content</Action>
          <Action intent="primary" onClick={openNewModule}>Add module</Action>
        </>}
      >
        {error && <StatusNote tone="error">{error}</StatusNote>}
        {error && modules.length > 0 && <p className={adminStyles.hint}>Showing the last course content we could load.</p>}
        {loading && !modules.length && <Skeleton rows={3} />}

        {!loading && !error && !modules.length && (
          <EmptyState
            icon="bi-collection"
            title="No modules yet"
            description="Start with the first week's module, then add its lessons. Students only see this content once they are enrolled."
            action={<Action intent="primary" onClick={openNewModule}>Add the first module</Action>}
          />
        )}

        {modules.map((module) => (
          <article key={module.id} className={adminStyles.moduleCard} aria-label={`Week ${module.week}: ${module.title}`}>
            <header className={adminStyles.moduleHead}>
              <div className={adminStyles.stack}>
                <div className={adminStyles.rowTop}>
                  <span className={adminStyles.rowTitle}>Week {module.week} · {module.title}</span>
                  <Pill tone="muted">{module.lessons.length} {module.lessons.length === 1 ? 'lesson' : 'lessons'}</Pill>
                  {module.meeting_url && <Pill tone="live">Live link</Pill>}
                </div>
                <p className={adminStyles.rowMeta}>
                  Position {module.order + 1} · {module.duration_minutes ? `${module.duration_minutes} minutes planned` : 'contact time not set'}
                  {module.meeting_url ? ' · Google Meet link set' : ' · no live session link'}
                </p>
              </div>
              <div className={adminStyles.actions}>
                <Action intent="primary" disabled={deleteBusy} onClick={() => openLesson(module)}>Add lesson</Action>
                <Action disabled={deleteBusy} onClick={() => openModule(module)}>Edit module</Action>
                <Action intent="danger" disabled={deleteBusy} onClick={() => askDeleteModule(module)}>Delete</Action>
              </div>
            </header>

            {module.lessons.length > 0
              ? <AdminList label={`Lessons in ${module.title}`}>
                {module.lessons.map((lesson) => (
                  <AdminRow
                    key={lesson.id}
                    placeholder="bi-play-btn"
                    title={`${lesson.order + 1}. ${lesson.title}`}
                    badges={<>
                      {lesson.is_preview && <Pill tone="draft">Free preview</Pill>}
                      {lesson.video_key ? <Pill tone="live">Private video</Pill> : <Pill tone="muted">No video</Pill>}
                    </>}
                    meta={`${lesson.duration_seconds ? `${Math.round(lesson.duration_seconds / 60)} min` : 'Duration not set'}${lesson.content ? ' · lesson text' : ''}`}
                    actions={<>
                      <Action disabled={deleteBusy} onClick={() => openLesson(module, lesson)}>Edit lesson</Action>
                      <Action intent="danger" disabled={deleteBusy} onClick={() => askDeleteLesson(module, lesson)}>Delete</Action>
                    </>}
                  />
                ))}
              </AdminList>
              : <p className={adminStyles.hint}>No lessons in this module yet. Add the first lesson so students have something to work through.</p>}
          </article>
        ))}

        {modules.length > 0 && (
          <p className={adminStyles.hint}>{modules.length} {modules.length === 1 ? 'module' : 'modules'} · {lessonCount} {lessonCount === 1 ? 'lesson' : 'lessons'} in this course.</p>
        )}
      </AdminSection>

      <Drawer
        open={moduleOpen}
        title={editingModule ? `Editing Week ${editingModule.week} · ${editingModule.title}` : 'Add a module'}
        description={editingModule
          ? 'Changing the week moves the module in the learner’s timetable immediately.'
          : 'A module holds one week of lessons. You can add its lessons right after saving.'}
        onClose={closeModule}
        footer={<>
          <Action disabled={moduleSaving} onClick={closeModule}>Cancel</Action>
          <Action type="submit" form="module-form" intent="primary" loading={moduleSaving}>
            {editingModule ? 'Save module' : 'Add module'}
          </Action>
        </>}
      >
        <ModuleForm
          key={editingModule?.id ?? 'new'}
          formId="module-form"
          module={editingModule}
          courseId={course.id}
          suggestedWeek={suggestedWeek}
          onSaved={() => void moduleSaved()}
          onBusyChange={setModuleSaving}
        />
      </Drawer>

      <Drawer
        open={!!lessonTarget}
        title={lessonTarget
          ? lessonTarget.lesson ? `Editing “${lessonTarget.lesson.title}”` : 'Add a lesson'
          : 'Lesson'}
        description={lessonTarget
          ? `In ${lessonTarget.module.title}. Saved lessons appear on the learner dashboard immediately.`
          : undefined}
        onClose={requestCloseLesson}
        footer={<>
          <Action disabled={lessonSaving} onClick={requestCloseLesson}>Close</Action>
          <Action type="submit" form="lesson-form" intent="primary" loading={lessonSaving}>
            {lessonTarget?.lesson ? 'Save lesson' : 'Add lesson'}
          </Action>
        </>}
      >
        {lessonTarget && (
          <LessonForm
            formId="lesson-form"
            moduleId={lessonTarget.module.id}
            lesson={lessonTarget.lesson}
            onSaved={(saved, source) => void lessonSaved(saved, source)}
            onDirtyChange={setLessonDirty}
            onBusyChange={setLessonSaving}
          />
        )}
      </Drawer>

      {discardLesson && <ConfirmDelete
        title="Discard lesson changes"
        description="Close the lesson form? Everything typed since the last save will be lost."
        busy={false}
        error=""
        onCancel={() => setDiscardLesson(false)}
        onConfirm={() => { setDiscardLesson(false); closeLesson(); }}
      />}

      {deleting && <ConfirmDelete
        title={deleting.title}
        description={deleting.description}
        confirmationName={deleting.name}
        busy={deleteBusy}
        error={deleteError}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void remove()}
      />}
    </>
  );
}
