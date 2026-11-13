'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Download, RefreshCw, Trophy } from 'lucide-react';
import { downloadApiFile } from '@/lib/api-pages';
import {
  challengeAdminApi, challengeDate, challengeFailure, engagementSource, uploadChallengeBrief,
  type ChallengeCategory, type ChallengeMode, type ChallengeRound, type ChallengeScorebook, type ChallengeScoreRow,
} from '@/lib/challenge-api';
import { Action, AdminList, AdminRow, AdminSection, Drawer, EmptyState, Field, FormGrid, Pager, Pill, Skeleton, StatusNote, TextInput, controlClass } from './AdminUI';
import { ChallengeDates, ChallengeWeights, EvidenceLinks, styles } from '@/components/challenges/ChallengeUI';

const points = (value: string | number | null | undefined) => value === null || value === undefined ? 'Pending' : Number(value).toFixed(2);
const lagosInput = (value: string) => value && Number.isFinite(new Date(value).getTime()) ? new Date(new Date(value).getTime() + 3600000).toISOString().slice(0, 16) : '';
const lagosIso = (value: string) => new Date(`${value}+01:00`).toISOString();

function roundDraft(round?: ChallengeRound) {
  return {
    title: round?.title ?? '', slug: round?.slug ?? '', description: round?.description ?? '',
    mode: round?.mode ?? 'hybrid' as ChallengeMode, hashtag: round?.hashtag ?? '#VaceUpChallenge',
    linkedin_handle: round?.linkedin_handle ?? '', instagram_handle: round?.instagram_handle ?? '',
    rules: round?.rules ?? '', likes_target: round?.likes_target?.toString() ?? '', comments_target: round?.comments_target?.toString() ?? '',
    registration_opens_at: round ? lagosInput(round.registration_opens_at) : lagosInput(new Date().toISOString()),
    registration_closes_at: round ? lagosInput(round.registration_closes_at) : '2026-11-29T18:00',
    submission_closes_at: round ? lagosInput(round.submission_closes_at) : '2026-11-29T18:00',
    final_collection_starts_at: round ? lagosInput(round.final_collection_starts_at) : '2026-11-30T18:00',
    final_collection_ends_at: round ? lagosInput(round.final_collection_ends_at) : '2026-11-30T20:00',
    results_publish_at: round ? lagosInput(round.results_publish_at) : '2026-12-01T09:00',
  };
}
type RoundDraft = ReturnType<typeof roundDraft>;
const dates: Array<{ key: keyof Pick<RoundDraft, 'registration_opens_at' | 'registration_closes_at' | 'submission_closes_at' | 'final_collection_starts_at' | 'final_collection_ends_at' | 'results_publish_at'>; label: string }> = [
  { key: 'registration_opens_at', label: 'Registration opens' }, { key: 'registration_closes_at', label: 'Registration closes' },
  { key: 'submission_closes_at', label: 'Projects close' }, { key: 'final_collection_starts_at', label: 'Final collection starts' },
  { key: 'final_collection_ends_at', label: 'Final collection ends' }, { key: 'results_publish_at', label: 'Results scheduled' },
];

