'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { failureMessage, type ManagedTutor } from '@/lib/course-management';
import {
  Action, AdminList, AdminRow, AdminSection, CheckRow, EmptyState, Field, Pill, Skeleton, StatusNote,
  controlClass, formClass, useToast,
} from './AdminUI';

interface Preview {
  slug: string; title: string; category: string; price: string; duration: string;
  modules?: number; lessons?: number; existing_id: number | null;
}
interface Result { detail: string; created: string[]; kept: string[]; enriched: string[]; }

const REPORT_LABELS = { created: 'New drafts', kept: 'Existing courses retained', enriched: 'Blank public details filled' } as const;
const money = (value: string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(value));

export default function HomepageCatalogImport({ tutors, onImported }: {
  tutors: ManagedTutor[]; onImported: () => Promise<void>;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<Preview[]>([]);
  const [tutor, setTutor] = useState('');
  const [fill, setFill] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  const report = (err: unknown) => setError(err instanceof ApiError && [404, 405].includes(err.status)
    ? 'The backend catalogue patch is not installed. Upload the changed-files ZIP, run migrations, and restart the cPanel Python app. No course data has been changed.'
    : failureMessage(err));

  const preview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows((await api.request<{ courses: Preview[] }>('/courses/import-homepage/')).courses);
    } catch (err) {
      report(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void preview(); }, [preview]);

  async function run(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const outcome = await api.request<Result>('/courses/import-homepage/', {
        method: 'POST',
        body: JSON.stringify({ instructor: Number(tutor), fill_missing_details: fill }),
      });
      setResult(outcome);
      toast.push(outcome.created.length
        ? `${outcome.created.length} course${outcome.created.length === 1 ? '' : 's'} imported as drafts. Review them before publishing.`
        : 'No new courses needed importing. Matching courses were left untouched.', 'success');
      await preview();
      await onImported();
    } catch (err) {
      report(err);
    } finally {
      setBusy(false);
    }
  }

  const missing = rows.filter((row) => !row.existing_id).length;
  const importable = !loading && !error && !!tutor && rows.length > 0;

  return (
    <AdminSection
      title="Curriculum catalogue"
      description="Create the seven professional programmes and five children's programmes from the curriculum brief. Anything the catalogue is missing arrives as a draft, with every module and one lesson per topic."
      actions={<Action loading={loading} disabled={busy} onClick={() => void preview()}>Refresh preview</Action>}
    >
      {error && <StatusNote tone="error">{error}</StatusNote>}

      {result && (
        <StatusNote tone="ok">
          <strong>{result.detail}</strong>
          {(Object.keys(REPORT_LABELS) as (keyof Result & keyof typeof REPORT_LABELS)[]).map((key) => result[key].length > 0 && (
            <span key={key} className="block">{REPORT_LABELS[key]}: {result[key].join(', ')}</span>
          ))}
        </StatusNote>
      )}

      {loading && !rows.length && <Skeleton rows={4} />}

      {!loading && !error && rows.length > 0 && (
        <AdminList label="Curriculum brief courses">
          {rows.map((row) => (
            <AdminRow
              key={row.slug}
              placeholder="bi-journal-text"
              title={row.title}
              badges={<Pill tone={row.existing_id ? 'live' : 'draft'}>{row.existing_id ? 'Already in catalogue' : 'Will create draft'}</Pill>}
              meta={row.existing_id
                ? 'This course already exists here. Importing will not duplicate it.'
                // The module counts come from the curriculum-aware catalogue patch,
                // so an older backend must not print "undefined".
                : [row.category, money(row.price), row.duration,
                   row.modules ? `${row.modules} modules · ${row.lessons} lessons` : '']
                  .filter(Boolean).join(' · ')}
            />
          ))}
        </AdminList>
      )}

      {!loading && !error && !rows.length && (
        <EmptyState
          icon="bi-check2-circle"
          title="The curriculum is already in the catalogue"
          description="Every course from the curriculum brief exists in this dashboard. Nothing else needs importing."
        />
      )}

      <form id="catalogue-import-form" className={formClass} onSubmit={(event) => void run(event)}>
        <Field
          label="Tutor for newly imported courses"
          required
          hint={!tutors.length ? 'No active tutor is available. Activate or add a tutor under Users first.' : 'Imported courses are assigned to this tutor so students see a named teacher.'}
        >
          <select className={controlClass} required disabled={busy || loading} value={tutor} onChange={(event) => setTutor(event.target.value)}>
            <option value="">Select an active tutor</option>
            {tutors.map((item) => <option key={item.id} value={item.id}>{item.full_name || item.email}</option>)}
          </select>
        </Field>
        <CheckRow
          label="Also fill blank public details on matching courses"
          hint="Only empty introductions, taglines, audiences, outcomes and outlines are filled. Prices, titles, tutors and authored copy stay unchanged."
          disabled={busy}
          checked={fill}
          onChange={(event) => setFill(event.target.checked)}
        />
        <StatusNote>
          {missing
            ? `${missing} of ${rows.length} curriculum courses are missing here. They are created as drafts, so nothing goes public until you publish it.`
            : `All ${rows.length} curriculum courses already exist. Import will still fill blank details if you tick the box above.`}
          {' '}Missing topics are added as lessons on draft courses only. Published courses and student progress are never changed.
        </StatusNote>
        <div>
          <Action type="submit" intent="primary" loading={busy} disabled={!importable}>
            Import missing courses as drafts
          </Action>
        </div>
      </form>
    </AdminSection>
  );
}
