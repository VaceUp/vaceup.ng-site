'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Check, Clock3, KeyRound, Mail, RefreshCw, Trophy } from 'lucide-react';
import {
  challengeApi, challengeDate, challengeFailure, engagementSource,
  type ChallengeCategory, type ChallengeEvidence, type ChallengePortal, type ChallengeRound, type ChallengeResult,
} from '@/lib/challenge-api';
import { Action, CategoryIcon, ChallengeDates, ChallengeField, ChallengeNote, ChallengeWeights, CheckCard, EvidenceLinks, EvidenceUpload, Reveal, styles } from './ChallengeUI';
import { RulesReader } from './RulesReader';
import { JsonLd, challengeEventJsonLd } from '@/lib/seo';

const sessionKey = (slug: string) => `vaceup_challenge_session:${slug}`;
const isPast = (value: string) => new Date(value).getTime() < Date.now();
const countLabel = (value: number | null | undefined) => value === null || value === undefined ? 'Unavailable' : value.toLocaleString();

type GuestStep = 'intro' | 'tracks' | 'join';

// localStorage, not sessionStorage: returning to the same browser reopens the
// portal without another email. There is still no permanent account - the
// session token itself expires with the round, server-side.
function readSession(slug: string): string {
  try { return window.localStorage.getItem(sessionKey(slug)) || ''; } catch { return ''; }
}
function saveSession(slug: string, token: string) {
  try { window.localStorage.setItem(sessionKey(slug), token); } catch { /* The active tab can continue without persistent storage. */ }
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
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [confirmation, setConfirmation] = useState<{ name: string; email: string; category: string; accessCode: string | null } | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [accessOnly, setAccessOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<GuestStep>('intro');
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
      if (data.verificationError) { setError(data.verificationError); setAccessOnly(true); setStep('join'); }
      if (data.token) await loadPortal(data.token);
    }).catch((failure) => { if (live) setError(challengeFailure(failure)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [loadPortal]);

  const chooseRound = async (slug: string) => {
    setLoading(true); setError(''); setNotice(''); setPortal(null); setToken(''); setStep('intro');
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
    // Returning participants skip the email round-trip entirely: email plus
    // their saved six-digit code opens the portal on the spot.
    if (accessOnly && accessCode.trim().length === 6) {
      try {
        const verified = await challengeApi.accessCode(round.slug, email.trim(), accessCode.trim());
        await loadPortal(verified.access_token);
        setAccessCode('');
      } catch (failure) { setError(challengeFailure(failure)); }
      finally { setBusy(false); }
      return;
    }
    try {
      const response = accessOnly
        ? await challengeApi.access(round.slug, email.trim())
        : await challengeApi.register({ round_slug: round.slug, category_id: category!.id, full_name: fullName.trim(), email: email.trim(), phone: phone.trim(), accept_rules: acceptRules, make_public: makePublic, marketing_opt_in: marketingOptIn });
      if (accessOnly) setNotice(response.detail || 'Check your inbox for your personal challenge link. Check spam as well.');
      // Registration gets its own confirmation screen; a quiet note at the top
      // of a still-filled form leaves people unsure anything happened.
      else setConfirmation({ name: fullName.trim().split(' ')[0] || 'there', email: email.trim(), category: category!.name, accessCode: response.access_code ?? null });
    } catch (failure) { setError(challengeFailure(failure)); }
    finally { setBusy(false); }
  };

  const signOut = () => {
    if (round) { try { window.localStorage.removeItem(sessionKey(round.slug)); } catch { /* Session storage may be unavailable. */ } }
    setToken(''); setPortal(null); setStep('intro');
    setNotice('You have left your challenge portal on this device. Use your personal email link or your access code to return.');
  };

  const stepMeta: Array<{ key: GuestStep; label: string; reachable: boolean }> = [
    { key: 'intro', label: 'The challenge', reachable: true },
    { key: 'tracks', label: 'Pick your track', reachable: true },
    { key: 'join', label: 'Join in', reachable: accessOnly || !!category },
  ];
  const activeIndex = stepMeta.findIndex((item) => item.key === step);

  return <div className={styles.root}>
    {round && <JsonLd data={challengeEventJsonLd(round)} />}
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
            : <div className={styles.stack}>
              <nav aria-label="Registration progress"><ol className={styles.stepper}>{stepMeta.map((item, index) => {
                const done = index < activeIndex;
                return <li key={item.key}>
                  <button type="button" disabled={loading || (!item.reachable && index > activeIndex)} aria-current={index === activeIndex ? 'step' : undefined} onClick={() => setStep(item.key)}>
                    <span className={styles.stepCount} aria-hidden="true">{done ? <Check className={styles.icon} /> : index + 1}</span>
                    <span>{item.label}</span>
                  </button>
                  {index < stepMeta.length - 1 && <span className={styles.stepConnector} aria-hidden="true" />}
                </li>;
              })}</ol></nav>
              {step === 'intro' && <GuestIntro round={round} onChoose={() => setStep('tracks')} onAccess={() => { setAccessOnly(true); setStep('join'); }} />}
              {step === 'tracks' && <GuestTracks round={round} category={category} onPick={setCategory} onBack={() => setStep('intro')} onContinue={() => { setAccessOnly(false); setStep('join'); }} />}
              {step === 'join' && <GuestJoin round={round} category={category} accessOnly={accessOnly} busy={busy} email={email} fullName={fullName} phone={phone} acceptRules={acceptRules} makePublic={makePublic} marketingOptIn={marketingOptIn} accessCode={accessCode}
                onAccessOnly={(value) => { setAccessOnly(value); if (!value && !category) setStep('tracks'); }}
                setEmail={setEmail} setFullName={setFullName} setPhone={setPhone} setAcceptRules={setAcceptRules} setMakePublic={setMakePublic} setMarketingOptIn={setMarketingOptIn} setAccessCode={setAccessCode}
                onBack={() => { setStep(accessOnly ? 'intro' : 'tracks'); }} onChangeTrack={() => { setAccessOnly(false); setStep('tracks'); }} onSubmit={register}
                confirmation={confirmation}
                onOverview={() => { setConfirmation(null); setStep('intro'); }}
                onResend={() => { setConfirmation(null); setAccessOnly(true); }}
                onAnother={() => { setConfirmation(null); setFullName(''); setPhone(''); setEmail(''); setAcceptRules(false); setMakePublic(false); setMarketingOptIn(false); setAccessCode(''); }} />}
            </div>}
      </div>
    </div>
  </div>;
}

