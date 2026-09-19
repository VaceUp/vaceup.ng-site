'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { NativeDialog } from '@/components/ui/Modal';
import { catalogInput } from '@/components/homepage/PublicCatalog';

type Target = { id: string | number; email: string; full_name: string };
type Preview = {
  user_id: number; email: string; full_name: string; can_delete: boolean;
  blockers: string[]; records: { model: string; label: string; count: number }[];
  confirmation_token: string | null;
};

export default function DeleteUserDialog({ target, onClose, onDeleted }: {
  target: Target; onClose: () => void; onDeleted: (id: string | number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const description = useId();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { dialog.current?.close(); if (trigger?.isConnected) trigger.focus(); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setPreview(null);
    api.request<Preview>(`/admin/dashboard/users/${encodeURIComponent(String(target.id))}/deletion/`)
      .then((data) => { if (!cancelled) setPreview(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError && err.status === 404
        ? 'The deletion preview is unavailable. This user may have been removed, or the backend deletion update is not installed. Close this dialog and refresh the user directory. If the user is still listed, deploy the matching backend package and restart the Python app. Nothing was deleted.'
        : err instanceof Error ? err.message : 'Could not load the deletion preview.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [target.id, attempt]);

  async function remove(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !preview?.can_delete || !preview.confirmation_token) return;
    setBusy(true); setError('');
    try {
      await api.request('/admin/dashboard/users/delete/', { method: 'POST', body: JSON.stringify({
        user_id: target.id, confirmation_email: confirmation.trim(), admin_password: password,
        confirmation_token: preview.confirmation_token,
      }) });
      setPassword(''); onDeleted(target.id); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Deletion failed. Refresh the preview before trying again.'); }
    finally { setBusy(false); }
  }

  return <NativeDialog ref={dialog} aria-labelledby={heading} aria-describedby={description}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    className="m-auto max-h-dvh w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-5 text-navy-950 shadow-xl backdrop:bg-navy-950/60 sm:p-6">
    <form onSubmit={remove} className="min-w-0 space-y-5">
      <h2 id={heading} className="text-2xl font-bold">Permanently delete user</h2>
      <p id={description} className="break-words text-sm text-content-secondary">Delete {target.full_name || target.email} and the related database records listed below. This cannot be undone from the panel. Backups, externally stored uploads, and retained audit records are not erased.</p>
      <p className="break-all font-semibold">{target.email}</p>
      {loading && <p role="status">Checking related records...</p>}
      {preview && <>
        {preview.blockers.length > 0 && <ul className="list-inside list-disc space-y-2 text-sm text-feedback-error">{preview.blockers.map((item) => <li key={item}>{item}</li>)}</ul>}
        {preview.can_delete && <>
          <div className="rounded-xl border border-line p-4"><h3 className="font-semibold">Records to remove</h3><ul className="mt-2 space-y-1 text-sm">{preview.records.map((row) => <li key={row.model} className="flex justify-between gap-3"><span className="capitalize">{row.label}</span><span>{row.count}</span></li>)}</ul></div>
          <p className="text-sm text-content-secondary">Messages will disappear from both participants' conversations. Issued certificates removed here will no longer verify. For a temporary restriction, cancel and use Disable instead.</p>
          <label className="block text-sm font-semibold">Type this user's email to confirm<input required type="email" autoComplete="off" spellCheck={false} value={confirmation} disabled={busy} onChange={(event) => setConfirmation(event.target.value)} className={catalogInput} /></label>
          <label className="block text-sm font-semibold">Your administrator password<input required type="password" autoComplete="current-password" value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)} className={catalogInput} /></label>
        </>}
      </>}
      {error && <p role="alert" className="text-sm text-feedback-error">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" className="rounded-xl" disabled={busy} onClick={onClose}>Cancel</Button>
        {error && <Button variant="outline" className="rounded-xl" disabled={busy} onClick={() => setAttempt((value) => value + 1)}>Refresh preview</Button>}
        {preview?.can_delete && <Button type="submit" variant="destructive" className="rounded-xl" loading={busy} disabled={loading || confirmation.trim().toLowerCase() !== preview.email.toLowerCase() || !password}>Permanently delete user</Button>}
      </div>
    </form>
  </NativeDialog>;
}
