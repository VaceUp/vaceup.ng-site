'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { failureMessage, managementList, managedCourses, type ManagedCourse } from '@/lib/course-management';
import { NativeDialog } from '@/components/ui/Modal';
import { Action, Field, Feedback, ConfirmDelete, styles } from './AuthoringUI';

interface Campaign {
  id: number; name: string; subject: string; custom_text: string; from_name: string; reply_to: string;
  audience_filter: string; target_courses: number[]; exclude_purchased: boolean; status: string;
  total_recipients: number; sent_count: number; failed_count: number; scheduled_at: string | null;
}
const audiences = [
  ['all_users', 'All active accounts'], ['never_purchased', 'Accounts without a successful payment'],
  ['never_enrolled', 'Accounts without an active or completed enrolment'], ['free_only', 'Free-course learners only'],
  ['paid_only', 'Paid-course learners'], ['specific_courses', 'Learners in selected courses'],
  ['inactive_users', 'Inactive for at least 30 days'], ['new_users', 'Registered in the last 7 days'],
];
const endpoint = (id: number) => `/marketing/campaigns/${id}/`;

function DeliveryReport({ campaign }: { campaign: Campaign }) {
  const [rows, setRows] = useState<{ id: number; email: string; status: string; failure_reason: string }[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const load = async () => { setLoading(true); setError(''); try { setRows(await managementList(`${endpoint(campaign.id)}recipients/`)); } catch (err) { setError(failureMessage(err)); } finally { setLoading(false); } };
  return <details onToggle={(event) => { if (event.currentTarget.open) void load(); }}><summary>Recipient delivery report</summary><div className={styles.stack}><div><Action loading={loading} onClick={() => void load()}>Refresh recipient report</Action></div><Feedback error={error} /><ul className={styles.list}>{rows.map((row) => <li key={row.id}><p>{row.email} - {row.status}</p>{row.failure_reason && <p className={styles.muted}>{row.failure_reason}</p>}</li>)}</ul>{!loading && !rows.length && <p>No recipient records yet. Drafts do not create a delivery list.</p>}</div></details>;
}

function CampaignForm({ campaign, onSaved, onCancel }: { campaign?: Campaign; onSaved: () => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState({ name: campaign?.name ?? '', subject: campaign?.subject ?? '', custom_text: campaign?.custom_text ?? '',
    from_name: campaign?.from_name ?? 'VaceUp Team', reply_to: campaign?.reply_to ?? '', audience_filter: campaign?.audience_filter ?? 'never_purchased',
    target_courses: campaign?.target_courses ?? [], exclude_purchased: campaign?.exclude_purchased ?? false });
  const [courses, setCourses] = useState<ManagedCourse[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { managedCourses().then(setCourses).catch((err) => setError(failureMessage(err))); }, []);
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { await api.request(campaign ? endpoint(campaign.id) : '/marketing/campaigns/', { method: campaign ? 'PATCH' : 'POST', body: JSON.stringify({ ...form, target_courses: form.audience_filter === 'specific_courses' ? form.target_courses : [] }) }); await onSaved(); }
    catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  };
  return <form className={`${styles.panel} ${styles.stack}`} onSubmit={save} aria-label={campaign ? 'Edit campaign' : 'New campaign'}>
    <h3>{campaign ? 'Edit draft' : 'New campaign'}</h3><p className={styles.muted}>Save a draft first. Nothing is sent until you review the audience and confirm delivery.</p>
    <fieldset disabled={busy} className={styles.stack}><div className={styles.grid}>
      <Field label="Campaign name (internal)"><input required maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Email subject"><input required maxLength={200} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
      <Field label="Sender display name"><input required maxLength={100} value={form.from_name} onChange={(e) => setForm({ ...form, from_name: e.target.value })} /></Field>
      <Field label="Reply-to email (optional)"><input type="email" value={form.reply_to} onChange={(e) => setForm({ ...form, reply_to: e.target.value })} /></Field>
    </div><Field label="Message"><textarea required rows={9} value={form.custom_text} onChange={(e) => setForm({ ...form, custom_text: e.target.value })} /></Field>
    <p className={styles.muted}>Plain text; write complete links. An unsubscribe link is added automatically. Your server controls the sending address.</p>
    <Field label="Audience"><select value={form.audience_filter} onChange={(e) => setForm({ ...form, audience_filter: e.target.value })}>{audiences.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
    {form.audience_filter === 'specific_courses' && <fieldset className={styles.stack}><legend>Select courses</legend>{courses.length === 0 && <p>No courses available. Create a course or refresh this page.</p>}{courses.map((course) => <label key={course.id} className={styles.check}><input type="checkbox" checked={form.target_courses.includes(course.id)} onChange={(e) => setForm({ ...form, target_courses: e.target.checked ? [...form.target_courses, course.id] : form.target_courses.filter((id) => id !== course.id) })} />{course.title}</label>)}</fieldset>}
    <label className={styles.check}><input type="checkbox" checked={form.exclude_purchased} onChange={(e) => setForm({ ...form, exclude_purchased: e.target.checked })} />Exclude accounts with any successful payment</label>
    <p className={styles.muted}>Opted-out, suppressed and disabled accounts are always excluded. Only registered accounts are supported; newsletter leads are not included.</p></fieldset>
    <Feedback error={error} /><div className={styles.row}><Action type="submit" intent="primary" loading={busy}>Save draft</Action><Action disabled={busy} onClick={onCancel}>Cancel editing</Action></div>
  </form>;
}

function DeliveryReview({ campaign, onClose, onQueued }: { campaign: Campaign; onClose: () => void; onQueued: () => Promise<void> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [audience, setAudience] = useState<{ count: number; confirmation: string } | null>(null), [date, setDate] = useState(''), [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null; ref.current?.showModal();
    api.request<{ count: number; confirmation: string }>(`${endpoint(campaign.id)}audience/`, { cache: 'no-store' }).then(setAudience).catch((err) => setError(failureMessage(err))).finally(() => setLoading(false));
    return () => { ref.current?.close(); if (trigger?.isConnected) trigger.focus(); };
  }, [campaign.id]);
  const queue = async (event: FormEvent) => {
    event.preventDefault(); if (busy || !audience || !confirm) return; setBusy(true); setError('');
    try { await api.request(`${endpoint(campaign.id)}${date ? 'schedule' : 'send-now'}/`, { method: 'POST', body: JSON.stringify({ confirmation: audience.confirmation, ...(date ? { scheduled_at: new Date(date).toISOString() } : {}) }) }); await onQueued(); }
    catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  };
  return <NativeDialog ref={ref} className={`${styles.panel} ${styles.dialog}`} aria-labelledby="campaign-review-title" onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }}>
    <form onSubmit={queue} className={styles.stack}><h2 id="campaign-review-title">Review campaign delivery</h2><h3>{campaign.subject}</h3><p className={styles.preview}>{campaign.custom_text}</p>
      <p role="status">{loading ? 'Checking eligible recipients...' : audience ? `${audience.count} eligible recipients` : 'Audience could not be checked.'}</p>
      <Field label="Schedule (your local time; leave blank for next cron run)"><input type="datetime-local" value={date} disabled={busy} onChange={(e) => setDate(e.target.value)} /></Field>
      <label className={styles.check}><input type="checkbox" checked={confirm} disabled={busy} onChange={(e) => setConfirm(e.target.checked)} />I reviewed the content and audience and have permission to send this marketing email.</label>
      <p className={styles.muted}>Delivery requires the marketing cron job and enabled Platform Settings. Pause or cancel cannot recall an email already being sent.</p>
      <Feedback error={error} /><div className={styles.row}><Action disabled={busy} onClick={onClose} autoFocus>Back to campaigns</Action><Action type="submit" intent="primary" loading={busy} disabled={!confirm || !audience?.count}>{date ? 'Confirm schedule' : 'Confirm and queue'}</Action></div>
    </form>
  </NativeDialog>;
}