function GuestIntro({ round, onChoose, onAccess }: { round: ChallengeRound; onChoose: () => void; onAccess: () => void }) {
  return <div className={styles.stepFlow}>
    {round.status === 'published' && <PublishedResults round={round} />}
    <section className={`${styles.panel} ${styles.stack}`} aria-labelledby="how-it-works"><div className={styles.tight}><p className={styles.eyebrow}>Three steps</p><h2 id="how-it-works">How the challenge works</h2></div>
      <ul className={styles.cards}>
        <li className={styles.card} style={{ '--i': 0 } as CSSProperties}><span className={styles.number} aria-hidden="true">1</span><div className={styles.tight}><h3>Pick your track</h3><p className={styles.muted}>Choose one of five categories. Registering sends that category&apos;s full project brief straight to your inbox.</p></div></li>
        <li className={styles.card} style={{ '--i': 1 } as CSSProperties}><span className={styles.number} aria-hidden="true">2</span><div className={styles.tight}><h3>Create and publish</h3><p className={styles.muted}>Build the project from your brief, then publish your work publicly on LinkedIn or Instagram with the official hashtag and a short video walkthrough.</p></div></li>
        <li className={styles.card} style={{ '--i': 2 } as CSSProperties}><span className={styles.number} aria-hidden="true">3</span><div className={styles.tight}><h3>Submit your evidence</h3><p className={styles.muted}>Upload the actual project files and your public post link before the deadline. Judging looks at your work, not just your caption.</p></div></li>
      </ul>
      <div className={styles.ctaRow}>
        <Action intent="primary" onClick={onChoose}>Choose your category<ArrowRight className={styles.icon} aria-hidden="true" /></Action>
        <Action onClick={onAccess}>I already registered</Action>
        {!round.registration_open && round.status !== 'published' && <p className={styles.muted}>Registration is currently closed. You can still read the briefs and prepare.</p>}
      </div>
    </section>
    <section className={`${styles.panel} ${styles.stack}`}><h2>How judging works</h2><ChallengeWeights mode={round.mode} /></section>
    <RoundRules round={round} />
  </div>;
}

