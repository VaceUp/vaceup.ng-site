'use client';

import { useId, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, FileCheck2, Upload } from 'lucide-react';
import { Action } from '@/components/Dashboard/admin/AuthoringUI';
import { challengeAdminApi, challengeApi, challengeDate, challengeFailure, uploadChallengeEvidence, type ChallengeEvidence, type ChallengeRound } from '@/lib/challenge-api';
import { formatBytes } from '@/lib/upload';
import { cn } from '@/lib/utils';
import styles from './challenge.module.css';

export { Action, styles };

export function ChallengeNote({ children, error, success }: { children: ReactNode; error?: boolean; success?: boolean }) {
  const Icon = error ? AlertCircle : CheckCircle2;
  return <div className={cn(styles.note, error && styles.error, success && styles.success)} role={error ? 'alert' : 'status'}><Icon className={styles.icon} aria-hidden="true" /><div>{children}</div></div>;
}

export function ChallengeField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}{hint && <span className={styles.muted}>{hint}</span>}</label>;
}

export function ChallengeDates({ round }: { round: ChallengeRound }) {
  return <dl className={styles.dates}>
    <div><dt>Project submission closes</dt><dd>{challengeDate(round.submission_closes_at)}</dd></div>
    <div><dt>Final evidence collection starts</dt><dd>{challengeDate(round.final_collection_starts_at)}</dd></div>
    <div><dt>Final evidence collection ends</dt><dd>{challengeDate(round.final_collection_ends_at)}</dd></div>
    <div><dt>Results scheduled</dt><dd>{challengeDate(round.results_publish_at)}</dd></div>
  </dl>;
}

export function ChallengeWeights({ mode }: { mode: string }) {
  return <div className={styles.scoreFormula}>
    <div><span>Project quality</span><strong>{mode === 'quality_only' ? '100' : '80'}%</strong></div>
    {mode !== 'quality_only' && <><div><span>Likes</span><strong>12%</strong></div><div><span>Comments</span><strong>8%</strong></div></>}
    <p className={styles.muted}>{mode === 'quality_only' ? 'This round is judged on your submitted project. Social engagement does not affect your score.' : 'Engagement follows the published round rules. Missing or private counts are not treated as verified zeroes.'}</p>
  </div>;
}

export function EvidenceUpload({ token, kind, files, onChange, disabled, accept, onBusyChange }: {
  token: string; kind: ChallengeEvidence['kind']; files: ChallengeEvidence[];
  onChange: (files: ChallengeEvidence[]) => void; disabled?: boolean; accept?: string; onBusyChange?: (value: boolean) => void;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState('');
  const [error, setError] = useState('');
  const uploadFiles = async (selected: FileList | null) => {
    if (!selected?.length) return;
    const limit = kind === 'project' ? 6 : 10;
    if (selected.length + files.length > limit) { setError(`Attach up to ${limit} files. Remove an existing file before adding more.`); return; }
    setBusy(true); onBusyChange?.(true); setError('');
    const uploaded = [...files];
    try {
      for (const file of Array.from(selected)) {
        setCurrent(file.name); setProgress(0);
        const evidence = await uploadChallengeEvidence(token, file, kind, setProgress);
        uploaded.push(evidence); onChange([...uploaded]);
      }
    } catch (failure) { setError(challengeFailure(failure)); }
    finally { setBusy(false); onBusyChange?.(false); setCurrent(''); }
  };
  return <div className={styles.stack}>
    <div className={styles.upload}>
      <div className={styles.row}><Upload className={styles.icon} aria-hidden="true" /><label htmlFor={id}><strong>{kind === 'project' ? 'Upload your project files' : 'Upload engagement evidence'}</strong></label></div>
      <p id={`${id}-hint`} className={styles.muted}>{kind === 'project' ? 'Include the actual work requested in your brief, up to six files of 20 MB each. Include source files and screenshots for visual work. Videos, PDF layouts and work beyond the assessment limits may need review.' : 'Add screenshots showing the public post, visible counts and capture date; or a relevant CSV/XLSX export. For faster processing, include a table with clearly labelled likes and comments. Up to ten files of 10 MB each. Hide unrelated personal information.'}</p>
      <input id={id} type="file" multiple disabled={disabled || busy} accept={accept} aria-describedby={`${id}-hint`} aria-busy={busy} onChange={(event) => { void uploadFiles(event.target.files); event.target.value = ''; }} />
      {busy && <div role="status" className={styles.tight}><span>{progress < 0 ? 'Connection is taking longer than expected' : `Uploading ${current}: ${progress}%`}</span><progress className={styles.progress} max={100} value={progress < 0 ? undefined : progress} aria-label={`Uploading ${current}`} /></div>}
    </div>
    {error && <ChallengeNote error>{error} Files already uploaded remain available. Select the remaining file to try again.</ChallengeNote>}
    {files.length > 0 && <ul className={styles.list} aria-label={kind === 'project' ? 'Project files ready to submit' : 'Engagement evidence ready to submit'}>{files.map((file) => <li className={styles.file} key={file.id}>
      <span className={styles.fileTitle}><FileCheck2 className={styles.icon} aria-hidden="true" /><span>{file.name}<span className={styles.muted}> {file.size_bytes ? formatBytes(file.size_bytes) : ''}</span></span></span>
      <Action size="sm" intent="danger" disabled={busy || disabled} onClick={() => onChange(files.filter((item) => item.id !== file.id))}>Remove<span className="sr-only"> {file.name} from this submission</span></Action>
    </li>)}</ul>}
  </div>;
}

export function EvidenceLinks({ files, token, admin }: { files: ChallengeEvidence[]; token?: string; admin?: boolean }) {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const prepare = async (file: ChallengeEvidence) => {
    setBusy(String(file.id)); setError('');
    try {
      const result = admin ? await challengeAdminApi.download(file.id) : await challengeApi.download(token || '', file.id);
      const target = new URL(result.url);
      if (target.protocol !== 'https:' && !(target.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(target.hostname))) throw new Error('The private file link is invalid. Request a new link.');
      setLinks((current) => ({ ...current, [String(file.id)]: result.url }));
    } catch (failure) { setError(challengeFailure(failure)); } finally { setBusy(null); }
  };
  return <div className={styles.tight}>{error && <ChallengeNote error>{error}</ChallengeNote>}<ul className={styles.list}>{files.map((file) => <li key={file.id} className={styles.file}><div className={styles.fileTitle}><FileCheck2 className={styles.icon} aria-hidden="true" /><span>{file.name}{file.size_bytes ? ` · ${formatBytes(file.size_bytes)}` : ''}</span></div>{links[String(file.id)] ? <a href={links[String(file.id)]} target="_blank" rel="noopener noreferrer" className={styles.link}>Open file<span className="sr-only"> {file.name}</span></a> : <Action size="sm" loading={busy === String(file.id)} disabled={busy !== null} onClick={() => void prepare(file)}>Get private file<span className="sr-only"> {file.name}</span></Action>}</li>)}</ul></div>;
}
