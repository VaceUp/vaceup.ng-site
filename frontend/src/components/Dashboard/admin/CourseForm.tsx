'use client';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { courseEndpoint, failureMessage, type ManagedCourse, type ManagedCategory, type ManagedTutor, type CourseLevel } from '@/lib/course-management';
import { Action, Field, Feedback, styles } from './AuthoringUI';
import CreateCategoryDialog from './CreateCategoryDialog';

export default function CourseForm({ course, categories, tutors, onSaved, onCancel, onCategoryCreated }: {
  course?: ManagedCourse; categories: ManagedCategory[]; tutors: ManagedTutor[];
  onSaved: (course: ManagedCourse) => void; onCancel: () => void;
  onCategoryCreated?: (category: ManagedCategory) => void;
}) {
  const [form, setForm] = useState({ title: course?.title || '', description: course?.description || '',
    category: String(course?.category || ''), instructor: String(course?.instructor || ''),
    level: course?.level || 'beginner' as CourseLevel, price: course?.price || '0.00',
    duration: course?.duration || '', image_url: course?.image_url || '', is_published: course?.is_published || false,
    tagline: course?.tagline || '', learning_outcomes: course?.learning_outcomes || '', requirements: course?.requirements || '',
    benefits: course?.benefits || '', target_audience: course?.target_audience || '', outline: course?.outline || '' });
  const [creatingCategory, setCreatingCategory] = useState(false), [newCategories, setNewCategories] = useState<ManagedCategory[]>([]);
  const availableCategories = [...categories, ...newCategories.filter((item) => !categories.some((existing) => existing.id === item.id))];
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [cover, setCover] = useState<File | null>(null), [removeCover, setRemoveCover] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const payload: Record<string, unknown> = { ...form, category: Number(form.category), instructor: Number(form.instructor) };
      if (course && String(course.instructor) === form.instructor) delete payload.instructor;
      if (removeCover) payload.thumbnail = null;
      let body: string | FormData = JSON.stringify(payload);
      if (cover) {
        if (cover.size > 5 * 1024 * 1024) throw new Error('Choose a cover image smaller than 5 MB.');
        body = new FormData();
        for (const [key, value] of Object.entries(payload)) if (key !== 'thumbnail') body.append(key, String(value));
        body.append('thumbnail', cover);
      }
      onSaved(await api.request<ManagedCourse>(course ? courseEndpoint(course) : '/courses/', {
        method: course ? 'PATCH' : 'POST', body,
      }));
    } catch (err) { setError(failureMessage(err)); }
    finally { setBusy(false); }
  }
  return <><form onSubmit={save} className={styles.stack} aria-busy={busy} aria-label={course ? `Edit ${course.title}` : 'Create course'}>
    <h3>{course ? `Edit ${course.title}` : 'New course'}</h3>
    <fieldset disabled={busy} className={styles.stack}>
      <div className={styles.grid}>
        <Field label="Course title"><input required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
        <div className={styles.stack}><Field label="Category"><select required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="">Select a category</option>{availableCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><div><Action onClick={() => setCreatingCategory(true)}>Create missing category</Action></div></div>
        <Field label="Assigned tutor"><select required value={form.instructor} onChange={(event) => setForm({ ...form, instructor: event.target.value })}><option value="">Select an active tutor</option>{course && !tutors.some((tutor) => String(tutor.id) === form.instructor) && <option value={course.instructor}>Current tutor (inactive or unavailable)</option>}{tutors.map((item) => <option key={item.id} value={item.id}>{item.full_name || item.email}</option>)}</select></Field>
        <Field label="Level"><select value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value as CourseLevel })}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></Field>
        <Field label="Price (NGN)"><input type="number" required min="0" max="99999999.99" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></Field>
        <Field label="Duration"><input maxLength={80} value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} /></Field>
      </div>
      <Field label="Description"><textarea rows={5} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
      <Field label="Short introduction"><input maxLength={300} value={form.tagline} onChange={(event) => setForm({ ...form, tagline: event.target.value })} /></Field>
      <Field label="Who this course is for"><input maxLength={200} value={form.target_audience} onChange={(event) => setForm({ ...form, target_audience: event.target.value })} /></Field>
      <div className={styles.grid}>{(['learning_outcomes', 'requirements', 'benefits'] as const).map((key) => <Field key={key} label={{ learning_outcomes: 'What students will learn (one item per line)', requirements: 'Requirements (one item per line)', benefits: 'What is included (one item per line)' }[key]}><textarea rows={5} maxLength={20000} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></Field>)}</div>
      <Field label="Public course outline"><textarea rows={10} maxLength={20000} value={form.outline} onChange={(event) => setForm({ ...form, outline: event.target.value })} /></Field>
      <p className={styles.muted}>These details appear on the public course page when published. Use headings and one topic per line for the outline. Do not paste paid lesson content here; add that under Modules and lessons below.</p>
      <Field label="Cover image URL"><input type="url" maxLength={200} value={form.image_url} onChange={(event) => setForm({ ...form, image_url: event.target.value })} /></Field>
      <Field label="Upload cover image (JPEG, PNG or WebP; up to 5 MB)"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setCover(event.target.files?.[0] ?? null)} /></Field>
      {course?.thumbnail && <label className={styles.check}><input type="checkbox" checked={removeCover} onChange={(event) => setRemoveCover(event.target.checked)} />Remove current uploaded cover</label>}
      <p className={styles.muted}>Use an image you have permission to publish. An uploaded cover takes priority over the URL; remove it to use the URL instead. Existing storage files are retained.</p>
      <label className={styles.check}><input type="checkbox" checked={form.is_published} onChange={(event) => setForm({ ...form, is_published: event.target.checked })} />Published on the public website</label>
      <p className={styles.muted}>Leave this unchecked to keep a draft visible only to the admin and assigned tutor.</p>
    </fieldset>
    <Feedback error={error} />
    <div className={styles.row}><Action type="submit" intent="primary" loading={busy}>{course ? 'Save course' : 'Create course'}</Action><Action disabled={busy} onClick={onCancel}>Cancel editing</Action></div>
  </form>{creatingCategory && <CreateCategoryDialog onCancel={() => setCreatingCategory(false)} onCreated={(category) => {
    setNewCategories((items) => [...items, category]); onCategoryCreated?.(category); setForm((current) => ({ ...current, category: String(category.id) })); setCreatingCategory(false);
  }} />}</>;
}
