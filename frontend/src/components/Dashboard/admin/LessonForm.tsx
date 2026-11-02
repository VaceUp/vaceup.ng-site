'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { webUrl } from '@/lib/workspace-api';
import { failureMessage, type ManagedLesson } from '@/lib/course-management';
import { formatBytes, formatSeconds, putFileWithProgress, UploadError, type UploadHandle, type UploadSnapshot } from '@/lib/upload';
import { cn } from '@/lib/utils';
import {
  Action, CheckRow, Field, FormGrid, FormGroup, LinkAction, StatusNote, TextInput,
  adminStyles, controlClass, formClass,
} from './AdminUI';

const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const minutesOf = (seconds: number) => (seconds ? String(Math.round((seconds / 60) * 100) / 100) : '0');
const secondsOf = (minutes: string) => Math.max(0, Math.round(Number(minutes || 0) * 60));

type UploadStage = 'link' | 'sending' | 'confirming';
const UPLOAD_STEPS: { stage: UploadStage; label: string }[] = [
  { stage: 'link', label: 'Ask the academy for an upload link' },
  { stage: 'sending', label: 'Send the file to private storage' },
  { stage: 'confirming', label: 'Attach the video to this lesson' },
];

function uploadExplanation(reason: unknown, stage: UploadStage): string {
  if (reason instanceof UploadError) {
    if (reason.kind === 'aborted') return 'The upload was cancelled, so nothing was attached to this lesson.';
    if (reason.kind === 'timeout') return 'The connection stopped responding. Check the internet connection, then try again.';
    if (reason.status === 403) return 'The storage bucket refused the write (HTTP 403). The R2 token may have expired or lack write permission for this bucket.';
    if (reason.kind === 'http') return `${reason.message} Nothing was attached to this lesson.`;
    return 'The browser could not finish sending the file to the bucket. Either the bucket has no CORS rule for this site or the connection dropped mid-upload; the bar above shows how far it got.';
  }
  if (stage === 'link') {
    return 'This step is a small request to the academy, not the video file, so a failure here means the API itself is unreachable.';
  }
  return failureMessage(reason);
}

