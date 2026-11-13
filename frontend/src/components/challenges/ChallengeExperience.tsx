'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, CalendarDays, Check, Clock3, Mail, RefreshCw, Trophy } from 'lucide-react';
import {
  challengeApi, challengeDate, challengeFailure, engagementSource,
  type ChallengeCategory, type ChallengeEvidence, type ChallengePortal, type ChallengeRound, type ChallengeResult,
} from '@/lib/challenge-api';
import { Action, ChallengeDates, ChallengeField, ChallengeNote, ChallengeWeights, EvidenceLinks, EvidenceUpload, styles } from './ChallengeUI';

const sessionKey = (slug: string) => `vaceup_challenge_session:${slug}`;
const isPast = (value: string) => new Date(value).getTime() < Date.now();
const countLabel = (value: number | null | undefined) => value === null || value === undefined ? 'Unavailable' : value.toLocaleString();

function readSession(slug: string): string {
  try { return sessionStorage.getItem(sessionKey(slug)) || ''; } catch { return ''; }
}
function saveSession(slug: string, token: string) {
  try { sessionStorage.setItem(sessionKey(slug), token); } catch { /* The active tab can continue without persistent storage. */ }
}

export default function ChallengeExperience() {
  const [rounds, setRounds] = useState<ChallengeRound[]>([]);
  const [round, setRound] = useState<ChallengeRound | null>(null);
  const [category, setCategory] = useState<ChallengeCategory | null>(null);
  const [portal, setPortal] = useState<ChallengePortal | null>(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptRules, setAcceptRules] = useState(false);
  const [makePublic, setMakePublic] = useState(false);
  const [accessOnly, setAccessOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const boot = useRef<Promise<{ rounds: ChallengeRound[]; round: ChallengeRound | null; token: string; verificationError?: string }> | null>(null);

  const loadPortal = useCallback(async (access: string) => {
    const current = await challengeApi.portal(access);
    setPortal(current); setRound(current.registration.round); setCategory(current.registration.category);
    setEmail(current.registration.email); setToken(access);
    saveSession(current.registration.round.slug, access);
    return current;
  }, []);

  useEffect(() => {
    let live = true;
    if (!boot.current) boot.current = (async () => {
      const query = new URLSearchParams(window.location.search);
      const slug = query.get('round') || '';
      const verification = query.get('verify') || query.get('token');
      if (verification) {
        const clean = new URL(window.location.href);
        clean.searchParams.delete('verify'); clean.searchParams.delete('token');
        window.history.replaceState({}, '', clean.pathname + clean.search);
      }
      const available = await challengeApi.rounds();
      const selected = slug ? await challengeApi.round(slug) : available[0] ?? null;
      let access = selected ? readSession(selected.slug) : '';
      let verificationError = '';
      if (verification) {
        try { const verified = await challengeApi.verify(verification); access = verified.access_token; }
        catch (failure) { access = ''; verificationError = `${challengeFailure(failure)} Request a fresh personal link below.`; }
      }
      return { rounds: available, round: selected, token: access, verificationError };
    })();
    void boot.current.then(async (data) => {
      if (!live) return;
      setRounds(data.rounds); setRound(data.round); setCategory(data.round?.categories.find((item) => item.enabled !== false) ?? null);
      if (data.verificationError) { setError(data.verificationError); setAccessOnly(true); }
      if (data.token) await loadPortal(data.token);
    }).catch((failure) => { if (live) setError(challengeFailure(failure)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [loadPortal]);

  const chooseRound = async (slug: string) => {
    setLoading(true); setError(''); setNotice(''); setPortal(null); setToken('');
    try {
      const chosen = await challengeApi.round(slug);
      setRound(chosen); setCategory(chosen.categories.find((item) => item.enabled !== false) ?? null);
      window.history.replaceState({}, '', `/challenge/?round=${encodeURIComponent(slug)}`);
      const saved = readSession(slug);
      if (saved) await loadPortal(saved);
    } catch (failure) { setError(challengeFailure(failure)); }
    finally { setLoading(false); }
  };

  const register = async (event: FormEvent) => {
    event.preventDefault(); if (!round || (!category && !accessOnly)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = accessOnly
        ? await challengeApi.access(round.slug, email.trim())
        : await challengeApi.register({ round_slug: round.slug, category_id: category!.id, full_name: fullName.trim(), email: email.trim(), phone: phone.trim(), accept_rules: acceptRules, make_public: makePublic });
      setNotice(response.detail || 'Check your inbox for your personal challenge link. Check spam as well.');
    } catch (failure) { setError(challengeFailure(failure)); }
    finally { setBusy(false); }
  };

  const signOut = () => {
    if (round) { try { sessionStorage.removeItem(sessionKey(round.slug)); } catch { /* Session storage may be unavailable. */ } }
    setToken(''); setPortal(null); setNotice('You have left your challenge portal on this device. Use your personal email link to return.');
  };

  return <div className={styles.root}>
    <section className={styles.hero} aria-labelledby="challenge-title"><div className={`${styles.container} ${styles.heroInner}`}>
      <div><p className={styles.eyebrow}><Trophy className={styles.icon} aria-hidden="true" />VaceUp community challenge</p>
        <h1 id="challenge-title" className={styles.title}>{round?.title || 'Build something worth sharing.'}</h1>
        <p className={styles.lede}>{round?.description || 'Put your skills into practice, share your work, and take part in a challenge built around what you create.'}</p>
        <div className={styles.row}>{portal ? <span className={styles.pill}>Your participant portal</span> : round && <span className={styles.pill}>{round.registration_open ? 'Registration open' : round.status === 'published' ? 'Results published' : 'Registration closed'}</span>}<Link href="/events" className={styles.link}><ArrowLeft className={styles.icon} aria-hidden="true" />All events</Link></div>
      </div>
      {round && <aside className={`${styles.panel} ${styles.stack}`} aria-label="Challenge timeline"><div className={styles.row}><CalendarDays className={styles.icon} aria-hidden="true" /><h2>Mark your calendar</h2></div><ChallengeDates round={round} /></aside>}
    </div></section>
    <div className={styles.container}>
      <div className={styles.stack}>
        {rounds.length > 1 && !portal && <ChallengeField label="Challenge round"><select className={styles.control} value={round?.slug || ''} disabled={loading} onChange={(event) => void chooseRound(event.target.value)}>{rounds.map((item) => <option key={item.id} value={item.slug}>{item.title}</option>)}</select></ChallengeField>}
        {error && <ChallengeNote error>{error} {!round && <Action size="sm" onClick={() => window.location.reload()}>Try again</Action>}</ChallengeNote>}
        {notice && <ChallengeNote success><div className={styles.tight}><strong>Challenge update</strong><p>{notice}</p></div></ChallengeNote>}
        {loading ? <div className={`${styles.panel} ${styles.empty}`} role="status"><Clock3 className={styles.largeIcon} aria-hidden="true" /><h2>Loading your challenge</h2><p className={styles.muted}>Getting the latest round details and your saved entry.</p></div>
          : !round ? <div className={`${styles.panel} ${styles.empty}`}><Trophy className={styles.largeIcon} aria-hidden="true" /><h2>The next challenge is on its way</h2><p className={styles.muted}>Published rounds and their project briefs will appear here. Explore our events while you wait.</p><Link href="/events" className={styles.link}>Explore events<ArrowUpRight className={styles.icon} aria-hidden="true" /></Link></div>
          : portal && token ? <ParticipantPortal portal={portal} token={token} onRefresh={() => loadPortal(token)} onLeave={signOut} />
            : <div className={styles.layout}>
              <div className={styles.stack}>
                {round.status === 'published' && <PublishedResults round={round} />}
                <section className={`${styles.panel} ${styles.stack}`} aria-labelledby="challenge-briefs"><div className={styles.tight}><p className={styles.eyebrow}>Start with your strength</p><h2 id="challenge-briefs">Choose your challenge</h2><p className={styles.muted}>Choose a category, then verify your email to receive its complete project brief and personal portal.</p></div>
                  <ul className={styles.categoryList}>{round.categories.filter((item) => item.enabled !== false).map((item) => <li key={item.id}><button type="button" className={styles.category} aria-pressed={category?.id === item.id} onClick={() => setCategory(item)}><span className={`${styles.row} ${styles.between}`}><strong>{item.name}</strong>{category?.id === item.id && <Check className={styles.icon} aria-hidden="true" />}</span><span className={styles.muted}>{item.brief?.split('\n')[0] || 'Your full brief is delivered after email verification.'}</span></button></li>)}</ul>
                  {category && <CategoryBrief category={category} />}
                </section>
                <RoundRules round={round} />
              </div>
              <aside className={styles.stack}>
                <section className={`${styles.panel} ${styles.stack}`} aria-labelledby="challenge-register"><div className={styles.tight}><Mail className={styles.largeIcon} aria-hidden="true" /><h2 id="challenge-register">{accessOnly ? 'Return to your entry' : 'Make it your challenge'}</h2><p className={styles.muted}>{accessOnly ? 'Enter the email you registered with. We will email a personal link if an entry exists.' : 'Register with your email. You do not need an academy account or a course enrolment.'}</p></div>
                  <form className={styles.stack} onSubmit={register}>
                    {!accessOnly && <><ChallengeField label="Full name"><input className={styles.control} autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} required maxLength={150} disabled={busy} /></ChallengeField><ChallengeField label="Phone number"><input className={styles.control} type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required maxLength={40} disabled={busy} /></ChallengeField></>}
                    <ChallengeField label="Email address"><input className={styles.control} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy} maxLength={254} /></ChallengeField>
                    {!accessOnly && <><div className={styles.note}><BookOpen className={styles.icon} aria-hidden="true" /><span>Selected category: <strong>{category?.name || 'Choose a category first'}</strong></span></div><label className={styles.check}><input type="checkbox" required checked={acceptRules} onChange={(event) => setAcceptRules(event.target.checked)} disabled={busy} /><span>I have read the challenge rules and agree to submit my own work for assessment.</span></label><label className={styles.check}><input type="checkbox" checked={makePublic} onChange={(event) => setMakePublic(event.target.checked)} disabled={busy} /><span>You may show my name and project in the published results. This is optional.</span></label></>}
                    <Action type="submit" intent="primary" loading={busy} disabled={!accessOnly && (!round.registration_open || !category)}>{accessOnly ? 'Email my personal link' : 'Register for this challenge'}</Action>
                    {!accessOnly && !round.registration_open && <p className={styles.muted}>Registration is currently closed. Registered participants can still return using their personal link.</p>}
                  </form>
                  <Action onClick={() => { setAccessOnly(!accessOnly); setNotice(''); setError(''); }} disabled={busy}>{accessOnly ? 'Register a new entry' : 'Already registered? Get your link'}</Action>
                  <p className={styles.muted}>Your challenge access stays separate from your VaceUp learning account. Never share your personal email link.</p>
                </section>
                <section className={`${styles.panel} ${styles.stack}`}><h2>How judging works</h2><ChallengeWeights mode={round.mode} /></section>
              </aside>
            </div>}
      </div>
    </div>
  </div>;
}

function CategoryBrief({ category }: { category: ChallengeCategory }) {
  return <div className={`${styles.stack} ${styles.separator}`}><h3>{category.name}: your brief</h3><p className={styles.body}>{category.brief || 'Register and verify your email to receive the full project brief for this category.'}</p>
    {!!category.requirements?.length && <div className={styles.tight}><h3>What to submit</h3><ul className={styles.list}>{category.requirements.map((item, index) => <li key={`${index}-${item}`}><Check className={styles.icon} aria-hidden="true" /><span>{item}</span></li>)}</ul></div>}
    {category.brief_download_url && <a className={styles.link} href={category.brief_download_url} target="_blank" rel="noopener noreferrer">Download your project brief<ArrowUpRight className={styles.icon} aria-hidden="true" /></a>}
    {!!category.rubric?.length && <details><summary>Assessment criteria</summary><ul className={styles.list}>{category.rubric.map((item) => <li key={item.id}><span>{item.label}{item.description ? `: ${item.description}` : ''}</span><strong>{item.max_points} points</strong></li>)}</ul></details>}
  </div>;
}

function RoundRules({ round }: { round: ChallengeRound }) {
  return <section className={`${styles.panel} ${styles.stack}`} aria-labelledby="challenge-rules"><h2 id="challenge-rules">A fair challenge, clear rules</h2>
    <ol className={styles.list}><li><span className={styles.number}>1</span><span>Create the project in your selected brief and upload the actual files in your participant portal.</span></li><li><span className={styles.number}>2</span><span>Publish your project on LinkedIn or Instagram. Include {round.hashtag ? <strong>{round.hashtag}</strong> : 'the required challenge hashtag'} and tag {round.linkedin_handle || round.instagram_handle || 'VaceUp using the handle in your brief'}.</span></li><li><span className={styles.number}>3</span><span>Keep the post publicly accessible, with like and comment counts visible, through the results announcement.</span></li><li><span className={styles.number}>4</span><span>Submit the public post link and requested evidence before the published deadlines. We do not need your social account password or private analytics access.</span></li></ol>
    {round.rules && <div className={styles.separator}><h3>Round rules</h3><p className={styles.body}>{round.rules}</p></div>}
    {round.mode === 'hybrid' && <p className={styles.muted}>Engagement records distinguish participant evidence from public observations. A daily refresh preserves the latest available observation; inaccessible or hidden counts may require updated evidence.</p>}
  </section>;
}

function ParticipantPortal({ portal, token, onRefresh, onLeave }: { portal: ChallengePortal; token: string; onRefresh: () => Promise<ChallengePortal>; onLeave: () => void }) {
  const round = portal.registration.round;
  const category = portal.registration.category;
  const [files, setFiles] = useState<ChallengeEvidence[]>(portal.submission?.evidence ?? []);
  const [postUrl, setPostUrl] = useState(portal.submission?.post_url ?? '');
  const [explanation, setExplanation] = useState(portal.submission?.explanation ?? '');
  const [checklist, setChecklist] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const closed = isPast(round.submission_closes_at) || ['frozen', 'published'].includes(round.status);
  const syncedSubmission = useRef(portal.submission?.id);
  const assessment = portal.assessment_status || portal.submission?.assessment_status || 'queued';
  const status = !portal.submission ? 'Your project is waiting for you' : ['ready', 'completed', 'assessed', 'succeeded'].includes(assessment) ? 'Project assessment complete' : ['processing', 'running'].includes(assessment) ? 'Your project is being assessed' : ['review', 'needs_review', 'review_required', 'failed'].includes(assessment) ? 'Your submission needs attention' : 'Your project is saved in the assessment queue';

  useEffect(() => {
    if (syncedSubmission.current === portal.submission?.id) return;
    syncedSubmission.current = portal.submission?.id;
    setFiles(portal.submission?.evidence ?? []); setPostUrl(portal.submission?.post_url ?? ''); setExplanation(portal.submission?.explanation ?? '');
  }, [portal.submission]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setMessage('');
    if (uploadBusy) { setError('Wait for your project files to finish uploading before submitting.'); return; }
    if (!files.length) { setError('Upload the actual project files requested in your brief before submitting.'); return; }
    setBusy(true);
    try { await challengeApi.submit(token, { post_url: postUrl.trim(), explanation: explanation.trim(), evidence_ids: files.map((file) => file.id), checklist_confirmed: checklist }); await onRefresh(); setMessage('Your project and public post link have been submitted. You can update them before the submission deadline.'); }
    catch (failure) { setError(challengeFailure(failure)); } finally { setBusy(false); }
  };

  return <div className={styles.stack}>
    <div className={`${styles.row} ${styles.between}`}><div className={styles.tight}><p className={styles.eyebrow}>Your personal workspace</p><h2 className={styles.metric}>Welcome, {portal.registration.full_name.split(' ')[0]}</h2><p className={styles.muted}>{category.name} · {portal.registration.email}</p></div><div className={styles.row}><Action disabled={busy || uploadBusy} onClick={() => { setBusy(true); void onRefresh().catch((failure) => setError(challengeFailure(failure))).finally(() => setBusy(false)); }} leftIcon={<RefreshCw className={styles.icon} />}>Refresh status</Action><Action onClick={onLeave} disabled={busy || uploadBusy}>Leave portal</Action></div></div>
    {message && <ChallengeNote success>{message}</ChallengeNote>}{error && <ChallengeNote error>{error}</ChallengeNote>}
    <ChallengeNote><div className={styles.tight}><strong>{status}</strong><p>{portal.submission?.participant_message || (!portal.submission ? 'Read your brief, create your project and submit it below.' : 'Your entry is saved. Scores and rankings stay private until the results are approved and published.')}</p></div></ChallengeNote>
    {round.status === 'published' && <PublishedResults round={round} personal={portal.result} />}
    <div className={styles.layout}><div className={styles.stack}>
      <section className={`${styles.panel} ${styles.stack}`}><div className={styles.row}><BookOpen className={styles.icon} aria-hidden="true" /><h2>Your selected brief</h2></div><CategoryBrief category={category} /></section>
      <section className={`${styles.panel} ${styles.stack}`} aria-labelledby="project-submission"><h2 id="project-submission">{portal.submission ? 'Your project submission' : 'Submit your project'}</h2><p className={styles.muted}>Project deadline: {challengeDate(round.submission_closes_at)}. Updating your project creates a new submission for assessment.</p>
        {closed && <ChallengeNote>The project submission window has closed. Your saved entry is available below.</ChallengeNote>}
        {!!portal.submission?.evidence?.length && <EvidenceLinks token={token} files={portal.submission.evidence} />}
        <form className={styles.stack} onSubmit={submit}>
          <EvidenceUpload token={token} kind="project" files={files} onChange={setFiles} onBusyChange={setUploadBusy} disabled={closed || busy} accept={category.accepted_extensions?.join(',') || '.pdf,.xlsx,.docx,.png,.jpg,.jpeg,.csv,.txt,.zip,.mp4,.webm'} />
          <ChallengeField label="Public LinkedIn or Instagram post link" hint="Paste the direct link to your own post or reel, rather than a profile link."><input className={styles.control} type="url" value={postUrl} onChange={(event) => setPostUrl(event.target.value)} required maxLength={1000} disabled={closed || busy} placeholder="https://www.linkedin.com/posts/..." /></ChallengeField>
          <ChallengeField label="Explain your project" hint="Describe what you built, your approach, and how the uploaded files demonstrate the requirements."><textarea className={styles.control} value={explanation} onChange={(event) => setExplanation(event.target.value)} required minLength={20} maxLength={12000} disabled={closed || busy} /></ChallengeField>
          <fieldset disabled={closed || busy}><legend>Before you submit</legend><div className={styles.tight}>
            <label className={styles.check}><input type="checkbox" required checked={checklist} onChange={(event) => setChecklist(event.target.checked)} /><span>I confirm this is my own work and public post. The post includes a short presentation video and the required VaceUp tag and hashtag, shows like and comment counts, and will stay public through the results announcement.</span></label>
            <p className={styles.muted}>Required hashtag: {round.hashtag || 'See your round rules'}. LinkedIn: {round.linkedin_handle || 'See your round rules'}. Instagram: {round.instagram_handle || 'See your round rules'}.</p>
          </div></fieldset>
          <div className={styles.row}><Action type="submit" intent="primary" loading={busy} disabled={closed || uploadBusy}>{portal.submission ? 'Update my submission' : 'Submit my project'}</Action>{portal.submission?.post_url && <a href={portal.submission.post_url} className={styles.link} target="_blank" rel="noopener noreferrer">Open public post<ArrowUpRight className={styles.icon} aria-hidden="true" /></a>}</div>
        </form>
      </section>
      {round.mode === 'hybrid' && <EngagementEvidence portal={portal} token={token} onRefresh={onRefresh} />}
    </div><aside className={styles.stack}><section className={`${styles.panel} ${styles.stack}`}><h2>Your timeline</h2><ChallengeDates round={round} /></section><section className={`${styles.panel} ${styles.stack}`}><h2>Your judging breakdown</h2><ChallengeWeights mode={round.mode} /></section><RoundRules round={round} /></aside></div>
  </div>;
}

function EngagementEvidence({ portal, token, onRefresh }: { portal: ChallengePortal; token: string; onRefresh: () => Promise<ChallengePortal> }) {
  const [files, setFiles] = useState<ChallengeEvidence[]>([]);
  const [counts, setCounts] = useState({ likes: '', comments: '', shares: '', views: '' });
  const [observedAt, setObservedAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const round = portal.registration.round;
  const closed = isPast(round.final_collection_ends_at) || ['frozen', 'published'].includes(round.status);
  const latest = portal.engagement?.find((snapshot) =>
    (['likes', 'comments', 'shares', 'views'] as const).some((metric) => snapshot[metric] != null || snapshot.declared_counts?.[metric] != null)
  ) ?? portal.engagement?.[0];
  const latestCount = (metric: 'likes' | 'comments' | 'shares' | 'views') => latest?.[metric] ?? latest?.declared_counts?.[metric];
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setMessage('');
    if (uploadBusy) { setError('Wait for the evidence upload to finish before saving your update.'); return; }
    if (!files.length) { setError('Upload a screenshot or an analytics export to support your update.'); return; }
    setBusy(true);
    try {
      const values = Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, value.trim() === '' ? null : Number(value)])) as Record<keyof typeof counts, number | null>;
      await challengeApi.engagement(token, { ...values, observed_at: new Date(`${observedAt}+01:00`).toISOString(), evidence_ids: files.map((file) => file.id) });
      await onRefresh(); setFiles([]); setMessage('Your evidence update is saved as participant supplied. It is not marked as a public observation.');
    } catch (failure) { setError(challengeFailure(failure)); } finally { setBusy(false); }
  };
  return <section className={`${styles.panel} ${styles.stack}`} aria-labelledby="engagement-evidence"><h2 id="engagement-evidence">Your engagement evidence</h2><p className={styles.muted}>Earlier updates are optional. Upload a new final public-counter screenshot or export between <strong>{challengeDate(round.final_collection_starts_at)}</strong> and <strong>{challengeDate(round.final_collection_ends_at)}</strong>. Both the new file and the final update must reach the server within that window.</p><p className={styles.muted}>Capture the post identity, visible likes and comments, and the date. We do not need your password or access to private analytics.</p>
    {latest ? <div className={`${styles.stack} ${styles.separator}`}><div className={`${styles.row} ${styles.between}`}><span className={styles.pill}>{engagementSource(latest.source)}</span><span className={styles.muted}>Captured {challengeDate(latest.observed_at)}</span></div><dl className={styles.dates}><div><dt>Likes</dt><dd>{countLabel(latestCount('likes'))}</dd></div><div><dt>Comments</dt><dd>{countLabel(latestCount('comments'))}</dd></div><div><dt>Shares, recorded for context</dt><dd>{countLabel(latestCount('shares'))}</dd></div><div><dt>Views, recorded for context</dt><dd>{countLabel(latestCount('views'))}</dd></div></dl><p className={styles.muted}>Received {challengeDate(latest.created_at)}. These are saved counts, not a new reading on refresh. Participant-entered values remain participant supplied while their evidence is assessed.</p>{!!latest.evidence?.length && <EvidenceLinks token={token} files={latest.evidence} />}</div> : <ChallengeNote>No engagement observation has been recorded yet. Missing counts are unavailable, rather than zero.</ChallengeNote>}
    {error && <ChallengeNote error>{error}</ChallengeNote>}{message && <ChallengeNote success>{message}</ChallengeNote>}
    {!portal.submission ? <p className={styles.muted}>Submit your project and public post link first. You can then add engagement evidence here.</p> : closed ? <ChallengeNote>The engagement evidence window has closed. Saved observations remain available to the judging team.</ChallengeNote> : <form className={styles.stack} onSubmit={submit}>
      <EvidenceUpload token={token} kind="engagement" files={files} onChange={setFiles} onBusyChange={setUploadBusy} disabled={busy} accept=".png,.jpg,.jpeg,.pdf,.csv,.xlsx" />
      <ChallengeField label="When were these counts captured? (Lagos time)"><input className={styles.control} type="datetime-local" value={observedAt} onChange={(event) => setObservedAt(event.target.value)} required disabled={busy} /></ChallengeField>
      <div className={styles.grid}>{(['likes', 'comments', 'shares', 'views'] as const).map((metric) => <ChallengeField key={metric} label={`${metric[0].toUpperCase()}${metric.slice(1)} (optional)`} hint="Leave blank if unavailable."><input className={styles.control} type="number" min={0} step={1} max={Number.MAX_SAFE_INTEGER} value={counts[metric]} onChange={(event) => setCounts({ ...counts, [metric]: event.target.value })} disabled={busy} /></ChallengeField>)}</div>
      <p className={styles.muted}>Any counts you enter are participant supplied and checked against your evidence. Shares and views are recorded for context; only likes and comments contribute to this round’s engagement component.</p><Action type="submit" intent="primary" loading={busy} disabled={uploadBusy}>Save evidence update</Action>
    </form>}
    {!!portal.engagement?.length && <details><summary>Previous observations ({portal.engagement.length})</summary><ul className={styles.list}>{portal.engagement.map((snapshot) => <li key={snapshot.id}><div className={styles.tight}><strong>{engagementSource(snapshot.source)}</strong><span>{challengeDate(snapshot.observed_at)}</span><span className={styles.muted}>{countLabel(snapshot.likes)} likes · {countLabel(snapshot.comments)} comments</span></div></li>)}</ul></details>}
  </section>;
}

