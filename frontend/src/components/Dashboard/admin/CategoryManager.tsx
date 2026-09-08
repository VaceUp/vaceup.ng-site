'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { type CatalogCategory } from '@/lib/public-catalog';
import { catalogAction, catalogInput } from '@/components/homepage/PublicCatalog';

export default function CategoryManager({ categories, onChanged }: { categories: CatalogCategory[]; onChanged: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<CatalogCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(''); setError('');
    try {
      await api.request(editing ? `/categories/${encodeURIComponent(editing.slug)}/` : '/categories/', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify({ name: name.trim() }) });
      setName(''); setEditing(null); setMessage('Category saved. It is available in the course category selector.');
      await onChanged();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save the category. Please try again.'); }
    finally { setSaving(false); }
  }
  return <section aria-labelledby="categories-heading" className="space-y-5 rounded-2xl border border-line bg-surface p-5 text-navy-950">
    <h3 id="categories-heading" className="text-2xl font-bold">Categories</h3>
    <p className="text-sm text-content-muted">Define the groups shown in the public catalogue. Each course belongs to one category. Renaming a category keeps its courses connected.</p>
    <ul className="divide-y divide-line">{categories.map((category) => <li key={category.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span>{category.name}</span><button type="button" disabled={saving} className={catalogAction} aria-label={`Rename ${category.name}`} onClick={() => { setEditing(category); setName(category.name); setMessage(''); setError(''); }}>Rename</button></li>)}</ul>
    {categories.length === 0 && <p className="text-sm text-content-muted">No categories loaded. Create one below, or use the homepage import command to add the existing category definitions.</p>}
    <form onSubmit={save} className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 text-sm font-semibold">{editing ? 'Category name' : 'New category name'}<input autoComplete="off" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className={catalogInput} /></label>
      <button disabled={saving || !name.trim()} aria-busy={saving} className={catalogAction}>{saving ? 'Saving...' : editing ? 'Save category' : 'Add category'}</button>
      {editing && <button type="button" disabled={saving} className={catalogAction} onClick={() => { setEditing(null); setName(''); }}>Cancel rename</button>}
    </form>
    {message && <p role="status" className="text-sm">{message}</p>}{error && <p role="alert" className="text-sm text-feedback-error">{error}</p>}
  </section>;
}
