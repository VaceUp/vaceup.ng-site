'use client';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { failureMessage, type ManagedCategory } from '@/lib/course-management';
import { Action, Field, Feedback, ConfirmDelete, styles } from './AuthoringUI';

export default function CategoryManager({ categories, onChanged }: { categories: ManagedCategory[]; onChanged: () => Promise<void> }) {
  const [name, setName] = useState(''), [editing, setEditing] = useState<ManagedCategory | null>(null);
  const [saving, setSaving] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [deleting, setDeleting] = useState<ManagedCategory | null>(null), [deleteError, setDeleteError] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault(); if (saving) return; setSaving(true); setMessage(''); setError('');
    try {
      await api.request(editing ? `/categories/${encodeURIComponent(editing.slug)}/` : '/categories/', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify({ name: name.trim() }) });
      setName(''); setEditing(null); setMessage('Category saved.');
      await onChanged();
    } catch (err) { setError(failureMessage(err)); }
    finally { setSaving(false); }
  }
  return <section aria-labelledby="categories-heading" className={styles.stack}>
    <h3 id="categories-heading">Categories</h3><p className={styles.muted}>Create or rename the groups in your catalogue. Categories with courses cannot be deleted until those courses are reassigned.</p>
    <form onSubmit={save} className={styles.row}>
      <Field label={editing ? 'Category name' : 'New category name'}><input autoComplete="off" required maxLength={120} disabled={saving} value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Action type="submit" intent="primary" disabled={!name.trim()} loading={saving}>{editing ? 'Save category' : 'Add category'}</Action>
      {editing && <Action disabled={saving} onClick={() => { setEditing(null); setName(''); }}>Cancel rename</Action>}
    </form>
    <Feedback error={error} message={message} />
    <ul className={styles.list}>{categories.map((category) => <li key={category.id} className={`${styles.row} ${styles.between}`}><span>{category.name}</span><div className={styles.row}>
      <Action disabled={saving} aria-label={`Rename ${category.name}`} onClick={() => { setEditing(category); setName(category.name); setMessage(''); setError(''); }}>Rename</Action>
      <Action intent="danger" disabled={saving} aria-label={`Delete category ${category.name}`} onClick={() => { setDeleting(category); setDeleteError(''); }}>Delete category</Action>
    </div></li>)}</ul>
    {!categories.length && <p className={styles.muted}>No categories yet. Add your first category above.</p>}
    {deleting && <ConfirmDelete title="Delete category" description={`Delete ${deleting.name}? This cannot be undone. Courses will not be deleted; the server rejects this action if the category is still in use.`} busy={saving} error={deleteError} onCancel={() => setDeleting(null)} onConfirm={async () => {
      if (saving) return; setSaving(true); setDeleteError('');
      try { await api.request(`/categories/${encodeURIComponent(deleting.slug)}/`, { method: 'DELETE' }); setDeleting(null); setMessage('Category deleted.'); await onChanged(); }
      catch (err) { setDeleteError(failureMessage(err)); }
      finally { setSaving(false); }
    }} />}
  </section>;
}