function GuestTracks({ round, category, onPick, onBack, onContinue }: { round: ChallengeRound; category: ChallengeCategory | null; onPick: (category: ChallengeCategory) => void; onBack: () => void; onContinue: () => void }) {
  return <div className={styles.stepFlow}>
    <section className={`${styles.panel} ${styles.stack}`} aria-labelledby="pick-track">
      <div className={styles.tight}><p className={styles.eyebrow}>Step 2 of 3</p><h2 id="pick-track">Choose your challenge</h2><p className={styles.muted}>Every participant enters one category. Select yours below — the complete brief arrives by email after you verify your address.</p></div>
      <ul className={styles.cards}>{round.categories.filter((item) => item.enabled !== false).map((item, index) => <li key={item.id} style={{ '--i': index } as CSSProperties}><button type="button" className={styles.category} aria-pressed={category?.id === item.id} onClick={() => onPick(item)}><CategoryIcon name={item.name} /><span className={`${styles.row} ${styles.between}`}><strong>{item.name}</strong>{category?.id === item.id && <Check className={styles.icon} aria-hidden="true" />}</span><span className={styles.muted}>{item.brief?.split('\n')[0] || 'Your full brief is delivered after email verification.'}</span><span className={styles.pick}>{category?.id === item.id ? 'Selected' : 'Select this track'}</span></button></li>)}</ul>
      <div className={styles.ctaRow}>
        <Action onClick={onBack}><ArrowLeft className={styles.icon} aria-hidden="true" />Back</Action>
        <Action intent="primary" onClick={onContinue} disabled={!category}>{category ? `Continue with ${category.name}` : 'Select a track to continue'}<ArrowRight className={styles.icon} aria-hidden="true" /></Action>
      </div>
      {category && <details className={styles.briefDetails}><summary>Preview the {category.name} brief</summary><CategoryBrief category={category} /></details>}
    </section>
  </div>;
}

