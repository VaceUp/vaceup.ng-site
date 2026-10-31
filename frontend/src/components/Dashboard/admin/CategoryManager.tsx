'use client';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { failureMessage, type ManagedCategory } from '@/lib/course-management';
import { ConfirmDelete } from './AuthoringUI';
import {
  Action, AdminList, AdminRow, AdminSection, Drawer, EmptyState, Field, StatusNote, TextInput, formClass, useToast,
} from './AdminUI';

export default function CategoryManager({ categories, onChanged }: {
  categories: ManagedCategory[]; onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<ManagedCategory | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<ManagedCategory | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const openCreate = () => { setEditing(null); setName(''); setError(''); setOpen(true); };
  const openRename = (category: ManagedCategory) => { setEditing(category); setName(category.name); setError(''); setOpen(true); };
  const close = () => { setOpen(false); setEditing(null); setName(''); setError(''); };

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api.request(editing ? `/categories/${encodeURIComponent(editing.slug)}/` : '/categories/', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      toast.push(editing ? `“${name.trim()}” is the new category name.` : `“${name.trim()}” was added to the catalogue.`, 'success');
      close();
      await onChanged();
    } catch (err) {
      setError(failureMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    setDeleteError('');
    try {
      await api.request(`/categories/${encodeURIComponent(deleting.slug)}/`, { method: 'DELETE' });
      toast.push(`“${deleting.name}” was deleted.`, 'success');
      setDeleting(null);
      await onChanged();
    } catch (err) {
      setDeleteError(failureMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AdminSection
        title="Categories"
        description="Categories group courses in the public catalogue and its filters. A category can only be deleted once no course uses it."
        actions={<Action intent="primary" onClick={openCreate}>Add category</Action>}
      >
        {categories.length
          ? <AdminList label="Course categories">
            {categories.map((category) => (
              <AdminRow
                key={category.id}
                placeholder="bi-tags"
                title={category.name}
                meta={`Catalogue slug: ${category.slug}`}
                actions={<>
                  <Action disabled={busy} onClick={() => openRename(category)}>Rename</Action>
                  <Action intent="danger" disabled={busy} onClick={() => { setDeleteError(''); setDeleting(category); }}>Delete</Action>
                </>}
              />
            ))}
          </AdminList>
          : <EmptyState
            icon="bi-tags"
            title="No categories yet"
            description="A course needs a category. Add the first one here; it becomes available in the course form immediately."
            action={<Action intent="primary" onClick={openCreate}>Add the first category</Action>}
          />}
      </AdminSection>

      <Drawer
        open={open}
        title={editing ? `Renaming “${editing.name}”` : 'Add a category'}
        description="The name appears in the catalogue filters and on every course filed under it."
        onClose={close}
        footer={<>
          <Action disabled={busy} onClick={close}>Cancel</Action>
          <Action type="submit" form="category-form" intent="primary" loading={busy} disabled={!name.trim()}>
            {editing ? 'Save category' : 'Add category'}
          </Action>
        </>}
      >
        <form id="category-form" className={formClass} onSubmit={(event) => void save(event)}>
          {error && <StatusNote tone="error">{error}</StatusNote>}
          <Field label="Category name" required hint="Rename it later without moving any courses.">
            <TextInput autoFocus required maxLength={120} disabled={busy} value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
        </form>
      </Drawer>

      {deleting && <ConfirmDelete
        title="Delete category"
        description={`Delete “${deleting.name}”? Courses are never deleted by this action; the server rejects the request while the category is still in use.`}
        busy={busy}
        error={deleteError}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void remove()}
      />}
    </>
  );
}
