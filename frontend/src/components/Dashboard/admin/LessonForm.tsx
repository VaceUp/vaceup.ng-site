'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { webUrl } from '@/lib/workspace-api';
import { failureMessage, type ManagedLesson } from '@/lib/course-management';
import {
  Action, CheckRow, Field, FormGrid, FormGroup, LinkAction, StatusNote, TextInput,
  adminStyles, controlClass, formClass,
} from './AdminUI';

const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const minutesOf = (seconds: number) => (seconds ? String(Math.round((seconds / 60) * 100) / 100) : '0');
const secondsOf = (minutes: string) => Math.max(0, Math.round(Number(minutes || 0) * 60));

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
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
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
    setError(''); setMessage('');
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
    setBusy(true); busyRef.current?.(true);
    setError(''); setMessage('');
    try {
      if (!VIDEO_TYPES.includes(file.type)) throw new Error('Select an MP4, WebM or MOV video.');
      setUploading(true);
      const ticket = await api.request<{ upload_url: string; key: string; headers: Record<string, string> }>(
        `/lessons/${lesson.id}/video-upload-url/`,
        { method: 'POST', body: JSON.stringify({ content_type: file.type }) },
      );
      if (!webUrl(ticket.upload_url)) throw new Error('The video upload address is invalid. Contact support.');
      const uploaded = await fetch(ticket.upload_url, { method: 'PUT', body: file, headers: ticket.headers, credentials: 'omit' });
      if (!uploaded.ok) throw new Error('Video upload failed. Check the R2 upload/CORS configuration and try again.');
      const saved = await api.request<ManagedLesson>(`/lessons/${lesson.id}/attach-video/`, {
        method: 'POST', body: JSON.stringify({ key: ticket.key }),
      });
      setMessage('Private video attached. Only learners with course access can play it.');
      onSaved(saved, 'video');
    } catch (err) {
      setError(failureMessage(err));
    } finally {
      setUploading(false);
      setBusy(false); busyRef.current?.(false);
    }
  }

  async function preview() {
    if (!lesson || busy) return;
    setBusy(true); busyRef.current?.(true);
    setError('');
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

  return (
    <>
      <form id={formId} className={formClass} onSubmit={(event) => void save(event)} aria-busy={busy}>
        {error && <StatusNote tone="error">{error}</StatusNote>}
        {message && <StatusNote tone="ok">{message}</StatusNote>}
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
          {uploading && <StatusNote>Uploading the video. Keep this panel open until it finishes.</StatusNote>}
          <Field
            label="Upload a lesson video"
            hint="MP4, WebM or MOV. The file goes straight to R2; R2 credentials and bucket CORS must be configured."
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