export default function ChallengesManager() {
  const [rounds, setRounds] = useState<ChallengeRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [edit, setEdit] = useState<ChallengeRound | 'new' | null>(null);
  const [selected, setSelected] = useState<ChallengeRound | null>(null);
  const [book, setBook] = useState<ChallengeScorebook | null>(null);
  const [bookBusy, setBookBusy] = useState(false);
  const [categoryEdit, setCategoryEdit] = useState<ChallengeCategory | 'new' | null>(null);
  const [correction, setCorrection] = useState<ChallengeScoreRow | null>(null);
  const [confirm, setConfirm] = useState<{ round: ChallengeRound; action: 'open' | 'close' | 'freeze' | 'publish' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [scorePage, setScorePage] = useState(1);
  useEffect(() => { setScorePage(1); }, [query, selected?.slug]);

  const reload = useCallback(async () => {
    setLoading(true);
    try { const result = await challengeAdminApi.rounds(); setRounds(result); setSelected((current) => current ? result.find((item) => item.slug === current.slug) ?? null : current); }
    catch (failure) { setError(challengeFailure(failure)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const openScorebook = async (round: ChallengeRound) => {
    setSelected(round); setBook(null); setBookBusy(true); setError('');
    try { setBook(await challengeAdminApi.scorebook(round.slug)); }
    catch (failure) { setError(challengeFailure(failure)); }
    finally { setBookBusy(false); }
  };
  const refreshBook = async () => { if (selected) { const updated = await challengeAdminApi.scorebook(selected.slug); setBook(updated); setSelected(updated.round); } };
  const exportBook = async (format: 'csv' | 'xlsx') => {
    if (!selected) return; setBusy(true); setError('');
    try { await downloadApiFile(`/challenges/admin/rounds/${encodeURIComponent(selected.slug)}/export/?format=${format}`, `${selected.slug}-scorebook.${format}`); }
    catch (failure) { setError(challengeFailure(failure)); } finally { setBusy(false); }
  };

  const rows = useMemo(() => (book?.rows ?? []).map((row) => ({ ...row,
    post_url: row.submission?.post_url || row.post_url,
    likes: row.engagement_source ? row.likes : row.engagement?.likes ?? row.engagement?.declared_counts?.likes ?? row.likes,
    comments: row.engagement_source ? row.comments : row.engagement?.comments ?? row.engagement?.declared_counts?.comments ?? row.comments,
    engagement_source: row.engagement_source || row.engagement?.source,
    observed_at: row.observed_at || row.engagement?.observed_at,
  })).filter((row) => `${row.name} ${row.email || ''} ${row.category} ${row.status}`.toLowerCase().includes(query.toLowerCase())), [book, query]);
  const exceptions = book?.rows.filter((row) => row.flags.length || !['ranked', 'disqualified'].includes(row.status)).length ?? 0;
  const visibleRows = rows.slice((scorePage - 1) * 50, scorePage * 50);

  return <div className={`${styles.root} ${styles.admin}`}>
    <div className={`${styles.row} ${styles.between}`}><div className={styles.tight}><p className={styles.eyebrow}><Trophy className={styles.icon} aria-hidden="true" />Independent community challenge</p><h2 className={styles.title}>Turn great work into opportunity.</h2><p className={styles.muted}>Publish clear briefs, collect real project files and keep an auditable scorebook. Participant registration stays separate from academy accounts.</p></div><Action intent="primary" onClick={() => setEdit('new')}>Create challenge round</Action></div>
    {error && <StatusNote tone="error">{error}</StatusNote>}{message && <StatusNote tone="ok">{message}</StatusNote>}
    <AdminSection title="Challenge rounds" description="A draft is private. Open registration only after the category briefs, deadlines and judging mode are ready." actions={<Action loading={loading} leftIcon={<RefreshCw className={styles.icon} />} onClick={() => { setError(''); void reload(); }}>Refresh</Action>}>
      {loading ? <Skeleton /> : !rounds.length ? <EmptyState icon="bi-trophy" title="Your first challenge starts here" description="Create a draft, add category briefs and review the rules before opening registration." action={<Action onClick={() => setEdit('new')}>Create a draft round</Action>} /> : <AdminList label="Challenge rounds">{rounds.map((round) => <AdminRow key={round.id} title={round.title} badges={<Pill tone={round.status === 'draft' ? 'draft' : round.status === 'published' ? 'live' : 'neutral'}>{round.status.replaceAll('_', ' ')}</Pill>} meta={`${round.mode === 'hybrid' ? '80% quality · 12% likes · 8% comments' : '100% project quality'} · Closes ${challengeDate(round.submission_closes_at)}`} description={`${round.categories.length} categories${round.participants_count !== undefined ? ` · ${round.participants_count} participants` : ''}`} actions={<><Action size="sm" onClick={() => void openScorebook(round)}>Manage round</Action><Action size="sm" onClick={() => setEdit(round)}>Edit details</Action></>} />)}</AdminList>}
    </AdminSection>

    {selected && <>
      <AdminSection title={selected.title} description="All dates use Lagos time (WAT)." actions={selected.status === 'draft' ? <span className={styles.muted}>The public page becomes available when registration opens.</span> : <Link className={styles.link} href={`/challenge/?round=${encodeURIComponent(selected.slug)}`} target="_blank">Open public page<ArrowUpRight className={styles.icon} aria-hidden="true" /></Link>}>
        <div className={styles.stack}><ChallengeDates round={selected} /><div className={styles.grid}><ChallengeWeights mode={selected.mode} /><div className={styles.tight}><h3>Publication controls</h3><p className={styles.muted}>Freeze creates a fixed scorebook. Publishing results requires a separate explicit approval and a resolved scorebook.</p><div className={styles.row}>{selected.status === 'draft' && <Action intent="primary" onClick={() => setConfirm({ round: selected, action: 'open' })}>Open registration</Action>}{selected.status === 'open' && <Action onClick={() => setConfirm({ round: selected, action: 'close' })}>Close submissions</Action>}{['open', 'closed'].includes(selected.status) && <Action onClick={() => setConfirm({ round: selected, action: 'freeze' })}>Freeze scorebook</Action>}{selected.status === 'frozen' && <Action intent="primary" onClick={() => setConfirm({ round: selected, action: 'publish' })}>Approve and publish results</Action>}{selected.status === 'published' && <Pill tone="live">Results published</Pill>}</div></div></div></div>
      </AdminSection>
      <AdminSection title="Category briefs" description="Give each category its own actual project requirements and a rubric worth 100 quality points." actions={<Action disabled={selected.status !== 'draft'} onClick={() => setCategoryEdit('new')}>Add category</Action>}>
        {selected.status !== 'draft' && <StatusNote>Published briefs and rubrics are locked for this round to keep the rules consistent for participants.</StatusNote>}
        <details open={selected.status === 'draft'}><summary>Review category briefs and rubrics</summary>{!selected.categories.length ? <EmptyState title="Add the first project brief" description="Participants need a complete brief before they can register." /> : <AdminList label="Category briefs">{selected.categories.map((category) => <AdminRow key={category.id} title={category.name} meta={`${category.enabled === false ? 'Disabled' : 'Available'} · ${category.rubric?.length ?? 0} criteria`} description={category.brief?.split('\n')[0]} actions={<Action size="sm" disabled={selected.status !== 'draft'} onClick={() => setCategoryEdit(category)}>Edit brief</Action>} />)}</AdminList>}</details>
      </AdminSection>
      <AdminSection title="Participant scorebook" description="Quality points are out of 100. Scores remain provisional until final collection and approval. Blank metrics stay unavailable." actions={<><Action disabled={bookBusy || busy} onClick={() => void openScorebook(selected)} leftIcon={<RefreshCw className={styles.icon} />}>Refresh scorebook</Action><Action disabled={!book || busy} onClick={() => void exportBook('csv')} leftIcon={<Download className={styles.icon} />}>CSV</Action><Action disabled={!book || busy} onClick={() => void exportBook('xlsx')}>XLSX</Action></>}>
        {bookBusy ? <Skeleton rows={4} /> : !book ? <StatusNote>Load the scorebook to review participants and assessment exceptions.</StatusNote> : <div className={styles.stack}>
          <div className={styles.grid}><div className={styles.summary}><strong className={styles.metric}>{book.rows.length}</strong><span className={styles.muted}>Participant entries</span></div><div className={styles.summary}><strong className={styles.metric}>{exceptions}</strong><span className={styles.muted}>Entries needing a status or flag review</span></div></div>
          {!!book.blockers?.length && <StatusNote tone="error"><strong>Resolve before freezing:</strong><ul>{book.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></StatusNote>}
          <Field label="Search participants"><TextInput type="search" placeholder="Name, email, category or status" value={query} onChange={(event) => setQuery(event.target.value)} /></Field>
          {!rows.length ? <EmptyState title={book.rows.length ? 'No matching entries' : 'No participants yet'} description={book.rows.length ? 'Try a different name, category or status.' : 'Registrations and project submissions will appear here after the round opens.'} /> : <div className={styles.tableWrap} tabIndex={0} aria-label="Participant scorebook, scroll horizontally for all columns"><table className={styles.table}><caption>Scroll horizontally to review scores, evidence sources and actions. Counts are not added across daily snapshots.</caption><thead><tr><th scope="col">Participant</th><th scope="col">Category</th><th scope="col">Quality /100</th><th scope="col">Likes / Comments</th><th scope="col">Engagement /20</th><th scope="col">Total /100</th><th scope="col">Status</th><th scope="col">Review</th></tr></thead><tbody>{visibleRows.map((row) => <tr key={row.registration_id}><th scope="row"><span>{row.name}</span>{row.email && <p className={styles.muted}>{row.email}</p>}{row.rank && <span className={styles.pill}>Rank {row.rank}{row.winner ? book.frozen ? ' · Category winner' : ' · Leading category' : ''}</span>}</th><td>{row.category}</td><td>{points(row.quality_points)}</td><td><span>{row.likes ?? 'Unavailable'} / {row.comments ?? 'Unavailable'}</span><p className={styles.muted}>{engagementSource(row.engagement_source)}</p>{row.observed_at && <p className={styles.muted}>{challengeDate(row.observed_at)}</p>}</td><td>{selected.mode === 'quality_only' ? 'Not scored' : points(row.engagement_points)}</td><td><strong>{points(row.total)}</strong></td><td><Pill tone={row.flags.length ? 'danger' : 'neutral'}>{row.status.replaceAll('_', ' ')}</Pill>{row.flags.length > 0 && <p className={styles.muted}>{row.flags.join('; ')}</p>}</td><td><div className={styles.tight}>{row.post_url && <a className={styles.link} href={row.post_url} target="_blank" rel="noopener noreferrer">Open public post<ArrowUpRight className={styles.icon} aria-hidden="true" /></a>}<Action size="sm" disabled={book.frozen || selected.status === 'published' || !row.submission_id} onClick={() => setCorrection(row)}>Review / correct</Action></div></td></tr>)}</tbody></table></div>}
          {rows.length > 50 && <Pager label="Challenge participants" page={scorePage} count={rows.length} hasNext={scorePage * 50 < rows.length} onPrev={() => setScorePage((page) => Math.max(1, page - 1))} onNext={() => setScorePage((page) => page + 1)} />}
          <p className={styles.muted}>Scores remain private until results are published. A participant’s evidence and public observations keep their original source and capture time. An unavailable public count is not a verified zero.</p>
        </div>}
      </AdminSection>
    </>}

    {edit && <RoundEditor round={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} onSaved={async (saved) => { setEdit(null); setMessage(`“${saved.title}” was saved${saved.status === 'draft' ? ' as a private draft' : ''}.`); await reload(); setSelected(saved); }} />}
    {categoryEdit && selected && <CategoryEditor category={categoryEdit === 'new' ? undefined : categoryEdit} round={selected} onClose={() => setCategoryEdit(null)} onSaved={async () => { setCategoryEdit(null); setMessage('The category brief and rubric were saved.'); await reload(); }} />}
    {correction && selected && <CorrectionEditor row={correction} round={selected} onClose={() => setCorrection(null)} onSaved={async () => { setCorrection(null); setMessage('The correction was saved with an audit reason.'); await refreshBook(); }} />}
    {confirm && <RoundActionConfirmation round={confirm.round} action={confirm.action} onClose={() => setConfirm(null)} onSaved={async () => { const action = confirm.action; setConfirm(null); setMessage(action === 'publish' ? 'Approved results are now published.' : action === 'freeze' ? 'A fixed scorebook has been saved. Review it before publishing results.' : action === 'open' ? 'The challenge round is open for registration.' : 'The round has been closed to submissions.'); await reload(); await refreshBook(); }} />}
  </div>;
}

function RoundEditor({ round, onClose, onSaved }: { round?: ChallengeRound; onClose: () => void; onSaved: (round: ChallengeRound) => Promise<void> }) {
  const [draft, setDraft] = useState(() => roundDraft(round));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = !!round && round.status !== 'draft';
  const set = <K extends keyof RoundDraft>(key: K, value: RoundDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const payload = { ...draft, ...Object.fromEntries(dates.map(({ key }) => [key, lagosIso(draft[key])])), likes_target: draft.likes_target ? Number(draft.likes_target) : null, comments_target: draft.comments_target ? Number(draft.comments_target) : null };
      const saved = await challengeAdminApi.save(payload, round?.slug); await onSaved(saved);
    } catch (failure) { setError(challengeFailure(failure)); } finally { setBusy(false); }
  };
  return <Drawer open title={round ? 'Edit challenge round' : 'Create a private challenge draft'} description="Review all deadlines in Lagos time. Creating a draft does not open registration or publish results." onClose={() => { if (!busy) onClose(); }}>
    <form className={styles.stack} onSubmit={save}>{error && <StatusNote tone="error">{error}</StatusNote>}{locked && <StatusNote>Published judging mode, targets, rules and deadlines are locked. The server validates which editorial changes remain available.</StatusNote>}
      <Field label="Round title" required><TextInput required maxLength={200} value={draft.title} onChange={(event) => set('title', event.target.value)} disabled={busy} /></Field>
      <Field label="Public URL slug" required hint="Lowercase words separated by hyphens."><TextInput required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={draft.slug} onChange={(event) => set('slug', event.target.value)} disabled={busy || !!round} /></Field>
      <Field label="Description" required><textarea className={controlClass} required value={draft.description} onChange={(event) => set('description', event.target.value)} disabled={busy} /></Field>
      <Field label="Published judging mode"><select className={controlClass} value={draft.mode} onChange={(event) => set('mode', event.target.value as ChallengeMode)} disabled={busy || locked}><option value="hybrid">80% quality + 12% likes + 8% comments</option><option value="quality_only">100% project quality</option></select></Field>
      {draft.mode === 'hybrid' && <FormGrid><Field label="Likes target for the full 12 points" required><TextInput type="number" required min={1} step={1} value={draft.likes_target} onChange={(event) => set('likes_target', event.target.value)} disabled={busy || locked} /></Field><Field label="Comments target for the full 8 points" required><TextInput type="number" required min={1} step={1} value={draft.comments_target} onChange={(event) => set('comments_target', event.target.value)} disabled={busy || locked} /></Field></FormGrid>}
      <StatusNote>Shares and views are recorded for context. They do not contribute to the approved 80 / 12 / 8 score. Select the judging mode before opening the round.</StatusNote>
      <FormGrid>{dates.map(({ key, label }) => <Field key={key} label={`${label} (WAT)`} required><TextInput type="datetime-local" required value={draft[key]} onChange={(event) => set(key, event.target.value)} disabled={busy || locked} /></Field>)}</FormGrid>
      <FormGrid><Field label="Required hashtag"><TextInput value={draft.hashtag} onChange={(event) => set('hashtag', event.target.value)} disabled={busy || locked} /></Field><Field label="LinkedIn tag / handle"><TextInput value={draft.linkedin_handle} onChange={(event) => set('linkedin_handle', event.target.value)} disabled={busy || locked} /></Field><Field label="Instagram tag / handle"><TextInput value={draft.instagram_handle} onChange={(event) => set('instagram_handle', event.target.value)} disabled={busy || locked} /></Field></FormGrid>
      <Field label="Full participant rules" required hint="Include eligibility, evidence policy, the final collection window, tie breaks and how exceptions are resolved."><textarea className={controlClass} required rows={8} value={draft.rules} onChange={(event) => set('rules', event.target.value)} disabled={busy || locked} /></Field>
      <div className={styles.row}><Action type="submit" intent="primary" loading={busy}>Save {round ? 'round details' : 'private draft'}</Action><Action disabled={busy} onClick={onClose}>Cancel</Action></div>
    </form>
  </Drawer>;
}

const initialRubric = [
  { id: 'completeness', label: 'Brief requirements and completeness', max_points: 30, description: 'The submitted files meet every deliverable in the category brief and demonstrate a complete working project.' },
  { id: 'correctness', label: 'Technical correctness', max_points: 25, description: 'The project applies the relevant techniques correctly, with accurate results supported by the submitted evidence.' },
  { id: 'reasoning', label: 'Clarity and reasoning', max_points: 20, description: 'The explanation identifies the approach, key decisions and evidence that demonstrates the required skills.' },
  { id: 'presentation', label: 'Presentation and usability', max_points: 15, description: 'The project is clear, organized and usable by its intended audience.' },
  { id: 'originality', label: 'Originality and practical value', max_points: 10, description: 'The submission demonstrates independent work and a useful response to the brief.' },
];

function CategoryEditor({ category, round, onClose, onSaved }: { category?: ChallengeCategory; round: ChallengeRound; onClose: () => void; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState({ name: category?.name ?? '', slug: category?.slug ?? '', brief: category?.brief ?? '', requirements: category?.requirements?.join('\n') ?? '', email_instructions: category?.email_instructions ?? '', enabled: category?.enabled !== false, winner_count: category?.winner_count ?? 1 });
  const [rubric, setRubric] = useState(category?.rubric?.length ? category.rubric : initialRubric);
  const [pdf, setPdf] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const total = rubric.reduce((sum, item) => sum + Number(item.max_points), 0);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (total !== 100 || rubric.some((item) => !item.label.trim() || !item.description.trim() || item.max_points <= 0)) { setError('Give every criterion a name, scoring description and positive points. The complete rubric must add up to 100.'); return; }
    setBusy(true);
    try { const saved = await challengeAdminApi.saveCategory({ ...draft, round: round.id, requirements: draft.requirements.split('\n').map((line) => line.trim()).filter(Boolean), rubric }, category?.id); if (pdf) { setUploadProgress(0); await uploadChallengeBrief(saved.id, pdf, setUploadProgress); } await onSaved(); }
    catch (failure) { setError(challengeFailure(failure)); } finally { setBusy(false); }
  };
  return <Drawer open title={category ? `Edit ${category.name}` : 'Add a category brief'} description="The brief is shown in the participant portal and the email for the selected category." onClose={() => { if (!busy) onClose(); }}><form className={styles.stack} onSubmit={save}>
    {error && <StatusNote tone="error">{error}</StatusNote>}
    <FormGrid><Field label="Category name" required><TextInput required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} disabled={busy} /></Field><Field label="Category slug" required><TextInput required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} disabled={busy} /></Field></FormGrid>
    <Field label="Project brief" required><textarea className={controlClass} required rows={10} value={draft.brief} onChange={(event) => setDraft({ ...draft, brief: event.target.value })} disabled={busy} /></Field>
    <Field label="Required deliverables" required hint="One requirement per line. Specify the actual project files participants must upload."><textarea className={controlClass} required rows={5} value={draft.requirements} onChange={(event) => setDraft({ ...draft, requirements: event.target.value })} disabled={busy} /></Field>
    <Field label="Email instructions" optional hint="Additional instructions sent with this category’s brief."><textarea className={controlClass} rows={4} value={draft.email_instructions} onChange={(event) => setDraft({ ...draft, email_instructions: event.target.value })} disabled={busy} /></Field>
    <Field label="Number of category winners" required><TextInput type="number" min={1} max={100} required value={draft.winner_count} onChange={(event) => setDraft({ ...draft, winner_count: Number(event.target.value) })} disabled={busy} /></Field>
    {category && <Field label="Attach or replace the PDF brief" optional hint={category.brief_pdf_available ? 'A PDF brief is already attached. Select a file only to replace it.' : 'Optional PDF, up to 10 MB. The portal also shows the text brief above.'}><input type="file" className={controlClass} accept=".pdf" disabled={busy} onChange={(event) => setPdf(event.target.files?.[0] ?? null)} /></Field>}
    {uploadProgress !== null && busy && <p role="status">{uploadProgress < 0 ? 'The PDF upload is taking longer than expected.' : `Uploading PDF brief: ${uploadProgress}%`}</p>}
    <fieldset className={styles.stack}><legend>Quality rubric · {total} / 100 points</legend>{rubric.map((item, index) => <div className={`${styles.panel} ${styles.stack}`} key={item.id}><FormGrid><Field label={`Criterion ${index + 1}`} required><TextInput required value={item.label} onChange={(event) => setRubric(rubric.map((entry, position) => position === index ? { ...entry, label: event.target.value } : entry))} disabled={busy} /></Field><Field label="Maximum points" required><TextInput type="number" min={1} max={100} required value={item.max_points} onChange={(event) => setRubric(rubric.map((entry, position) => position === index ? { ...entry, max_points: Number(event.target.value) } : entry))} disabled={busy} /></Field></FormGrid><Field label="What earns these points" required><textarea className={controlClass} required value={item.description || ''} onChange={(event) => setRubric(rubric.map((entry, position) => position === index ? { ...entry, description: event.target.value } : entry))} disabled={busy} /></Field><Action intent="danger" disabled={busy || rubric.length <= 1} onClick={() => setRubric(rubric.filter((_, position) => position !== index))}>Remove criterion {index + 1}</Action></div>)}<Action disabled={busy} onClick={() => setRubric([...rubric, { id: `criterion_${Date.now()}`, label: '', max_points: 1, description: '' }])}>Add criterion</Action></fieldset>
    <label className={styles.check}><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} disabled={busy} /><span>Offer this category when registration opens</span></label>
    <div className={styles.row}><Action type="submit" intent="primary" loading={busy}>Save category brief</Action><Action disabled={busy} onClick={onClose}>Cancel</Action></div>
  </form></Drawer>;
}

function CorrectionEditor({ row, round, onClose, onSaved }: { row: ChallengeScoreRow; round: ChallengeRound; onClose: () => void; onSaved: () => Promise<void> }) {
  const [quality, setQuality] = useState(row.quality_points?.toString() ?? '');
  const [engagement, setEngagement] = useState(row.engagement_points?.toString() ?? '');
  const [reason, setReason] = useState('');
  const [disqualified, setDisqualified] = useState(row.disqualified ?? row.status === 'disqualified');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await challengeAdminApi.correction(round.slug, row.registration_id, { reason: reason.trim(), ...(quality !== '' ? { quality_points: Number(quality) } : {}), ...(round.mode === 'hybrid' && engagement !== '' ? { engagement_points: Number(engagement) } : {}), disqualified, ...(disqualified ? { disqualification_reason: reason.trim() } : {}) }); await onSaved(); }
    catch (failure) { setError(challengeFailure(failure)); } finally { setBusy(false); }
  };
  return <Drawer open title={`Review ${row.name}`} description="Corrections are recorded with your identity, reason and previous values. Resolve missing evidence before adjusting a score." onClose={() => { if (!busy) onClose(); }}><form className={styles.stack} onSubmit={save}>
    {error && <StatusNote tone="error">{error}</StatusNote>}
    <StatusNote>Status: {row.status.replaceAll('_', ' ')}{row.flags.length ? ` · ${row.flags.join('; ')}` : ''}</StatusNote>
    {(row.submission?.post_url || row.post_url) && <a className={styles.link} href={row.submission?.post_url || row.post_url} target="_blank" rel="noopener noreferrer">Open public post<ArrowUpRight className={styles.icon} aria-hidden="true" /></a>}
    {row.submission && <section className={styles.stack} aria-label="Submitted project evidence"><h3>Submitted project</h3><p className={styles.body}>{row.submission.explanation}</p>{!!row.submission.evidence?.length && <EvidenceLinks admin files={row.submission.evidence} />}</section>}
    {row.assessment ? <section className={`${styles.stack} ${styles.separator}`} aria-label="Assessment reasoning"><h3>Assessment and evidence</h3><p className={styles.muted}>Review the uploaded work alongside the criterion explanations before approving a correction or finalist.</p><ul className={styles.list}>{row.assessment.criterion_scores.map((criterion) => <li key={criterion.id}><div className={styles.tight}><strong>{round.categories.find((item) => item.id === row.category_id)?.rubric?.find((item) => item.id === criterion.id)?.label || criterion.id.replaceAll('_', ' ')} · {points(criterion.points)} points</strong><p>{criterion.reason}</p></div></li>)}</ul>{Object.entries(row.assessment.reasons).map(([label, value]) => <div className={styles.tight} key={label}><strong>{label.replaceAll('_', ' ')}</strong>{Array.isArray(value) ? <ul className={styles.list}>{value.filter((item): item is string => typeof item === 'string').map((item, index) => <li key={index}>{item}</li>)}</ul> : typeof value === 'string' ? <p className={styles.body}>{value}</p> : null}</div>)}</section> : <StatusNote>The project assessment is pending. Do not treat an unavailable score as zero.</StatusNote>}
    {row.engagement && <section className={`${styles.stack} ${styles.separator}`} aria-label="Engagement evidence"><h3>Engagement evidence</h3><p><strong>{engagementSource(row.engagement.source)}</strong> · {row.engagement.verification_status?.replaceAll('_', ' ') || 'Awaiting evidence review'}</p><p className={styles.muted}>Captured {challengeDate(row.engagement.observed_at)}. Received {challengeDate(row.engagement.created_at)}. Final evidence must be captured, uploaded and received within the published collection window.</p><dl className={styles.dates}><div><dt>Extracted / observed likes</dt><dd>{row.engagement.likes ?? 'Unavailable'}</dd></div><div><dt>Extracted / observed comments</dt><dd>{row.engagement.comments ?? 'Unavailable'}</dd></div><div><dt>Participant-declared likes</dt><dd>{row.engagement.declared_counts?.likes ?? 'Unavailable'}</dd></div><div><dt>Participant-declared comments</dt><dd>{row.engagement.declared_counts?.comments ?? 'Unavailable'}</dd></div></dl>{!!row.engagement.evidence?.length && <EvidenceLinks admin files={row.engagement.evidence} />}</section>}
    <FormGrid><Field label="Quality points, out of 100" hint="Leave blank to keep the existing assessment."><TextInput type="number" min={0} max={100} step="0.01" value={quality} onChange={(event) => setQuality(event.target.value)} disabled={busy} /></Field>{round.mode === 'hybrid' && <Field label="Engagement points, out of 20" hint="Keep the source and captured evidence in the audit reason."><TextInput type="number" min={0} max={20} step="0.01" value={engagement} onChange={(event) => setEngagement(event.target.value)} disabled={busy} /></Field>}</FormGrid>
    <label className={styles.check}><input type="checkbox" checked={disqualified} onChange={(event) => setDisqualified(event.target.checked)} disabled={busy} /><span>Disqualify this entry under the published rules</span></label>
    <Field label="Reason and evidence for this correction" required><textarea className={controlClass} required minLength={10} rows={6} value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} /></Field>
    <div className={styles.row}><Action type="submit" intent={disqualified ? 'danger' : 'primary'} loading={busy}>{disqualified ? 'Save disqualification' : 'Save audited correction'}</Action><Action disabled={busy} onClick={onClose}>Cancel</Action></div>
  </form></Drawer>;
}

