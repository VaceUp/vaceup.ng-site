'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { failureMessage, type ManagedTutor } from '@/lib/course-management';
import { Action, Field, Feedback, styles } from './AuthoringUI';

interface Preview { slug: string; title: string; category: string; price: string; duration: string; existing_id: number | null; }
interface Result { detail: string; created: string[]; kept: string[]; enriched: string[]; }
export default function HomepageCatalogImport({ tutors, onImported }: { tutors: ManagedTutor[]; onImported: () => Promise<void> }) {
  const [rows, setRows] = useState<Preview[]>([]), [tutor, setTutor] = useState(''), [fill, setFill] = useState(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState<Result | null>(null);
  const report = (err: unknown) => setError(err instanceof ApiError && [404, 405].includes(err.status)
    ? 'The backend catalogue patch is not installed. Upload the changed-files ZIP, run migrations, and restart the cPanel Python app. No course data has been changed.' : failureMessage(err));
  const preview = useCallback(async () => { setLoading(true); setError(''); try { setRows((await api.request<{ courses: Preview[] }>('/courses/import-homepage/')).courses); } catch (err) { report(err); } finally { setLoading(false); } }, []);
  useEffect(() => { void preview(); }, [preview]);
  return <form className={`${styles.panel} ${styles.stack}`} aria-label="Import original catalogue" onSubmit={async (event) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setResult(null);
    try { setResult(await api.request<Result>('/courses/import-homepage/', { method: 'POST', body: JSON.stringify({ instructor: Number(tutor), fill_missing_details: fill }) })); await preview(); await onImported(); }
    catch (err) { report(err); } finally { setBusy(false); }
  }}>
    <h3>Restore the original catalogue</h3>
    <p className={styles.muted}>Includes the six professional programmes and four children&apos;s programmes from the original catalogue. New courses start as drafts with their descriptions, public outlines and original prices. Review everything in Content before publishing.</p>
    <Feedback error={error} message={result?.detail} />
    {result && <div className={styles.stack}>{(['created', 'kept', 'enriched'] as const).map((key) => result[key].length > 0 && <p key={key}><strong>{{ created: 'New drafts', kept: 'Existing courses retained', enriched: 'Blank public details filled' }[key]}:</strong> {result[key].join(', ')}</p>)}</div>}
    {loading ? <p role="status">Checking original courses...</p> : <ul className={styles.list}>{rows.map((item) => <li key={item.slug}><strong>{item.title}</strong> <span className={styles.badge}>{item.existing_id ? 'Already in catalogue' : 'Will create draft'}</span>{!item.existing_id && <p className={styles.muted}>{item.category} / NGN {Number(item.price).toLocaleString('en-NG')} / {item.duration}</p>}</li>)}</ul>}
    <Field label="Tutor for newly imported courses"><select required disabled={busy} value={tutor} onChange={(event) => setTutor(event.target.value)}><option value="">Select an active tutor</option>{tutors.map((item) => <option key={item.id} value={item.id}>{item.full_name || item.email}</option>)}</select></Field>
    {!tutors.length && <p>No active tutor is available. Activate or add a tutor under Users first.</p>}
    <label className={styles.check}><input type="checkbox" disabled={busy} checked={fill} onChange={(event) => setFill(event.target.checked)} />Also fill blank public details on matching courses</label>
    <p className={styles.muted}>This option fills only empty introductions, audience, outcomes, benefits and outlines. Existing prices, titles, tutors, categories and authored details stay unchanged. Filled details on published courses become public immediately. No lessons or student progress are created or changed.</p>
    <div className={styles.row}><Action type="submit" intent="primary" loading={busy} disabled={loading || !tutor || !rows.length || !!error}>Import missing courses as drafts</Action><Action disabled={busy} loading={loading} onClick={() => void preview()}>Refresh import preview</Action></div>
  </form>;
}
