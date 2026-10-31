'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  managedCourses, managedCategories, managedTutors, courseEndpoint, failureMessage,
  type ManagedCategory, type ManagedCourse, type ManagedTutor,
} from '@/lib/course-management';
import { ConfirmDelete } from './AuthoringUI';
import {
  Action, AdminList, AdminRow, AdminSection, Drawer, EmptyState, Field, LinkAction, Pill, Skeleton,
  StatusNote, TextInput, Toolbar, adminStyles, controlClass, useToast,
} from './AdminUI';
import CategoryManager from './CategoryManager';
import CourseForm from './CourseForm';
import HomepageCatalogImport from './HomepageCatalogImport';

const money = (value: string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(value));

export default function CourseManager() {
  const { user } = useAuth();
  const toast = useToast();
  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [categories, setCategories] = useState<ManagedCategory[]>([]);
  const [tutors, setTutors] = useState<ManagedTutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedCourse | null>(null);
  const [formDirty, setFormDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<ManagedCourse | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    const results = await Promise.allSettled([managedCourses(), managedCategories(), managedTutors()]);
    if (results[0].status === 'fulfilled') setCourses(results[0].value);
    if (results[1].status === 'fulfilled') setCategories(results[1].value);
    if (results[2].status === 'fulfilled') setTutors(results[2].value);
    setError(results.flatMap((result, index) => result.status === 'rejected'
      ? [`${['Courses', 'Categories', 'Tutors'][index]}: ${failureMessage(result.reason)}`]
      : []).join(' '));
    setLoading(false);
  }, []);

  useEffect(() => { if (user?.role === 'admin') void refresh(); }, [refresh, user?.id, user?.role]);

  useEffect(() => {
    if (!formDirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [formDirty]);

  if (user?.role !== 'admin') return <p role="alert">Administrator access is required to manage the catalogue.</p>;

  const shown = courses.filter((course) => (filter === 'all' || course.is_published === (filter === 'published'))
    && `${course.title} ${course.tagline || ''}`.toLowerCase().includes(search.trim().toLowerCase()));

  const openCreate = () => { setEditing(null); setFormDirty(false); setFormOpen(true); };
  const openEdit = (course: ManagedCourse) => { setEditing(course); setFormDirty(false); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); setFormDirty(false); setSaving(false); };
  const requestClose = () => { if (saving) return; if (formDirty) setDiscardOpen(true); else closeForm(); };

  const saved = (course: ManagedCourse) => {
    setCourses((current) => [course, ...current.filter((item) => item.id !== course.id)]);
    toast.push(editing
      ? `“${course.title}” was updated${course.is_published ? ' and is live on the website.' : ' and stays a draft.'}`
      : `“${course.title}” was created as ${course.is_published ? 'a published course' : 'a draft'}. ${course.is_published ? 'It is live on the website.' : 'Publish it when the public page is ready.'}`, 'success');
    closeForm();
  };

  const toggle = async (course: ManagedCourse) => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await api.request<ManagedCourse>(courseEndpoint(course), {
        method: 'PATCH', body: JSON.stringify({ is_published: !course.is_published }),
      });
      setCourses((items) => items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      toast.push(course.is_published
        ? `“${course.title}” was moved back to draft and hidden from visitors.`
        : `“${course.title}” is now live on the public website.`, 'success');
    } catch (err) {
      toast.push(failureMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeDraft = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    setDeleteError('');
    try {
      await api.request(courseEndpoint(deleting), { method: 'DELETE' });
      setCourses((items) => items.filter((item) => item.id !== deleting.id));
      toast.push(`Empty draft “${deleting.title}” was deleted.`, 'success');
      setDeleting(null);
    } catch (err) {
      setDeleteError(failureMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const categoryName = (course: ManagedCourse) =>
    categories.find((category) => String(category.id) === String(course.category))?.name || 'Category unavailable';

  return (
    <>
      <AdminSection
        title="Course catalogue"
        description={`${courses.length} ${courses.length === 1 ? 'course' : 'courses'} in total. Drafts are never shown on the public homepage.`}
        actions={<>
          <Action loading={loading} disabled={busy} onClick={() => void refresh()}>Refresh</Action>
          <Action intent="primary" disabled={busy} onClick={openCreate}>New course</Action>
        </>}
      >
        {error && <StatusNote tone="error">{error}</StatusNote>}
        {error && courses.length > 0 && <p className={adminStyles.hint}>Showing the last catalogue we could load.</p>}

        <Toolbar label="Catalogue filters">
          <TextInput
            type="search"
            aria-label="Search courses"
            placeholder="Search courses by title or introduction"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Field label="Show">
            <select className={controlClass} value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All courses</option>
              <option value="draft">Drafts</option>
              <option value="published">Published</option>
            </select>
          </Field>
        </Toolbar>

        {loading && !courses.length && <Skeleton rows={3} />}

        {!loading && !error && !shown.length && (
          <EmptyState
            icon="bi-journal-plus"
            title={courses.length ? 'No courses match these filters' : 'Your course catalogue starts here'}
            description={courses.length
              ? 'Clear the search or switch back to All courses to see the rest of the catalogue.'
              : 'Create the first course, then publish it when its public page is ready. You can also restore the original catalogue below.'}
            action={courses.length
              ? <Action onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</Action>
              : <Action intent="primary" onClick={openCreate}>Create the first course</Action>}
          />
        )}

        {shown.length > 0 && (
          <>
            <AdminList label="Courses">
              {shown.map((course) => (
                <AdminRow
                  key={course.id}
                  thumbnail={course.thumbnail || course.image_url || undefined}
                  placeholder="bi-journal-bookmark"
                  title={course.title}
                  badges={<Pill tone={course.is_published ? 'live' : 'draft'}>{course.is_published ? 'Published' : 'Draft'}</Pill>}
                  meta={`${categoryName(course)} · ${money(course.price)} · ${course.level}${course.duration ? ` · ${course.duration}` : ''}`}
                  description={course.tagline || course.description}
                  actions={<>
                    <LinkAction href={`/dashboard?tab=content&course=${course.id}`}>Manage content</LinkAction>
                    <Action disabled={busy} onClick={() => void toggle(course)}>{course.is_published ? 'Unpublish' : 'Publish'}</Action>
                    {!course.is_published && (
                      <Action intent="danger" disabled={busy} onClick={() => { setDeleteError(''); setDeleting(course); }}>Delete draft</Action>
                    )}
                  </>}
                />
              ))}
            </AdminList>
            <p className={adminStyles.hint}>{shown.length} of {courses.length} courses shown.</p>
          </>
        )}
      </AdminSection>

      <CategoryManager
        categories={categories}
        onChanged={async () => { setCategories(await managedCategories()); }}
      />

      <HomepageCatalogImport
        tutors={tutors}
        onImported={async () => { await refresh(); }}
      />

      <Drawer
        open={formOpen}
        title={editing ? `Editing “${editing.title}”` : 'Create a course'}
        description={editing
          ? 'Changes reach the public course page immediately when the course is published.'
          : 'New courses start as a draft until you publish them.'}
        onClose={requestClose}
        footer={<>
          <Action disabled={saving} onClick={requestClose}>Cancel</Action>
          <Action type="submit" form="course-form" intent="primary" loading={saving}>
            {editing ? 'Save course' : 'Create course'}
          </Action>
        </>}
      >
        <CourseForm
          key={editing?.id ?? 'new'}
          formId="course-form"
          course={editing ?? undefined}
          categories={categories}
          tutors={tutors}
          onCategoryCreated={(category) => setCategories((items) => [...items, category])}
          onSaved={saved}
          onDirtyChange={setFormDirty}
          onBusyChange={setSaving}
        />
      </Drawer>

      {discardOpen && <ConfirmDelete
        title="Discard unsaved changes"
        description="Close the course form? Everything you typed will be lost. Nothing is saved until you choose Save course."
        busy={false}
        error=""
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => { setDiscardOpen(false); closeForm(); }}
      />}

      {deleting && <ConfirmDelete
        title="Delete draft course"
        description={`Delete “${deleting.title}”? Only empty drafts without linked records can be deleted. Keep other courses unpublished to preserve their content and history.`}
        confirmationName={deleting.title}
        busy={busy}
        error={deleteError}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void removeDraft()}
      />}
    </>
  );
}
