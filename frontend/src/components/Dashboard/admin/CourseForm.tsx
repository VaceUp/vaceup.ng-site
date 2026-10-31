'use client';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import {
  courseEndpoint, failureMessage, type CourseLevel, type ManagedCategory, type ManagedCourse, type ManagedTutor,
} from '@/lib/course-management';
import {
  Action, CheckRow, Field, FileField, FormGrid, FormGroup, StatusNote, TextInput,
  adminStyles, controlClass, formClass,
} from './AdminUI';
import CreateCategoryDialog from './CreateCategoryDialog';

interface CourseDraft {
  title: string; description: string; category: string; instructor: string;
  level: CourseLevel; price: string; duration: string; image_url: string;
  is_published: boolean; tagline: string; learning_outcomes: string;
  requirements: string; benefits: string; target_audience: string; outline: string;
}

const draftFor = (course?: ManagedCourse): CourseDraft => ({
  title: course?.title || '', description: course?.description || '',
  category: String(course?.category || ''), instructor: String(course?.instructor || ''),
  level: course?.level || 'beginner', price: course?.price || '0.00',
  duration: course?.duration || '', image_url: course?.image_url || '',
  is_published: course?.is_published || false, tagline: course?.tagline || '',
  learning_outcomes: course?.learning_outcomes || '', requirements: course?.requirements || '',
  benefits: course?.benefits || '', target_audience: course?.target_audience || '',
  outline: course?.outline || '',
});

