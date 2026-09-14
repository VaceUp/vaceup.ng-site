'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/Button';
import { NativeDialog } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import styles from './authoring.module.css';
export { styles };

export function Action({ intent = 'neutral', className, ...props }: ButtonProps & { intent?: 'neutral' | 'primary' | 'danger' }) {
  return <Button {...props} variant={intent === 'danger' ? 'destructive' : 'outline'} className={cn(styles.action, intent === 'primary' && styles.primary, intent === 'danger' && styles.danger, className)} />;
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}</label>;
}
export function Feedback({ error, message }: { error?: string; message?: string }) {
  return <>{error && <p role="alert" className={cn(styles.status, styles.error)}>{error}</p>}{message && <p role="status" className={styles.status}>{message}</p>}</>;
}
export function ConfirmDelete({ title, description, busy, error, onCancel, onConfirm, confirmationName }: {
  title: string; description: string; busy: boolean; error: string; onCancel: () => void; onConfirm: () => void; confirmationName?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirmation, setConfirmation] = useState('');
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { dialog.current?.close(); if (trigger?.isConnected) trigger.focus(); };
  }, []);
  return <NativeDialog ref={dialog} className={cn(styles.panel, styles.dialog)} aria-labelledby="delete-course-item-title" aria-describedby="delete-course-item-description" onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    <div className={styles.stack}><h2 id="delete-course-item-title">{title}</h2><p id="delete-course-item-description">{description}</p><Feedback error={error} />
      {confirmationName && <Field label={`Type ${confirmationName} to confirm`}><input value={confirmation} disabled={busy} onChange={(event) => setConfirmation(event.target.value)} /></Field>}
      <div className={styles.row}><Action disabled={busy} onClick={onCancel} autoFocus>Cancel</Action><Action intent="danger" disabled={Boolean(confirmationName && confirmation !== confirmationName)} loading={busy} onClick={onConfirm}>{title}</Action></div>
    </div>
  </NativeDialog>;
}
