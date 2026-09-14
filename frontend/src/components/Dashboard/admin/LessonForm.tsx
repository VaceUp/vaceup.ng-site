'use client';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { webUrl } from '@/lib/workspace-api';
import { failureMessage, type ManagedLesson } from '@/lib/course-management';
import { Action, Field, Feedback, styles } from './AuthoringUI';

export default function LessonForm({ lesson, moduleId, onSaved }: { lesson?: ManagedLesson; moduleId: number; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ title: lesson?.title || '', content: lesson?.content || '', video_url: lesson?.video_url || '', order: lesson?.order ?? 0, duration_seconds: lesson?.duration_seconds ?? 0, is_preview: lesson?.is_preview || false });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [playback, setPlayback] = useState('');
  const [externalPlayback, setExternalPlayback] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setMessage('');
    try {
      const payload: Record<string, unknown> = { ...form, module: moduleId };
      if (!lesson) delete payload.order;
      await api.request(lesson ? `/lessons/${lesson.id}/` : '/lessons/', { method: lesson ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      if (!lesson) setForm({ title: '', content: '', video_url: '', order: 0, duration_seconds: 0, is_preview: false });
      setMessage('Lesson saved.'); await onSaved();
    } catch (err) { setError(failureMessage(err)); }
    finally { setBusy(false); }
  }
  return <div className={styles.stack}>
    <form className={styles.stack} onSubmit={save} aria-label={lesson ? `Edit lesson ${lesson.title}` : 'Add lesson'}>
      <fieldset className={styles.stack} disabled={busy}>
        <div className={styles.grid}><Field label="Lesson title"><input required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
          <Field label="Duration (seconds)"><input type="number" min="0" required value={form.duration_seconds} onChange={(event) => setForm({ ...form, duration_seconds: Number(event.target.value) })} /></Field>
          {lesson && <Field label="Lesson order (starts at 0)"><input required type="number" min="0" value={form.order} onChange={(event) => setForm({ ...form, order: Number(event.target.value) })} /></Field>}
        </div>
        <Field label="Lesson text"><textarea rows={5} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></Field>
        <Field label="External video URL"><input type="url" value={form.video_url} onChange={(event) => setForm({ ...form, video_url: event.target.value })} /></Field>
        <label className={styles.check}><input type="checkbox" checked={form.is_preview} onChange={(event) => setForm({ ...form, is_preview: event.target.checked })} />Allow a free public preview when the course is published</label>
      </fieldset>
      <div><Action type="submit" intent="primary" loading={busy}>{lesson ? 'Save lesson' : 'Add lesson'}</Action></div>
    </form>
    {lesson && <>
      <Field label="Upload private video to R2"><input type="file" disabled={busy} accept="video/mp4,video/webm,video/quicktime" onChange={async (event) => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file || busy) return;
        setBusy(true); setError(''); setMessage('');
        try {
          if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)) throw new Error('Select an MP4, WebM or MOV video.');
          const ticket = await api.request<{ upload_url: string; key: string; headers: Record<string, string> }>(`/lessons/${lesson.id}/video-upload-url/`, { method: 'POST', body: JSON.stringify({ content_type: file.type }) });
          if (!webUrl(ticket.upload_url)) throw new Error('The video upload address is invalid. Contact support.');
          const uploaded = await fetch(ticket.upload_url, { method: 'PUT', body: file, headers: ticket.headers, credentials: 'omit' });
          if (!uploaded.ok) throw new Error('Video upload failed. Check the R2 upload/CORS configuration and try again.');
          await api.request(`/lessons/${lesson.id}/attach-video/`, { method: 'POST', body: JSON.stringify({ key: ticket.key }) });
          setMessage('Private video attached. Playback requires course access.'); await onSaved();
        } catch (err) { setError(failureMessage(err)); }
        finally { setBusy(false); }
      }} /></Field>
      <p className={styles.muted}>{lesson.video_key ? 'A private uploaded video is attached and takes priority over the external link.' : 'Save a video link or upload a file. R2 credentials and bucket CORS must be configured.'}</p>
      <div><Action disabled={busy} onClick={async () => { setBusy(true); setError(''); try { const result = await api.request<{ playback_url: string; source: string }>(`/lessons/${lesson.id}/play/`); const url = webUrl(result.playback_url); if (!url) throw new Error('Playback URL is not a supported secure address.'); setExternalPlayback(result.source === 'external'); setPlayback(url); } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); } }}>Preview lesson video</Action></div>
      {playback && (externalPlayback ? <a href={playback} target="_blank" rel="noopener noreferrer" className={styles.action}>Open external video in a new tab</a> : <video controls src={playback} className={styles.preview} aria-label={`Video preview for ${lesson.title}`} />)}
    </>}
    <Feedback error={error} message={message} />
  </div>;
}