function GuestJoin({ round, category, accessOnly, busy, email, fullName, phone, acceptRules, makePublic, marketingOptIn, accessCode, onAccessOnly, setEmail, setFullName, setPhone, setAcceptRules, setMakePublic, setMarketingOptIn, setAccessCode, onBack, onChangeTrack, onSubmit, confirmation, onOverview, onResend, onAnother }: {
  round: ChallengeRound; category: ChallengeCategory | null; accessOnly: boolean; busy: boolean;
  email: string; fullName: string; phone: string; acceptRules: boolean; makePublic: boolean; marketingOptIn: boolean; accessCode: string;
  onAccessOnly: (value: boolean) => void; setEmail: (value: string) => void; setFullName: (value: string) => void; setPhone: (value: string) => void;
  setAcceptRules: (value: boolean) => void; setMakePublic: (value: boolean) => void; setMarketingOptIn: (value: boolean) => void; setAccessCode: (value: string) => void;
  onBack: () => void; onChangeTrack: () => void; onSubmit: (event: FormEvent) => void;
  confirmation: { name: string; email: string; category: string; accessCode: string | null } | null; onOverview: () => void; onResend: () => void; onAnother: () => void;
}) {
  if (confirmation) return <RegistrationConfirmation round={round} confirmation={confirmation} onOverview={onOverview} onResend={onResend} onAnother={onAnother} />;
  return <div className={styles.stepFlow}>
    <section className={`${styles.panel} ${styles.stack} ${styles.narrow}`} aria-labelledby="join-step">
      <header className={styles.joinHeader}>
        <Action size="sm" onClick={onBack} disabled={busy}><ArrowLeft className={styles.icon} aria-hidden="true" />Back</Action>
        <p className={styles.muted}>Step 3 of 3</p>
      </header>
      <div className={styles.tight}>
        <p className={styles.eyebrow}>{accessOnly ? 'Access recovery' : 'Registration'}</p>
        <h2 id="join-step">{accessOnly ? 'Return to your entry' : 'Make it your challenge'}</h2>
        <p className={styles.muted}>{accessOnly ? 'Enter the email you registered with. We will email a personal link if an entry exists.' : 'Takes about a minute. You do not need an academy account or a course enrolment.'}</p>
      </div>
      {!accessOnly && category && <div className={styles.trackBar}>
        <CategoryIcon name={category.name} />
        <div className={styles.trackBarText}><strong>{category.name}</strong><span className={styles.muted}>Your selected track</span></div>
        <Action size="sm" onClick={onChangeTrack}>Change</Action>
      </div>}
      <form className={styles.stack} onSubmit={onSubmit}>
        {accessOnly
          ? <>
            <ChallengeField label="Email address"><input className={styles.control} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy} maxLength={254} /></ChallengeField>
            <ChallengeField label="Access code (optional)" hint="The six-digit code from your registration confirmation or access email. With it, this button opens your portal right now; without it, we email you a fresh link."><input className={styles.control} inputMode="numeric" autoComplete="one-time-code" value={accessCode} onChange={(event) => setAccessCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))} maxLength={6} disabled={busy} /></ChallengeField>
          </>
          : <fieldset className={styles.joinGroup}>
            <legend>Your details</legend>
            <ChallengeField label="Full name"><input className={styles.control} autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} required maxLength={150} disabled={busy} /></ChallengeField>
            <ChallengeField label="Phone number"><input className={styles.control} type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required maxLength={40} disabled={busy} /></ChallengeField>
            <ChallengeField label="Email address"><input className={styles.control} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy} maxLength={254} /></ChallengeField>
          </fieldset>}
        {!accessOnly && <fieldset className={styles.joinGroup}>
          <legend>Your commitments</legend>
          <CheckCard checked={acceptRules} onChange={setAcceptRules} disabled={busy} required title="I accept the challenge rules" description="I have read the rules and agree to submit my own work for assessment." />
          <CheckCard checked={makePublic} onChange={setMakePublic} disabled={busy} title="Show my name in the published results" description="Optional. Public results name only participants who agree." />
          <CheckCard checked={marketingOptIn} onChange={setMarketingOptIn} disabled={busy} title="Email me academy news and offers" description="Optional. Tech academy adverts, course launches and future challenge updates. Unsubscribe any time." />
        </fieldset>}
        <Action type="submit" intent="primary" className={styles.ctaWide} loading={busy} disabled={!accessOnly && (!round.registration_open || !category)}>{accessOnly ? (accessCode.trim().length === 6 ? 'Open my portal now' : 'Email my personal link') : 'Register for this challenge'}</Action>
        {!accessOnly && !round.registration_open && <p className={styles.muted}>Registration is currently closed. Registered participants can still return using their personal link.</p>}
      </form>
      <div className={styles.joinAside}>
        <Action onClick={() => onAccessOnly(!accessOnly)} disabled={busy}>{accessOnly ? 'Register a new entry' : 'Already registered? Email me my link'}</Action>
        <p className={styles.muted}>Your challenge access stays separate from your VaceUp learning account. Never share your personal email link.</p>
      </div>
    </section>
  </div>;
}

