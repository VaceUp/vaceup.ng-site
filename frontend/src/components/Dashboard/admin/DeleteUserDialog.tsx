'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { NativeDialog } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import {
  Action,
  Field,
  StatusNote,
  TextInput,
  adminStyles,
  dialogClass,
} from './AdminUI';

type Target = { id: string | number; email: string; full_name: string };
type Preview = {
  user_id: number; email: string; full_name: string; can_delete: boolean;
  blockers: string[]; records: { model: string; label: string; count: number }[];
  confirmation_token: string | null;
};

/**
 * Permanent account deletion. The preview lists every dependent record first,
 * then requires the account email and the signed-in administrator's password.
 */

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

  return (
    <NativeDialog
      ref={dialog}
      aria-labelledby={heading}
      aria-describedby={description}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      className={cn(dialogClass, adminStyles.form)}
    >
      <form onSubmit={remove} className={adminStyles.form}>
        <div>
          <h2 id={heading} className={adminStyles.dialogTitle}>Permanently delete user</h2>
          <p id={description} className={adminStyles.hint}>
            Delete {target.full_name || target.email} and the related database records listed below.
            This cannot be undone from the panel. Backups, externally stored uploads and retained
            audit records are not erased.
          </p>
        </div>
        <p className={adminStyles.rowTitle}>{target.email}</p>
        {loading && <StatusNote tone="info">Checking related records…</StatusNote>}
        {preview && (
          <>
            {preview.blockers.length > 0 && (
              <StatusNote tone="error">
                <ul className={adminStyles.plainList}>
                  {preview.blockers.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </StatusNote>
            )}
            {preview.can_delete && (
              <>
                <div className={adminStyles.moduleCard}>
                  <p className={adminStyles.formGroupTitle}>Records to remove</p>
                  <ul className={adminStyles.plainList}>
                    {preview.records.map((row) => (
                      <li key={row.model} className={adminStyles.between}>
                        <span>{row.label}</span>
                        <span className={adminStyles.amount}>{row.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className={adminStyles.hint}>
                  Messages disappear from both participants' conversations. Issued certificates removed
                  here will no longer verify. For a temporary restriction, cancel and disable sign-in instead.
                </p>
                <Field label="Type this user's email to confirm" required>
                  <TextInput
                    required
                    type="email"
                    autoComplete="off"
                    spellCheck={false}
                    value={confirmation}
                    disabled={busy}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </Field>
                <Field label="Your administrator password" required hint="Confirms that you are the person making this change.">
                  <TextInput
                    required
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    disabled={busy}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </Field>
              </>
            )}
          </>
        )}
        {error && <StatusNote tone="error">{error}</StatusNote>}
        <div className={adminStyles.actions}>
          <Action disabled={busy} onClick={onClose}>Cancel</Action>
          {error && <Action disabled={busy} onClick={() => setAttempt((value) => value + 1)}>Refresh preview</Action>}
          {preview?.can_delete && (
            <Action
              intent="danger"
              type="submit"
              loading={busy}
              disabled={loading || confirmation.trim().toLowerCase() !== preview.email.toLowerCase() || !password}
            >
              Permanently delete user
            </Action>
          )}
        </div>
      </form>
    </NativeDialog>
  );
}
