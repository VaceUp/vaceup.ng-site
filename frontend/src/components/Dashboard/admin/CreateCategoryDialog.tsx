'use client';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { NativeDialog } from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { failureMessage, type ManagedCategory } from '@/lib/course-management';
import { Action, Field, StatusNote, TextInput, adminStyles, dialogClass, formClass } from './AdminUI';

export default function CreateCategoryDialog({ onCreated, onCancel }: {
  onCreated: (category: ManagedCategory) => void; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); if (trigger?.isConnected) trigger.focus(); };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      onCreated(await api.request<ManagedCategory>('/categories/', { method: 'POST', body: JSON.stringify({ name: name.trim() }) }));
    } catch (err) {
      setError(failureMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <NativeDialog
      ref={dialog}
      className={dialogClass}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}
    >
      <form className={formClass} onSubmit={(event) => void submit(event)} aria-busy={busy}>
        <div className={adminStyles.stack}>
          <h2 id={titleId} className={adminStyles.dialogTitle}>Create category</h2>
          <p className={adminStyles.hint}>Your course details stay in place. The new category is selected automatically.</p>
        </div>
        {error && <StatusNote tone="error">{error}</StatusNote>}
        <Field label="Category name" required>
          <TextInput
            autoFocus
            required
            maxLength={120}
            disabled={busy}
            value={name}
            onChange={(event) => { setName(event.target.value); setError(''); }}
          />
        </Field>
        <div className={adminStyles.actions}>
          <Action disabled={busy} onClick={onCancel}>Cancel</Action>
          <Action type="submit" intent="primary" loading={busy} disabled={!name.trim()}>Create category</Action>
        </div>
      </form>
    </NativeDialog>
  );
}