function CategoryBrief({ category }: { category: ChallengeCategory }) {
  const rubricTotal = (category.rubric ?? []).reduce((sum, item) => sum + Number(item.max_points || 0), 0);
  return <div className={`${styles.stack} ${styles.separator}`}><h3>{category.name}: your brief</h3><p className={styles.body}>{category.brief || 'Register and verify your email to receive the full project brief for this category.'}</p>
    {!!category.requirements?.length && <div className={styles.tight}><h3>What to submit</h3><ul className={styles.list}>{category.requirements.map((item, index) => <li key={`${index}-${item}`}><Check className={styles.icon} aria-hidden="true" /><span>{item}</span></li>)}</ul></div>}
    {category.brief_download_url && <a className={styles.link} href={category.brief_download_url} target="_blank" rel="noopener noreferrer">Download your brief materials<ArrowUpRight className={styles.icon} aria-hidden="true" /></a>}
    {!!category.rubric?.length && <details className={styles.rubricDetails}><summary>Assessment criteria · {rubricTotal} points</summary>
      <ul className={styles.rubric}>{category.rubric.map((item) => <li key={item.id} className={styles.criterion}>
        <div className={styles.criterionHead}><span className={styles.criterionLabel}>{item.label}</span><span className={styles.pointsPill}>{Number(item.max_points)} points</span></div>
        {item.description && <p className={styles.criterionBody}>{item.description}</p>}
      </li>)}</ul>
    </details>}
  </div>;
}

function RegistrationConfirmation({ round, confirmation, onOverview, onResend, onAnother }: {
  round: ChallengeRound; confirmation: { name: string; email: string; category: string; accessCode: string | null };
  onOverview: () => void; onResend: () => void; onAnother: () => void;
}) {
  return <div className={styles.stepFlow}>
    <section className={`${styles.panel} ${styles.stack} ${styles.narrow}`} aria-labelledby="registered-title">
      <div className={styles.confirmHero}>
        <span className={styles.confirmBadge}><Check className={styles.icon} aria-hidden="true" /></span>
        <div className={styles.tight}>
          <p className={styles.eyebrow}>Registration received</p>
          <h2 id="registered-title">You are in, {confirmation.name}</h2>
        </div>
      </div>
      <div className={styles.trackBar}>
        <CategoryIcon name={confirmation.category} />
        <div className={styles.trackBarText}><strong>{confirmation.category}</strong><span className={styles.muted}>Your selected track</span></div>
      </div>
      <ChallengeNote success><div className={styles.tight}><strong>We emailed {confirmation.email}</strong><p>The {confirmation.category} project brief and your personal challenge link are on their way. Nothing after a few minutes? Check spam, then resend the link below.</p></div></ChallengeNote>
      {confirmation.accessCode && <div className={styles.note}><KeyRound className={styles.icon} aria-hidden="true" /><span>Your access code: <strong>{confirmation.accessCode}</strong> — together with your email it reopens this portal on any device, without another email. Save it now; it works until the round ends.</span></div>}
      <div className={styles.tight}>
        <h3>What happens next</h3>
        <ol className={styles.list}>
          <li><span className={styles.number}>1</span><span>Verify your email — the personal link in the message opens your private participant portal.</span></li>
          <li><span className={styles.number}>2</span><span>Create your project — the full brief, deliverables and rubric are in the email and in your portal. Submission closes {challengeDate(round.submission_closes_at)}.</span></li>
          <li><span className={styles.number}>3</span><span>Publish and submit — upload the actual project files with your public post link before the deadline.</span></li>
        </ol>
      </div>
      <div className={styles.ctaRow}>
        <Action intent="primary" onClick={onOverview}>Back to the challenge overview</Action>
        <Action onClick={onResend}>Resend my personal link</Action>
        <Action onClick={onAnother}>Register another participant</Action>
      </div>
      <p className={styles.muted}>Keep your personal email link private — it is the key to your entry.</p>
    </section>
  </div>;
}