export default function MarketingManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]), [editing, setEditing] = useState<Campaign | 'new' | null>(null), [review, setReview] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState<Campaign | null>(null), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [cancelling, setCancelling] = useState<Campaign | null>(null);
  const load = useCallback(async () => { setLoading(true); try { setCampaigns(await managementList('/marketing/campaigns/')); } catch (err) { setError(failureMessage(err)); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (editing || review || busy) return;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30000);
    return () => window.clearInterval(timer);
  }, [load, editing, review, busy]);
  const action = async (campaign: Campaign, operation: string) => {
    if (busy) return; setBusy(true); setError(''); setMessage('');
    try { const result = await api.request<{ detail?: string }>(`${endpoint(campaign.id)}${operation}/`, { method: 'POST', body: '{}' }); setMessage(result?.detail ?? `Campaign ${operation === 'cancel' ? 'cancelled' : operation === 'pause' ? 'paused' : 'resumed'}. A message already in progress may still complete.`); await load(); return true; }
    catch (err) { setError(failureMessage(err)); return false; } finally { setBusy(false); }
  };
  return <section className={`${styles.root} ${styles.stack}`} aria-label="Marketing campaigns">
    <header className={styles.heading}><h2>Marketing campaigns</h2><p className={styles.muted}>Create a draft, review who receives it, then send or schedule. Sent counts mean SMTP accepted the email, not confirmed inbox delivery.</p><div className={styles.row}><Action intent="primary" disabled={busy || !!editing} onClick={() => setEditing('new')}>New campaign</Action><Action loading={loading} onClick={() => { setError(''); void load(); }}>Refresh campaigns</Action></div></header>
    <Feedback error={error} message={message} />
    {editing && <CampaignForm key={editing === 'new' ? 'new' : editing.id} campaign={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)} onSaved={async () => { setEditing(null); setMessage('Draft saved. Nothing has been sent.'); await load(); }} />}
    {!loading && !campaigns.length && <div className={styles.empty}><h3>Your first campaign starts here</h3><p>Create a draft with a subject, message and audience. Saving does not send email.</p></div>}
    <ul className={styles.list}>{campaigns.map((campaign) => <li key={campaign.id} className={`${styles.panel} ${styles.stack}`}><div className={styles.heading}><h3>{campaign.name}</h3><p>{campaign.subject}</p><p className={styles.muted}>Status: {campaign.status} · Recipients: {campaign.total_recipients} · SMTP accepted: {campaign.sent_count} · Failed: {campaign.failed_count}</p>{campaign.scheduled_at && <p className={styles.muted}>Scheduled: {new Date(campaign.scheduled_at).toLocaleString()}</p>}</div><div className={styles.row}>
      {campaign.status === 'draft' && <><Action disabled={busy || !!editing} onClick={() => setEditing(campaign)}>Edit draft</Action><Action disabled={busy} onClick={() => void action(campaign, 'preview')}>Send test to my email</Action><Action intent="primary" disabled={busy} onClick={() => setReview(campaign)}>Review and send</Action><Action intent="danger" disabled={busy} onClick={() => { setError(''); setDeleting(campaign); }}>Delete draft</Action></>}
      {['scheduled', 'sending'].includes(campaign.status) && <Action disabled={busy} onClick={() => void action(campaign, 'pause')}>Pause campaign</Action>}
      {campaign.status === 'paused' && <Action disabled={busy} onClick={() => void action(campaign, 'resume')}>Resume campaign</Action>}
      {['scheduled', 'sending', 'paused'].includes(campaign.status) && <Action intent="danger" disabled={busy} onClick={() => setCancelling(campaign)}>Cancel delivery</Action>}
    </div>{campaign.status !== 'draft' && <DeliveryReport campaign={campaign} />}</li>)}</ul>
    {cancelling && <ConfirmDelete title="Cancel campaign delivery" description={`Stop future messages for ${cancelling.name}? A message already being sent may complete. This campaign cannot be resumed after cancellation.`} busy={busy} error={error} onCancel={() => setCancelling(null)} onConfirm={async () => { if (await action(cancelling, 'cancel')) setCancelling(null); }} />}
    {review && <DeliveryReview campaign={review} onClose={() => setReview(null)} onQueued={async () => { setReview(null); setMessage('Campaign queued. The marketing cron job will process it at the scheduled time.'); await load(); }} />}
    {deleting && <ConfirmDelete title="Delete campaign draft" description={`Delete “${deleting.name}”? This cannot be undone.`} busy={busy} error={error} onCancel={() => setDeleting(null)} onConfirm={async () => { setBusy(true); setError(''); try { await api.request(endpoint(deleting.id), { method: 'DELETE' }); setDeleting(null); setMessage('Draft deleted.'); await load(); } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); } }} />}
  </section>;
}