export default function LessonForm({ lesson, moduleId, formId, onSaved, onDirtyChange, onBusyChange }: {
  lesson?: ManagedLesson; moduleId: number; formId: string;
  onSaved: (lesson: ManagedLesson, source: 'details' | 'video') => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [form, setForm] = useState({
    title: lesson?.title || '', content: lesson?.content || '', order: lesson?.order ?? 0,
    minutes: minutesOf(lesson?.duration_seconds ?? 0), is_preview: lesson?.is_preview || false,
  });
  const [baseline, setBaseline] = useState(() => JSON.stringify(form));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState<UploadStage | null>(null);
  const [snapshot, setSnapshot] = useState<UploadSnapshot | null>(null);
  const [stalled, setStalled] = useState(false);
  const [lastFile, setLastFile] = useState<File | null>(null);
  // The video block sits at the bottom of a scrolling drawer, so its messages
  // have to appear there rather than at the top of the form.
  const [videoNote, setVideoNote] = useState(false);
  const cancelUpload = useRef<UploadHandle | null>(null);
  const [playback, setPlayback] = useState('');
  const [external, setExternal] = useState(false);

  const dirty = JSON.stringify(form) !== baseline;
  const dirtyRef = useRef(onDirtyChange);
  dirtyRef.current = onDirtyChange;
  const busyRef = useRef(onBusyChange);
  busyRef.current = onBusyChange;
  useEffect(() => { dirtyRef.current?.(dirty); }, [dirty]);
  useEffect(() => () => { dirtyRef.current?.(false); busyRef.current?.(false); }, []);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); busyRef.current?.(true);
    setError(''); setVideoNote(false);
    try {
      const payload: Record<string, unknown> = {
        module: moduleId,
        title: form.title.trim(),
        content: form.content,
        duration_seconds: secondsOf(form.minutes),
        is_preview: form.is_preview,
      };
      // New lessons take the next position on the server; only an edit moves a lesson.
      if (lesson) payload.order = Math.max(0, Math.floor(Number(form.order) || 0));
      const saved = await api.request<ManagedLesson>(lesson ? `/lessons/${lesson.id}/` : '/lessons/', {
        method: lesson ? 'PATCH' : 'POST', body: JSON.stringify(payload),
      });
      setBaseline(JSON.stringify(form));
      onSaved(saved, 'details');
    } catch (err) {
      setError(failureMessage(err));
    } finally {
      setBusy(false); busyRef.current?.(false);
    }
  }

  async function upload(file: File) {
    if (!lesson || busy) return;
    setVideoNote(true);
    if (!VIDEO_TYPES.includes(file.type)) {
      setError('Select an MP4, WebM or MOV video. Some phones label recordings differently; export the clip as MP4 and try again.');
      return;
    }
    setBusy(true); busyRef.current?.(true);
    setError(''); setStalled(false); setSnapshot(null); setLastFile(file);
    let current: UploadStage = 'link';
    setStage(current);
    const startedAt = Date.now();
    try {
      const ticket = await api.request<{ upload_url: string; key: string; headers: Record<string, string> }>(
        `/lessons/${lesson.id}/video-upload-url/`,
        { method: 'POST', body: JSON.stringify({ content_type: file.type }) },
      );
      const target = webUrl(ticket.upload_url);
      if (!target) throw new Error('The academy returned an upload address this browser cannot use. Contact support.');

      current = 'sending'; setStage(current);
      const handle = putFileWithProgress(
        target, file, ticket.headers ?? { 'Content-Type': file.type },
        setSnapshot, () => setStalled(true),
      );
      cancelUpload.current = handle;
      try {
        await handle.promise;
      } finally {
        cancelUpload.current = null;
      }

      current = 'confirming'; setStage(current);
      const saved = await api.request<ManagedLesson>(`/lessons/${lesson.id}/attach-video/`, {
        method: 'POST', body: JSON.stringify({ key: ticket.key }),
      });
      setStage(null);
      onSaved(saved, 'video');
    } catch (err) {
      setStage(null);
      const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      const position = UPLOAD_STEPS.findIndex((item) => item.stage === current) + 1;
      setError(
        `Stopped after ${seconds}s at step ${position} of 3, "${UPLOAD_STEPS[position - 1].label}". ` +
        uploadExplanation(err, current),
      );
    } finally {
      setBusy(false); busyRef.current?.(false);
    }
  }

  async function preview() {
    if (!lesson || busy) return;
    setBusy(true); busyRef.current?.(true);
    setError(''); setVideoNote(true);
    try {
      const result = await api.request<{ playback_url: string; source: string }>(`/lessons/${lesson.id}/play/`);
      const url = webUrl(result.playback_url);
      if (!url) throw new Error('The playback address is not a supported secure address.');
      setExternal(result.source === 'external');
      setPlayback(url);
    } catch (err) {
      setError(failureMessage(err));
    } finally {
      setBusy(false); busyRef.current?.(false);
    }
  }

  const hasVideo = Boolean(lesson?.video_key || lesson?.video_url);
  const activeStep = stage ? UPLOAD_STEPS.findIndex((item) => item.stage === stage) : -1;
  const uploadPercent = stage === 'confirming' ? 100 : stage === 'sending' ? snapshot?.percent ?? 0 : 0;

  return (
    <>
      <form id={formId} className={formClass} onSubmit={(event) => void save(event)} aria-busy={busy}>
        {error && !videoNote && <StatusNote tone="error">{error}</StatusNote>}
        <Field label="Lesson title" required>
          <TextInput
            autoFocus
            required
            maxLength={200}
            value={form.title}
            onChange={(event) => set('title', event.target.value)}
          />
        </Field>
        <FormGrid>
          <Field label="Duration (minutes)" optional hint="An estimate shown to learners, rounded to the nearest second.">
            <TextInput
              type="number" min="0" step="any" inputMode="decimal"
              value={form.minutes} onChange={(event) => set('minutes', event.target.value)}
            />
          </Field>
          {lesson && (
            <Field label="Order in the module" hint={`Starts at 0. This lesson is currently number ${lesson.order + 1}.`}>
              <TextInput
                type="number" min="0" step="1" inputMode="numeric"
                value={form.order} onChange={(event) => set('order', Number(event.target.value))}
              />
            </Field>
          )}
        </FormGrid>
        <Field label="Lesson text" optional hint="Learners read this below the video, so it also works as a transcript or exercise.">
          <textarea className={controlClass} rows={6} value={form.content} onChange={(event) => set('content', event.target.value)} />
        </Field>
        <CheckRow
          label="Allow a free preview"
          hint="Visitors can watch this lesson before enrolling while the course is published."
          checked={form.is_preview}
          onChange={(event) => set('is_preview', event.target.checked)}
        />
      </form>

      {lesson && (
        <FormGroup title="Private video">
          <StatusNote tone={hasVideo ? 'ok' : 'info'}>
            {hasVideo
              ? 'A video is attached. Playback is limited to learners with course access.'
              : 'No video attached yet. Upload the recording here; it is stored privately and never listed publicly.'}
          </StatusNote>
          {error && videoNote && <StatusNote tone="error">{error}</StatusNote>}
          {stage && (
            <div className={adminStyles.uploadProgress} role="group" aria-label="Video upload progress">
              <ol className={adminStyles.uploadSteps}>
                {UPLOAD_STEPS.map((step, index) => {
                  const state = index < activeStep ? 'done' : index === activeStep ? 'active' : 'waiting';
                  return (
                    <li
                      key={step.stage}
                      className={cn(
                        adminStyles.uploadStep,
                        state === 'active' && adminStyles['uploadStep--active'],
                        state === 'done' && adminStyles['uploadStep--done'],
                      )}
                    >
                      <span className={adminStyles.uploadStepNumber} aria-hidden="true">{index + 1}</span>
                      <span>{step.label}</span>
                      <span className={adminStyles.uploadStepState}>
                        {state === 'done' ? 'Done' : state === 'active' ? 'In progress' : 'Waiting'}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <div
                className={adminStyles.uploadTrack}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={uploadPercent}
                aria-label="Video bytes sent"
              >
                <span className={adminStyles.uploadFill} style={{ width: `${uploadPercent}%` }} />
              </div>
              <p className={adminStyles.uploadMeta} aria-live="polite">
                <strong>{uploadPercent}%</strong>
                {stage === 'link' && 'Checking with the academy. This request is small and should take a second.'}
                {stage === 'sending' && snapshot && (
                  <>
                    <span>{formatBytes(snapshot.loaded)} of {formatBytes(snapshot.total)} sent</span>
                    {snapshot.bytesPerSecond > 0 && <span>{formatBytes(snapshot.bytesPerSecond)}/s</span>}
                    {snapshot.secondsLeft !== null && <span>{formatSeconds(snapshot.secondsLeft)} left</span>}
                  </>
                )}
                {stage === 'sending' && !snapshot && 'Opening the connection to storage.'}
                {stage === 'confirming' && 'The file has arrived. Saving it to this lesson now.'}
              </p>
              {stalled && stage === 'sending' && (
                <StatusNote tone="info">
                  No bytes have moved for 20 seconds. The connection may have paused; keep this panel open and the
                  upload resumes if the network recovers.
                </StatusNote>
              )}
              {stage === 'sending' && (
                <div className={adminStyles.actions}>
                  <Action onClick={() => cancelUpload.current?.abort()}>Cancel upload</Action>
                </div>
              )}
            </div>
          )}
          <Field
            label="Upload a lesson video"
            hint="MP4, WebM or MOV, sent straight to the private bucket. The bar reports the real bytes sent, so you can see what the connection is doing."
          >
            <div className={adminStyles.dropzone}>
              <input
                type="file"
                accept={VIDEO_TYPES.join(',')}
                disabled={busy}
                aria-label="Upload a lesson video"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void upload(file);
                }}
              />
            </div>
          </Field>
          <div className={adminStyles.actions}>
            <Action disabled={busy || !hasVideo} onClick={() => void preview()}>Preview lesson video</Action>
            {!stage && error && lastFile && (
              <Action disabled={busy} onClick={() => void upload(lastFile)}>Try this upload again</Action>
            )}
            {playback && <Action disabled={busy} onClick={() => { setPlayback(''); setExternal(false); }}>Close preview</Action>}
          </div>
          {playback && (external
            ? <LinkAction href={playback} external>Open the external video in a new tab</LinkAction>
            : <video controls src={playback} className={adminStyles.mediaPreview} aria-label={`Video preview for ${lesson.title}`} />)}
        </FormGroup>
      )}
    </>
  );
}