function RoundRules({ round }: { round: ChallengeRound }) {
  return <section className={`${styles.panel} ${styles.stack}`} aria-labelledby="challenge-rules"><h2 id="challenge-rules">A fair challenge, clear rules</h2>
    <ol className={styles.list}><li><span className={styles.number}>1</span><span>Create the project in your selected brief and upload the actual files in your participant portal.</span></li><li><span className={styles.number}>2</span><span>Publish your project on LinkedIn or Instagram. Include {round.hashtag ? <strong>{round.hashtag}</strong> : 'the required challenge hashtag'} and tag {round.linkedin_handle || round.instagram_handle || 'VaceUp using the handle in your brief'}.</span></li><li><span className={styles.number}>3</span><span>Keep the post publicly accessible, with like and comment counts visible, through the results announcement.</span></li><li><span className={styles.number}>4</span><span>Submit the public post link and requested evidence before the published deadlines. We do not need your social account password or private analytics access.</span></li></ol>
    {round.rules && <div className={styles.separator}><h3>Round rules</h3><RulesReader rules={round.rules} /></div>}
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

  type PortalTab = 'overview' | 'project' | 'engagement' | 'results';
  const tabs: PortalTab[] = round.mode === 'hybrid' ? ['overview', 'project', 'engagement'] : ['overview', 'project'];
  if (round.status === 'published') tabs.push('results');
  const [tab, setTab] = useState<PortalTab>('overview');
  const tabLabels: Record<PortalTab, string> = { overview: 'Overview', project: 'Your project', engagement: 'Engagement evidence', results: 'Results' };

  const onTabKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const index = tabs.indexOf(tab);
    const next = tabs[event.key === 'ArrowRight' ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length];
    setTab(next);
    document.getElementById(`portal-tab-${next}`)?.focus();
  };

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
    <div className={styles.tablist} role="tablist" aria-label="Your challenge portal sections" onKeyDown={onTabKeys}>
      {tabs.map((item) => <button key={item} type="button" role="tab" id={`portal-tab-${item}`} className={styles.tab} aria-selected={tab === item} aria-controls="portal-panel" tabIndex={tab === item ? 0 : -1} onClick={() => setTab(item)}>{tabLabels[item]}</button>)}
    </div>
    <div id="portal-panel" role="tabpanel" aria-labelledby={`portal-tab-${tab}`} className={styles.stack}>
      {message && <ChallengeNote success>{message}</ChallengeNote>}{error && <ChallengeNote error>{error}</ChallengeNote>}
      {tab === 'overview' && <div className={styles.stack}>
        <ChallengeNote><div className={styles.tight}><strong>{status}</strong><p>{portal.submission?.participant_message || (!portal.submission ? 'Read your brief, create your project and submit it under Your project.' : 'Your entry is saved. Scores and rankings stay private until the results are approved and published.')}</p></div></ChallengeNote>
        <section className={`${styles.panel} ${styles.stack}`}><div className={styles.row}><BookOpen className={styles.icon} aria-hidden="true" /><h2>Your selected brief</h2></div><CategoryBrief category={category} /></section>
        <Reveal>
          <div className={styles.layout}>
            <section className={`${styles.panel} ${styles.stack}`}><h2>Your timeline</h2><ChallengeDates round={round} /></section>
            <section className={`${styles.panel} ${styles.stack}`}><h2>Your judging breakdown</h2><ChallengeWeights mode={round.mode} /></section>
          </div>
        </Reveal>
        <RoundRules round={round} />
      </div>}
      {tab === 'project' && <section className={`${styles.panel} ${styles.stack}`} aria-labelledby="project-submission"><h2 id="project-submission">{portal.submission ? 'Your project submission' : 'Submit your project'}</h2><p className={styles.muted}>Project deadline: {challengeDate(round.submission_closes_at)}. Updating your project creates a new submission for assessment.</p>
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
      </section>}
      {tab === 'engagement' && <EngagementEvidence portal={portal} token={token} onRefresh={onRefresh} />}
      {tab === 'results' && <PublishedResults round={round} personal={portal.result} />}
    </div>
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