function RoundActionConfirmation({ round, action, onClose, onSaved }: { round: ChallengeRound; action: 'open' | 'close' | 'freeze' | 'publish'; onClose: () => void; onSaved: () => Promise<void> }) {
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const labels = { open: 'Open registration', close: 'Close submissions', freeze: 'Freeze scorebook', publish: 'Approve and publish results' };
  const descriptions = { open: 'This publishes the round rules, briefs and judging mode so participants can register.', close: 'This closes new project submissions for this round. Review the published deadlines before continuing.', freeze: 'The server checks assessment and evidence exceptions, then saves a fixed scorebook. Results stay private.', publish: 'This publishes the approved frozen results to participants. Confirm the rankings, winners, ties and evidence exceptions have been reviewed.' };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await challengeAdminApi.action(round.slug, action, { approved: true, confirm: confirmation, approve: true }); await onSaved(); }
    catch (failure) { setError(challengeFailure(failure)); } finally { setBusy(false); }
  };
  const word = action === 'publish' ? 'PUBLISH' : action === 'freeze' ? 'FREEZE' : action === 'close' ? 'CLOSE' : 'OPEN';
  return <Drawer open title={labels[action]} description={descriptions[action]} onClose={() => { if (!busy) onClose(); }}><form className={styles.stack} onSubmit={submit}>{error && <StatusNote tone="error">{error}</StatusNote>}<p><strong>{round.title}</strong></p><Field label={`Type ${word} to confirm`} required><TextInput value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required autoComplete="off" disabled={busy} /></Field><div className={styles.row}><Action type="submit" intent="primary" loading={busy} disabled={confirmation !== word}>{labels[action]}</Action><Action disabled={busy} onClick={onClose}>Cancel</Action></div></form></Drawer>;
}
