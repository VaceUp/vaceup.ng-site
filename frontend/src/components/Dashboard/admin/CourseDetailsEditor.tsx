'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { type CatalogCategory } from '@/lib/public-catalog';
import { catalogAction, catalogInput } from '@/components/homepage/PublicCatalog';

interface EditableCourse { id: number; title: string; description: string; category: number; instructor: number; duration: string; image_url: string; duration_months?: number; installment_eligible?: boolean; installment_first_amount?: string; installment_final_amount?: string; }
export default function CourseDetailsEditor({ course, categories, instructors, onSaved }: {
  course: EditableCourse; categories: CatalogCategory[]; instructors: { id: string; full_name: string; email: string }[]; onSaved: () => void;
}) {
  const [form, setForm] = useState({ title: course.title, description: course.description || '', category: String(course.category), instructor: String(course.instructor), duration: course.duration || '', image_url: course.image_url || '', duration_months: String(course.duration_months || 1), installment_eligible: !!course.installment_eligible, installment_first_amount: course.installment_first_amount || '', installment_final_amount: course.installment_final_amount || '' });
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  return <details className="w-full rounded-xl border border-line p-3 text-navy-950">
    <summary className="min-h-11 cursor-pointer font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy-900">Edit details for {course.title}</summary>
    <form className="space-y-4 pt-4" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setMessage(''); setError('');
      try { await api.request('/admin/dashboard/courses/update/', { method: 'POST', body: JSON.stringify({ course_id: course.id, ...form }) }); setMessage('Course details saved. Published changes appear in the public catalogue.'); onSaved(); }
      catch (err) { setError(err instanceof Error ? err.message : 'Unable to save course details. Please try again.'); }
      finally { setBusy(false); }
    }}>
      <label className="block text-sm font-semibold">Title<input required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={catalogInput} /></label>
      <label className="block text-sm font-semibold">Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className={catalogInput} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="min-w-0 text-sm font-semibold">Category<select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={catalogInput}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="min-w-0 text-sm font-semibold">Tutor<select required value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} className={catalogInput}>{!instructors.some((item) => String(item.id) === form.instructor) && <option value={form.instructor}>Current tutor (select an active tutor to change)</option>}{instructors.map((item) => <option key={item.id} value={item.id}>{item.full_name || item.email}</option>)}</select></label>
        <label className="min-w-0 text-sm font-semibold">Duration<input maxLength={80} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className={catalogInput} /></label>
        <label className="min-w-0 text-sm font-semibold">Duration in months<input type="number" min="1" max="60" value={form.duration_months} onChange={(e) => setForm({ ...form, duration_months: e.target.value })} className={catalogInput} /></label>
        <label className="min-w-0 text-sm font-semibold">Cover image URL<input type="url" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className={catalogInput} /></label>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={form.installment_eligible} onChange={(e) => setForm({ ...form, installment_eligible: e.target.checked })} />Allow two-part payment</label>
      {form.installment_eligible && <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">First installment<input type="number" min="0" step="0.01" value={form.installment_first_amount} onChange={(e) => setForm({ ...form, installment_first_amount: e.target.value })} className={catalogInput} /></label><label className="text-sm font-semibold">Final installment<input type="number" min="0" step="0.01" value={form.installment_final_amount} onChange={(e) => setForm({ ...form, installment_final_amount: e.target.value })} className={catalogInput} /></label></div>}
      <p className="text-sm text-content-muted">An uploaded thumbnail takes priority over the cover URL. Use an image you own or are licensed to use.</p>
      <button disabled={busy} aria-busy={busy} className={catalogAction}>{busy ? 'Saving...' : 'Save course details'}</button>
      {message && <p role="status" className="text-sm">{message}</p>}{error && <p role="alert" className="text-sm text-feedback-error">{error}</p>}
    </form>
  </details>;
}
