'use client';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { NativeDialog } from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { failureMessage, type ManagedCategory } from '@/lib/course-management';
import { Action, Field, Feedback, styles } from './AuthoringUI';

export default function CreateCategoryDialog({ onCreated, onCancel }: {
  onCreated: (category: ManagedCategory) => void; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), titleId = useId();
  const [name, setName] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); if (trigger?.isConnected) trigger.focus(); };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { onCreated(await api.request<ManagedCategory>('/categories/', { method: 'POST', body: JSON.stringify({ name: name.trim() }) })); }
    catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  }
  return <NativeDialog ref={dialog} className={`${styles.panel} ${styles.dialog}`} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    <form className={styles.stack} onSubmit={submit} aria-busy={busy}>
      <h2 id={titleId}>Create category</h2><p>Your course details stay in place. The new category will be selected automatically.</p>
      <Field label="Category name"><input autoFocus required maxLength={120} value={name} disabled={busy} aria-invalid={!!error} aria-describedby={error ? `${titleId}-error` : undefined} onChange={(event) => { setName(event.target.value); setError(''); }} /></Field>
      <div id={`${titleId}-error`}><Feedback error={error} /></div>
      <div className={styles.row}><Action type="submit" intent="primary" loading={busy} disabled={!name.trim()}>Create category</Action><Action disabled={busy} onClick={onCancel}>Cancel</Action></div>
    </form>
  </NativeDialog>;
}