function PublishedResults({ round, personal }: { round: ChallengeRound; personal?: ChallengePortal['result'] }) {
  const [rows, setRows] = useState<ChallengeResult[]>(round.results ?? []);
  const [error, setError] = useState('');
  useEffect(() => { let live = true; void challengeApi.results(round.slug).then((result) => { if (live) setRows(result.results); }).catch((failure) => { if (live) setError(challengeFailure(failure)); }); return () => { live = false; }; }, [round.slug]);
  return <section className={`${styles.panel} ${styles.stack}`} aria-labelledby="challenge-results"><div className={styles.row}><Trophy className={styles.largeIcon} aria-hidden="true" /><h2 id="challenge-results">The results are in</h2></div><p className={styles.muted}>Results approved and published by VaceUp for this round.</p>
    {error && <ChallengeNote error>{error}</ChallengeNote>}
    {personal && <div className={styles.note}><div><strong>Your result</strong><p>{personal.award || (personal.winner ? 'Category winner' : personal.rank ? `Placed ${personal.rank}` : 'Your entry has been assessed')}{personal.total !== null && personal.total !== undefined ? ` · ${Number(personal.total).toFixed(2)} points` : ''}</p></div></div>}
    {rows.length ? <ol className={styles.list}>{rows.map((row, index) => <li key={`${row.name}-${index}`}><span className={styles.number}>{row.rank || index + 1}</span><div className={styles.tight}><strong>{row.name}</strong><span className={styles.muted}>{row.category}{row.award ? ` · ${row.award}` : ''}{row.total !== undefined && row.total !== null ? ` · ${Number(row.total).toFixed(2)} points` : ''}</span></div></li>)}</ol> : <p className={styles.muted}>Published participant results are available in personal portals. Public names appear only where participants have agreed to publication.</p>}
  </section>;
}
