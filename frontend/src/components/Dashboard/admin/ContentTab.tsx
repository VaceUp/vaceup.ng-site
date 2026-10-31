'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  managedCourses, managedCategories, managedTutors, failureMessage,
  type ManagedCategory, type ManagedCourse, type ManagedTutor,
} from '@/lib/course-management';
import { ConfirmDelete } from './AuthoringUI';
import {
  Action, AdminList, AdminRow, AdminSection, Drawer, EmptyState, Field, LinkAction, Pill, Skeleton,
  StatusNote, Toolbar, adminStyles, controlClass, useToast,
} from './AdminUI';
import CourseCurriculum from './CourseCurriculum';
import CourseForm from './CourseForm';

const money = (value: string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(value));

export function ContentTab() {
  const params = useSearchParams();
  const toast = useToast();
  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [categories, setCategories] = useState<ManagedCategory[]>([]);
  const [tutors, setTutors] = useState<ManagedTutor[]>([]);
  const [courseId, setCourseId] = useState(params.get('course') || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rows, groups, people] = await Promise.all([managedCourses(), managedCategories(), managedTutors()]);
      setCourses(rows);
      setCategories(groups);
      setTutors(people);
    } catch (err) {
      setError(failureMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!formDirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [formDirty]);

  const course = courses.find((item) => String(item.id) === courseId);

  const openEditor = () => { setFormDirty(false); setFormOpen(true); };
  const closeEditor = () => { setFormOpen(false); setFormDirty(false); setSaving(false); };
  const requestClose = () => { if (saving) return; if (formDirty) setDiscardOpen(true); else closeEditor(); };

  const saved = (next: ManagedCourse) => {
    setCourses((items) => items.map((item) => (item.id === next.id ? next : item)));
    closeEditor();
    toast.push(
      `“${next.title}” was saved. ${next.is_published ? 'Its public course page is updated.' : 'It remains a draft, hidden from visitors.'}`,
      'success',
    );
  };

  const categoryName = course
    ? categories.find((item) => String(item.id) === String(course.category))?.name || 'Category unavailable'
    : '';
  const tutorName = course
    ? tutors.find((item) => String(item.id) === String(course.instructor))?.full_name || 'Tutor unavailable'
    : '';

  return (
    <>
      <AdminSection
        title="Course to manage"
        description="Choose a course, including drafts, to edit its public page, modules and lessons."
        actions={<Action loading={loading} onClick={() => void load()}>Refresh courses</Action>}
      >
        {error && <StatusNote tone="error">{error}</StatusNote>}
        {loading && !courses.length && <Skeleton rows={2} />}

        {!loading && !error && !courses.length && (
          <EmptyState
            icon="bi-journal-plus"
            title="No courses to manage yet"
            description="Create a course first. It becomes available here for its public details, modules and lessons."
            action={<Link className={adminStyles.linkAction} href="/dashboard/courses">Open Courses</Link>}
          />
        )}

        {courses.length > 0 && (
          <Toolbar label="Course selection">
            <Field label="Course">
              <select className={controlClass} value={courseId} onChange={(event) => { setCourseId(event.target.value); closeEditor(); }}>
                <option value="">Select a course, including drafts</option>
                {courses.map((item) => (
                  <option key={item.id} value={item.id}>{item.title} ({item.is_published ? 'Published' : 'Draft'})</option>
                ))}
              </select>
            </Field>
          </Toolbar>
        )}

        {!loading && !error && courseId && !course && courses.length > 0 && (
          <EmptyState
            icon="bi-search"
            title="This course is no longer available"
            description="It may have been deleted or moved. Choose another course above."
            action={<Action onClick={() => setCourseId('')}>Clear selection</Action>}
          />
        )}

        {!loading && !error && !courseId && courses.length > 0 && (
          <EmptyState
            icon="bi-arrow-up-circle"
            title="Choose a course to start editing"
            description="Pick a course above to manage its public page, price, category, tutor, modules and lessons."
          />
        )}

        {course && (
          <>
            <AdminList label="Selected course">
              <AdminRow
                thumbnail={course.thumbnail || course.image_url || undefined}
                placeholder="bi-journal-bookmark"
                title={course.title}
                badges={<>
                  <Pill tone={course.is_published ? 'live' : 'draft'}>{course.is_published ? 'Published' : 'Draft'}</Pill>
                  <Pill tone="muted">{course.level}</Pill>
                </>}
                meta={`${categoryName} · ${tutorName} · ${money(course.price)}${course.duration ? ` · ${course.duration}` : ''}`}
                description={course.tagline || course.description}
                actions={<>
                  <Action onClick={openEditor}>Edit course details</Action>
                  {course.is_published && (
                    <LinkAction href={`/course?slug=${encodeURIComponent(course.slug)}`} external>View public page</LinkAction>
                  )}
                </>}
              />
            </AdminList>
            {!course.is_published && (
              <StatusNote>This course is a draft. Manage its content freely here, then publish it from Courses when its public page is ready.</StatusNote>
            )}
          </>
        )}
      </AdminSection>

      {course && <CourseCurriculum key={course.id} course={course} />}

      {course && (
        <Drawer
          open={formOpen}
          title={`Editing “${course.title}”`}
          description="Changes reach the public course page immediately while the course is published."
          onClose={requestClose}
          footer={<>
            <Action disabled={saving} onClick={requestClose}>Cancel</Action>
            <Action type="submit" form="content-course-form" intent="primary" loading={saving}>
              {course.is_published ? 'Save course' : 'Save draft'}
            </Action>
          </>}
        >
          <CourseForm
            formId="content-course-form"
            course={course}
            categories={categories}
            tutors={tutors}
            onCategoryCreated={(category) => setCategories((items) => [...items, category])}
            onSaved={saved}
            onDirtyChange={setFormDirty}
            onBusyChange={setSaving}
          />
        </Drawer>
      )}

      {discardOpen && <ConfirmDelete
        title="Discard unsaved changes"
        description="Close the course form? Everything you typed will be lost. Nothing is saved until you choose Save course."
        busy={false}
        error=""
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => { setDiscardOpen(false); closeEditor(); }}
      />}
    </>
  );
}
export default ContentTab;