export default function CourseForm({ course, categories, tutors, formId, onSaved, onCategoryCreated, onDirtyChange, onBusyChange }: {
  course?: ManagedCourse; categories: ManagedCategory[]; tutors: ManagedTutor[];
  formId: string;
  onSaved: (course: ManagedCourse) => void;
  onCategoryCreated?: (category: ManagedCategory) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const initial = useMemo(() => draftFor(course), [course]);
  const [form, setForm] = useState<CourseDraft>(initial);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategories, setNewCategories] = useState<ManagedCategory[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cover, setCover] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const availableCategories = [
    ...categories,
    ...newCategories.filter((item) => !categories.some((existing) => existing.id === item.id)),
  ];
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || Boolean(cover) || removeCover;
  const dirtyRef = useRef(onDirtyChange);
  dirtyRef.current = onDirtyChange;
  const busyRef = useRef(onBusyChange);
  busyRef.current = onBusyChange;
  useEffect(() => { dirtyRef.current?.(dirty); }, [dirty]);
  useEffect(() => () => { dirtyRef.current?.(false); busyRef.current?.(false); }, []);
  const set = <K extends keyof CourseDraft>(key: K, value: CourseDraft[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    busyRef.current?.(true);
    setError('');
    try {
      if (cover && cover.size > 5 * 1024 * 1024) throw new Error('Choose a cover image smaller than 5 MB.');
      const payload: Record<string, unknown> = {
        ...form, category: Number(form.category), instructor: Number(form.instructor),
      };
      // The server keeps the existing tutor unless the assignment actually changes.
      if (course && String(course.instructor) === form.instructor) delete payload.instructor;
      if (removeCover) payload.thumbnail = null;
      let body: string | FormData = JSON.stringify(payload);
      if (cover) {
        body = new FormData();
        for (const [key, value] of Object.entries(payload)) if (key !== 'thumbnail') body.append(key, String(value));
        body.append('thumbnail', cover);
      }
      onSaved(await api.request<ManagedCourse>(course ? courseEndpoint(course) : '/courses/', {
        method: course ? 'PATCH' : 'POST', body,
      }));
    } catch (err) {
      setError(failureMessage(err));
    } finally {
      setBusy(false);
      busyRef.current?.(false);
    }
  }

  return (
    <>
      <form id={formId} className={formClass} onSubmit={(event) => void save(event)} aria-busy={busy}>
        {error && <StatusNote tone="error">{error}</StatusNote>}

        <FormGroup title="Course basics">
          <Field label="Course title" required>
            <TextInput required maxLength={200} value={form.title} onChange={(event) => set('title', event.target.value)} />
          </Field>
          <FormGrid>
            <div className={adminStyles.stack}>
              <Field label="Category" required>
                <select className={controlClass} required value={form.category} onChange={(event) => set('category', event.target.value)}>
                  <option value="">Select a category</option>
                  {availableCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <div><Action type="button" disabled={busy} onClick={() => setCreatingCategory(true)}>Create missing category</Action></div>
            </div>
            <Field
              label="Assigned tutor"
              required
              hint={!tutors.length ? 'No active tutor is available. Add or reactivate a tutor under Users first.' : undefined}
            >
              <select className={controlClass} required value={form.instructor} onChange={(event) => set('instructor', event.target.value)}>
                <option value="">Select an active tutor</option>
                {course && !tutors.some((tutor) => String(tutor.id) === form.instructor) && (
                  <option value={course.instructor}>Current tutor (inactive or unavailable)</option>
                )}
                {tutors.map((item) => <option key={item.id} value={item.id}>{item.full_name || item.email}</option>)}
              </select>
            </Field>
          </FormGrid>
          <FormGrid columns={3}>
            <Field label="Level">
              <select className={controlClass} value={form.level} onChange={(event) => set('level', event.target.value as CourseLevel)}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </Field>
            <Field label="Price (NGN)" required>
              <TextInput
                type="number" required min="0" max="99999999.99" step="0.01" inputMode="decimal"
                value={form.price} onChange={(event) => set('price', event.target.value)}
              />
            </Field>
            <Field label="Duration" optional>
              <TextInput maxLength={80} placeholder="8 weeks" value={form.duration} onChange={(event) => set('duration', event.target.value)} />
            </Field>
          </FormGrid>
        </FormGroup>

        <FormGroup title="The public course page">
          <FormGrid columns={1}>
            <Field label="Short introduction" optional hint="One line under the course title on the public page.">
              <TextInput maxLength={300} value={form.tagline} onChange={(event) => set('tagline', event.target.value)} />
            </Field>
            <Field label="Who this course is for" optional>
              <TextInput maxLength={200} value={form.target_audience} onChange={(event) => set('target_audience', event.target.value)} />
            </Field>
            <Field label="Description" optional>
              <textarea className={controlClass} rows={5} value={form.description} onChange={(event) => set('description', event.target.value)} />
            </Field>
          </FormGrid>
          <FormGrid columns={3}>
            <Field label="What students will learn" hint="One item per line.">
              <textarea className={controlClass} rows={6} maxLength={20000} value={form.learning_outcomes} onChange={(event) => set('learning_outcomes', event.target.value)} />
            </Field>
            <Field label="Requirements" hint="One item per line.">
              <textarea className={controlClass} rows={6} maxLength={20000} value={form.requirements} onChange={(event) => set('requirements', event.target.value)} />
            </Field>
            <Field label="What is included" hint="One item per line.">
              <textarea className={controlClass} rows={6} maxLength={20000} value={form.benefits} onChange={(event) => set('benefits', event.target.value)} />
            </Field>
          </FormGrid>
          <Field
            label="Course outline"
            optional
            hint="Use headings and one topic per line. Do not paste paid lesson content here; add that under Modules and lessons."
          >
            <textarea className={controlClass} rows={10} maxLength={20000} value={form.outline} onChange={(event) => set('outline', event.target.value)} />
          </Field>
        </FormGroup>

        <FormGroup title="Cover image">
          <FileField
            label="Upload cover"
            hint="JPEG, PNG or WebP up to 5 MB. An uploaded cover takes priority over the URL."
            accept="image/jpeg,image/png,image/webp"
            file={cover}
            currentUrl={removeCover ? undefined : course?.thumbnail || course?.image_url || undefined}
            onFile={setCover}
          />
          <Field label="Or an image URL" optional>
            <TextInput type="url" maxLength={200} placeholder="https://…" value={form.image_url} onChange={(event) => set('image_url', event.target.value)} />
          </Field>
          {course?.thumbnail && (
            <CheckRow
              label="Remove the current uploaded cover"
              hint="The stored file is retained; the page falls back to the image URL above."
              checked={removeCover}
              onChange={(event) => setRemoveCover(event.target.checked)}
            />
          )}
        </FormGroup>

        <FormGroup title="Publication">
          <CheckRow
            label="Published on the public website"
            hint="Leave unchecked to keep a draft that only admins and the assigned tutor can see."
            checked={form.is_published}
            onChange={(event) => set('is_published', event.target.checked)}
          />
        </FormGroup>
      </form>

      {creatingCategory && (
        <CreateCategoryDialog
          onCancel={() => setCreatingCategory(false)}
          onCreated={(category) => {
            setNewCategories((items) => [...items, category]);
            onCategoryCreated?.(category);
            set('category', String(category.id));
            setCreatingCategory(false);
          }}
        />
      )}
    </>
  );
}
