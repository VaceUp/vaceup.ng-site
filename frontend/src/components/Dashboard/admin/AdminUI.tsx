'use client';

/**
 * Admin design layer. Screens compose these instead of writing their own cards,
 * rows, fields and status pills, so one token change restyles the whole panel.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { NativeDialog } from '@/components/ui/Modal';
import { ADMIN_SECTIONS, type AdminTab } from '@/lib/admin-sections';
import { cn } from '@/lib/utils';
import { Action } from './AuthoringUI';
import styles from './admin.module.css';

export { Action } from './AuthoringUI';
export const adminStyles = styles;

/* ------------------------------------------------------------------ page */

export function AdminPage({ tab, actions, children }: { tab: AdminTab; actions?: ReactNode; children: ReactNode }) {
  const section = ADMIN_SECTIONS.find((item) => item.id === tab)!;
  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <div className={styles.stack}>
          <p className={styles.eyebrow}>{section.group}</p>
          <h1 className={styles.title}>{section.name}</h1>
          <p className={styles.lede}>{section.description}</p>
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function AdminSection({ title, description, actions, children, id }: {
  title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; id?: string;
}) {
  const headingId = id ?? `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.sectionHead}>
        <div>
          <h3 id={headingId} className={styles.sectionTitle}>{title}</h3>
          {description && <p className={styles.hint}>{description}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

/* ----------------------------------------------------------------- forms */

export function FormGrid({ children, columns = 2, className }: { children: ReactNode; columns?: 1 | 2 | 3; className?: string }) {
  return <div className={cn(styles.grid, columns === 1 && styles['grid--one'], columns === 3 && styles['grid--three'], className)}>{children}</div>;
}

export function Field({ label, hint, error, required, optional, wide, children }: {
  label: string; hint?: ReactNode; error?: string; required?: boolean; optional?: boolean; wide?: boolean; children: ReactNode;
}) {
  return (
    <label className={cn(styles.field, wide && styles['span--all'])}>
      <span className={styles.label}>
        {label}
        {required && <span className={styles.required} aria-hidden="true">*</span>}
        {optional && <span className={styles.optional}>optional</span>}
      </span>
      {children}
      {error && <span className={styles.errorText} role="alert">{error}</span>}
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}

export const controlClass = styles.control;
export const formClass = styles.form;
export const dialogClass = styles.dialog;

export function FormGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className={styles.formGroup}>
      {title && <p className={styles.formGroupTitle}>{title}</p>}
      {children}
    </div>
  );
}

export function TextInput({ className, invalid, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; className?: string }) {
  return <input {...props} aria-invalid={invalid ? 'true' : undefined} className={cn(styles.control, className)} />;
}

export function CheckRow({ label, hint, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={cn(styles.checkRow, className)}>
      <input type="checkbox" {...props} />
      <span className={styles.rowMain}>
        <span className={styles.rowTitle}>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </span>
    </label>
  );
}

export function FileField({ label, hint, error, file, currentUrl, onFile, ...props }: {
  label: string; hint?: ReactNode; error?: string; file?: File | null; currentUrl?: string;
  onFile?: (file: File | null) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const picked = useObjectUrl(file);
  const preview = picked ?? currentUrl;
  return (
    <Field label={label} hint={hint} error={error}>
      <div className={styles.dropzone}>
        {preview
          ? <img src={preview} alt="" className={styles.thumb} />
          : <span className={cn(styles.thumb, styles.thumbSlot)} aria-hidden="true"><i className="bi bi-image" /></span>}
        <input {...props} type="file" onChange={(event) => onFile?.(event.target.files?.[0] ?? null)} />
      </div>
    </Field>
  );
}

function useObjectUrl(file?: File | null) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!file) { setUrl(undefined); return undefined; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

export function StickyBar({ dirty, label = 'Save your changes', children }: { dirty?: boolean; label?: string; children: ReactNode }) {
  return (
    <div className={styles.sticky}>
      <span className={styles.dirtyFlag} data-on={dirty ? 'true' : 'false'}>{dirty ? 'Unsaved changes' : label}</span>
      <div className={styles.actions}>{children}</div>
    </div>
  );
}

/* ----------------------------------------------------------------- lists */

export function Toolbar({ label, children }: { label: string; children: ReactNode }) {
  return <div className={styles.toolbar} role="group" aria-label={label}>{children}</div>;
}

export function AdminList({ label, children }: { label: string; children: ReactNode }) {
  return <ul className={styles.list} aria-label={label}>{children}</ul>;
}

export function AdminRow({ thumbnail, round, placeholder, title, meta, description, badges, actions }: {
  thumbnail?: ReactNode; round?: boolean; placeholder?: string; title: ReactNode; meta?: ReactNode; description?: ReactNode;
  badges?: ReactNode; actions?: ReactNode;
}) {
  const media = typeof thumbnail === 'string'
    ? <img src={thumbnail} alt="" className={cn(styles.thumb, round && styles['thumb--round'])} />
    : thumbnail;
  return (
    <li className={styles.row}>
      {media ?? (placeholder && (
        <span className={cn(styles.thumb, round && styles['thumb--round'], styles.thumbSlot)} aria-hidden="true">
          <i className={cn('bi', placeholder)} />
        </span>
      ))}
      <div className={styles.rowMain}>
        <div className={styles.rowTop}>
          <span className={styles.rowTitle}>{title}</span>
          {badges}
        </div>
        {meta && <p className={styles.rowMeta}>{meta}</p>}
        {description && <p className={styles.rowDesc}>{description}</p>}
      </div>
      {actions && <div className={styles.rowActions}>{actions}</div>}
    </li>
  );
}

export function LinkAction({ href, external, children }: { href: string; external?: boolean; children: ReactNode }) {
  return (
    <a
      href={href}
      className={styles.linkAction}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
      {external && <i className="bi bi-box-arrow-up-right" aria-hidden="true" />}
    </a>
  );
}

export function Pill({ tone = 'neutral', children }: { tone?: 'neutral' | 'live' | 'draft' | 'danger' | 'muted'; children: ReactNode }) {
  return <span className={cn(styles.pill, tone !== 'neutral' && styles[`pill--${tone}`])}>{children}</span>;
}

export function Pager({ page, count, hasNext, label, onPrev, onNext, busy }: {
  page: number; count: number; hasNext: boolean; label: string; onPrev: () => void; onNext: () => void; busy?: boolean;
}) {
  if (count === 0) return null;
  return (
    <nav className={styles.pager} aria-label={`${label} pages`}>
      <Action disabled={page <= 1 || busy} onClick={onPrev}>Previous</Action>
      <span aria-live="polite">Page {page} &middot; {count} {count === 1 ? 'record' : 'records'}</span>
      <Action disabled={!hasNext || busy} onClick={onNext}>Next</Action>
    </nav>
  );
}

/* ----------------------------------------------------------------- states */

export function EmptyState({ icon = 'bi-inbox', title, description, action }: {
  icon?: string; title: string; description?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true"><i className={cn('bi', icon)} /></span>
      <p className={styles.emptyTitle}>{title}</p>
      {description && <p className={styles.emptyBody}>{description}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className={styles.skel} role="status" aria-label="Loading records">
      {Array.from({ length: rows }, (_, i) => <div key={i} className={styles.skelRow} />)}
    </div>
  );
}

export function StatusNote({ tone = 'info', children }: { tone?: 'info' | 'ok' | 'error'; children: ReactNode }) {
  return (
    <div
      className={cn(styles.status, tone === 'ok' && styles['status--ok'], tone === 'error' && styles['status--error'])}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- drawer */

export function Drawer({ open, title, description, onClose, footer, children }: {
  open: boolean; title: string; description?: ReactNode; onClose: () => void; footer?: ReactNode; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    const trigger = document.activeElement as HTMLElement | null;
    if (open) {
      if (dialog.open !== true) dialog.showModal();
      // Land on the first real field, not the header's Close button.
      const body = dialog.querySelector(`.${styles.drawerBody}`);
      (body?.querySelector<HTMLElement>('input, select, textarea')
        ?? dialog.querySelector<HTMLElement>('input, select, textarea, button, a'))?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
    return () => { if (dialog.open) dialog.close(); if (trigger?.isConnected) trigger.focus(); };
  }, [open]);
  if (!open) return null;
  return (
    <NativeDialog ref={ref} className={styles.drawer} aria-labelledby={headingId} onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className={styles.drawerInner}>
        <header className={styles.drawerHead}>
          <div>
            <h2 id={headingId} className={styles.drawerTitle}>{title}</h2>
            {description && <p className={styles.hint}>{description}</p>}
          </div>
          <Action onClick={onClose}>Close</Action>
        </header>
        <div className={styles.drawerBody}>{children}</div>
        {footer && <footer className={styles.drawerFoot}>{footer}</footer>}
      </div>
    </NativeDialog>
  );
}

/* ---------------------------------------------------------------- toasts */

interface Toast { id: number; tone: 'success' | 'error' | 'info'; text: string }
interface ToastApi { push: (text: string, tone?: Toast['tone']) => void }

const ToastContext = createContext<ToastApi>({ push: () => undefined });
export const useToast = () => useContext(ToastContext);

const ICONS: Record<Toast['tone'], string> = { success: 'bi-check-circle', error: 'bi-exclamation-triangle', info: 'bi-info-circle' };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((rows) => rows.filter((row) => row.id !== id)), []);
  const push = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = ++seq.current;
    setToasts((rows) => [...rows.slice(-2), { id, tone, text }]);
    window.setTimeout(() => dismiss(id), tone === 'error' ? 9000 : 5000);
  }, [dismiss]);
  const api = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.toasts}>
        <div aria-live="polite" aria-atomic="false">
          {toasts.map((toast) => (
            <div key={toast.id} className={cn(styles.toast, styles[`toast--${toast.tone}`])} role={toast.tone === 'error' ? 'alert' : 'status'}>
              <i className={cn('bi', ICONS[toast.tone], styles.toastIcon)} aria-hidden="true" />
              <span className={styles.rowMain}>{toast.text}</span>
              <button type="button" className={styles.toastClose} onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
