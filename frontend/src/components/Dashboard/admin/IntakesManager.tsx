'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { failureMessage } from '@/lib/course-management';
import {
  Action, AdminList, AdminRow, AdminSection, CheckRow, EmptyState, Field,
  FormGrid, Skeleton, StatusNote, TextInput, controlClass,
} from './AdminUI';

interface Intake {
  id: number; title: string; starts_on: string; ends_on: string;
  is_active: boolean; is_archived: boolean; all_courses: boolean;
  courses: number[]; registration_url: string;
}
interface CourseOption { id: number; title: string; is_published: boolean }
type Form = Omit<Intake, 'id'>;
const initial = (): Form => ({
  title: '', starts_on: '', ends_on: '', is_active: false,
  is_archived: false, all_courses: false, courses: [], registration_url: '',
});

async function readPages<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const result = await api.request<{ results: T[]; next: string | null }>(`${path}?page=${page}`);
    rows.push(...result.results);
    if (!result.next) return rows;
  }
  throw new Error('This list is too large to load here. Contact support to manage the archived records.');
}

export default function IntakesManager() {
  const [rows, setRows] = useState<Intake[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [form, setForm] = useState<Form>(initial);
  const [editing, setEditing] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [intakes, options] = await Promise.all([
        readPages<Intake>('/website/intakes/'), readPages<CourseOption>('/courses/'),
      ]);
      setRows(intakes); setCourses(options);
    } catch (reason) { setError(failureMessage(reason)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  function edit(row: Intake) {
    setEditing(row.id); setForm({ ...row }); setMessage(''); setError('');
    document.getElementById('intake-title')?.focus();
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await api.request(`/website/intakes/${editing ? `${editing}/` : ''}`, {
        method: editing ? 'PATCH' : 'POST', body: JSON.stringify(form),
      });
      setEditing(null); setForm(initial());
      await load(); setMessage('Intake saved. Public pages use the next active intake that has not started.');
    } catch (reason) { setError(failureMessage(reason)); }
    finally { setBusy(false); }
  }
  return <>
    <AdminSection title="Intake calendar" description="Applications can remain open. These dates control the next teaching intake shown on the website.">
      {loading ? <Skeleton rows={3} /> : rows.length ? <AdminList label="Academy intakes">
        {rows.map((row) => <AdminRow key={row.id} title={row.title}
          meta={`${row.starts_on} to ${row.ends_on}`}
          description={`${row.is_archived ? 'Archived' : row.is_active ? 'Active' : 'Draft'} / ${row.all_courses ? 'All published courses' : `${row.courses.length} selected courses`}`}
          actions={<Action disabled={busy} onClick={() => edit(row)}>Edit intake</Action>} />)}
      </AdminList> : <EmptyState title="Prepare the next intake" description="Add dates and available courses. Keep an intake in draft until the academy is ready to advertise it." />}
      {!loading && error && <Action onClick={() => void load()}>Retry loading</Action>}
    </AdminSection>
    <AdminSection title={editing ? 'Edit intake' : 'Add intake'} description="Ongoing intakes are excluded from the next-intake notice. Archive past intakes to keep their history.">
      <form onSubmit={(event) => void save(event)} className="space-y-5" aria-busy={busy}>
        {error && <StatusNote tone="error">{error}</StatusNote>}
        {message && <StatusNote tone="ok">{message}</StatusNote>}
        <fieldset disabled={busy || loading} className="space-y-5">
          <FormGrid>
            <Field label="Intake title" required><TextInput id="intake-title" value={form.title} onChange={(event) => set('title', event.target.value)} required maxLength={150} /></Field>
            <Field label="Registration link" optional hint="Leave blank to use the existing course application flow."><TextInput type="url" value={form.registration_url} onChange={(event) => set('registration_url', event.target.value)} /></Field>
            <Field label="Starts on" required><TextInput type="date" value={form.starts_on} onChange={(event) => set('starts_on', event.target.value)} required /></Field>
            <Field label="Ends on" required><TextInput type="date" min={form.starts_on || undefined} value={form.ends_on} onChange={(event) => set('ends_on', event.target.value)} required /></Field>
          </FormGrid>
          <CheckRow label="Available for all published courses" checked={form.all_courses} onChange={(event) => set('all_courses', event.target.checked)} />
          {!form.all_courses && <Field label="Available courses" hint="Select the courses offered in this intake. Use Ctrl or Command to select several.">
            <select multiple className={controlClass} value={form.courses.map(String)} onChange={(event) => set('courses', Array.from(event.target.selectedOptions, (option) => Number(option.value)))}>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}{course.is_published ? '' : ' (draft)'}</option>)}
            </select>
          </Field>}
          <CheckRow label="Advertise this intake" hint="Only active, unarchived intakes appear on public pages." checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked, is_archived: event.target.checked ? false : current.is_archived }))} />
          <CheckRow label="Archive this intake" checked={form.is_archived} onChange={(event) => setForm((current) => ({ ...current, is_archived: event.target.checked, is_active: event.target.checked ? false : current.is_active }))} />
        </fieldset>
        <div className="flex flex-wrap gap-3">
          <Action intent="primary" type="submit" loading={busy} disabled={loading}>Save intake</Action>
          {editing && <Action disabled={busy} onClick={() => { setEditing(null); setForm(initial()); setError(''); }}>Cancel editing</Action>}
        </div>
      </form>
    </AdminSection>
  </>;
}
