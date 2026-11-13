'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { failureMessage, managementList, managedCourses, type ManagedCourse } from '@/lib/course-management';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { formatWorkspaceDate } from '@/lib/workspace-api';
import { ConfirmDelete } from './AuthoringUI';
import {
  Action, AdminList, AdminRow, AdminSection, CheckRow, Drawer, EmptyState, Field, FormGrid,
  Pager, Pill, Skeleton, StatusNote, TextInput, Toolbar, adminStyles, controlClass, formClass, useToast,
} from './AdminUI';

interface Campaign {
  id: number; name: string; subject: string; custom_text: string; from_name: string; reply_to: string;
  audience_filter: string; target_courses: number[]; exclude_purchased: boolean; status: string;
  total_recipients: number; sent_count: number; failed_count: number; scheduled_at: string | null;
}

interface Recipient { id: number; email: string; status: string; failure_reason: string; }
interface RecipientPage { count: number; next: string | null; results: Recipient[]; }

const audiences = [
  ['all_users', 'All active accounts'], ['never_purchased', 'Accounts without a successful payment'],
  ['never_enrolled', 'Accounts without an active or completed enrolment'], ['free_only', 'Free-course learners only'],
  ['paid_only', 'Paid-course learners'], ['specific_courses', 'Learners in selected courses'],
  ['inactive_users', 'Inactive for at least 30 days'], ['new_users', 'Registered in the last 7 days'],
];

const audienceLabel = (value: string) => audiences.find(([key]) => key === value)?.[1] ?? value;

const STATUS_TONE: Record<string, 'neutral' | 'live' | 'draft' | 'danger' | 'muted'> = {
  draft: 'draft', scheduled: 'draft', sending: 'live', sent: 'live', paused: 'draft', failed: 'danger', cancelled: 'muted',
};

const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);
const endpoint = (id: number) => `/marketing/campaigns/${id}/`;

function EmailPreview({ subject, text }: { subject: string; text: string }) {
  const [html, setHtml] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const preview = async () => {
    setBusy(true); setError('');
    try {
      const result = await api.request<{ html: string }>('/marketing/campaigns/render-preview/', {
        method: 'POST', body: JSON.stringify({ subject, custom_text: text }),
      });
      setHtml(result.html);
    } catch (failure) { setError(failureMessage(failure)); }
    finally { setBusy(false); }
  };
  return <div className={adminStyles.stack}>
    <div><Action loading={busy} disabled={!subject.trim() || !text.trim()} onClick={() => void preview()}>{html ? 'Refresh email preview' : 'Preview email design'}</Action></div>
    {error && <StatusNote tone="error">{error}</StatusNote>}
    {html && <iframe className={adminStyles.emailFrame} title="Email design preview" sandbox="" srcDoc={html} />}
  </div>;
}

function DeliveryReport({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const resource = useWorkspaceResource<RecipientPage>(
    `${endpoint(campaign.id)}recipients/?page=${page}${filter ? `&status=${filter}` : ''}`,
  );
  const rows = resource.data?.results ?? [];
  return <Drawer
    open
    title={`Delivery report: ${campaign.name}`}
    description={`${campaign.sent_count} accepted by SMTP, ${campaign.failed_count} failed, ${campaign.total_recipients} recipients in total. Accepted means the mail server took the message; inbox placement is not tracked.`}
    onClose={onClose}
    footer={<Action disabled={resource.loading} onClick={onClose}>Close report</Action>}
  >
    <Toolbar label="Recipient report controls">
      <Field label="Show">
        <select className={controlClass} value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}>
          <option value="">All recipients</option>
          <option value="sent">Accepted by SMTP</option>
          <option value="failed">Failed</option>
          <option value="pending">Not processed yet</option>
          <option value="skipped">Skipped</option>
        </select>
      </Field>
      <Action loading={resource.loading} onClick={resource.refresh}>Refresh report</Action>
    </Toolbar>
    {resource.error && <StatusNote tone="error">{resource.error}</StatusNote>}
    {resource.loading && !resource.data && <Skeleton rows={3} />}
    {resource.data && (rows.length
      ? <AdminList label="Campaign recipients">
        {rows.map((row) => <AdminRow
          key={row.id}
          placeholder="bi-envelope"
          round
          title={row.email}
          badges={<Pill tone={row.status === 'failed' ? 'danger' : row.status === 'sent' ? 'live' : 'muted'}>{statusLabel(row.status)}</Pill>}
          meta={row.failure_reason ? <span>{row.failure_reason}</span> : <span>No delivery error recorded.</span>}
        />)}
      </AdminList>
      : <EmptyState
        icon="bi-envelope-open"
        title={filter ? 'No recipients in this view' : 'No recipient records yet'}
        description={filter
          ? 'Nobody in this campaign matches the selected status. Switch back to All recipients.'
          : 'Recipients appear once the campaign is queued. Drafts never create a delivery list.'}
        action={filter ? <Action onClick={() => { setFilter(''); setPage(1); }}>Show all recipients</Action> : undefined}
      />)}
    {resource.data && <Pager
      label="Campaign recipients"
      page={page}
      count={resource.data.count}
      hasNext={!!resource.data.next}
      busy={resource.loading}
      onPrev={() => setPage((current) => Math.max(1, current - 1))}
      onNext={() => setPage((current) => current + 1)}
    />}
  </Drawer>;
}

function CampaignForm({ campaign, saving, onSaving, onSaved }: {
  campaign?: Campaign; saving: boolean; onSaving: (saving: boolean) => void; onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: campaign?.name ?? '', subject: campaign?.subject ?? '', custom_text: campaign?.custom_text ?? '',
    from_name: campaign?.from_name ?? 'VaceUp Team', reply_to: campaign?.reply_to ?? '',
    audience_filter: campaign?.audience_filter ?? 'never_purchased',
    target_courses: campaign?.target_courses ?? [], exclude_purchased: campaign?.exclude_purchased ?? false,
  });
  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [coursesError, setCoursesError] = useState('');
  const [error, setError] = useState('');

  const loadCourses = useCallback(async () => {
    setCoursesError('');
    try { setCourses(await managedCourses()); } catch (err) { setCoursesError(failureMessage(err)); }
  }, []);
  useEffect(() => { void loadCourses(); }, [loadCourses]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (form.audience_filter === 'specific_courses' && form.target_courses.length === 0) {
      setError('Choose at least one course for this audience, or pick a different audience.');
      return;
    }
    setError('');
    onSaving(true);
    try {
      await api.request(campaign ? endpoint(campaign.id) : '/marketing/campaigns/', {
        method: campaign ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...form,
          target_courses: form.audience_filter === 'specific_courses' ? form.target_courses : [],
        }),
      });
      await onSaved();
    } catch (err) { setError(failureMessage(err)); } finally { onSaving(false); }
  };

  return <form id="campaign-form" className={formClass} onSubmit={(event) => void save(event)} aria-label={campaign ? 'Edit campaign' : 'New campaign'}>
    {error && <StatusNote tone="error">{error}</StatusNote>}
    <fieldset disabled={saving} className={adminStyles.group}>
      <FormGrid>
        <Field label="Campaign name" required hint="Only your team sees this.">
          <TextInput required maxLength={200} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </Field>
        <Field label="Email subject" required>
          <TextInput required maxLength={200} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
        </Field>
        <Field label="Sender display name" required>
          <TextInput required maxLength={100} value={form.from_name} onChange={(event) => setForm({ ...form, from_name: event.target.value })} />
        </Field>
        <Field label="Reply-to email" optional hint="Replies go to this inbox instead of the sending address.">
          <TextInput type="email" value={form.reply_to} onChange={(event) => setForm({ ...form, reply_to: event.target.value })} />
        </Field>
      </FormGrid>
      <Field
        label="Message"
        required
        hint="Separate paragraphs with a blank line. Use # for headings and - for lists. Links and unsubscribe details are formatted automatically."
      >
        <textarea className={controlClass} required rows={9} value={form.custom_text} onChange={(event) => setForm({ ...form, custom_text: event.target.value })} />
      </Field>
      <EmailPreview subject={form.subject} text={form.custom_text} />
      <Field
        label="Audience"
        hint="Opted-out, suppressed and disabled accounts are always excluded. Only registered accounts are supported; newsletter leads are not included."
      >
        <select className={controlClass} value={form.audience_filter} onChange={(event) => setForm({ ...form, audience_filter: event.target.value })}>
          {audiences.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      {form.audience_filter === 'specific_courses' && <fieldset className={adminStyles.group}>
        <legend className={adminStyles.groupLabel}>Which courses?</legend>
        {coursesError && <StatusNote tone="error">
          The course list could not be loaded. <Action className={adminStyles.inlineActions} onClick={() => void loadCourses()}>Try again</Action>
        </StatusNote>}
        {!coursesError && courses.length === 0 && <p className={adminStyles.hint}>No courses are available yet. Create a course before targeting one here.</p>}
        {courses.length > 0 && <div className={adminStyles.checkList}>
          {courses.map((course) => <CheckRow
            key={course.id}
            label={course.title}
            checked={form.target_courses.includes(course.id)}
            onChange={(event) => setForm({
              ...form,
              target_courses: event.target.checked
                ? [...form.target_courses, course.id]
                : form.target_courses.filter((id) => id !== course.id),
            })}
          />)}
        </div>}
      </fieldset>}
      <CheckRow
        label="Exclude accounts with any successful payment"
        hint="Useful for offers aimed at people who have not bought yet."
        checked={form.exclude_purchased}
        onChange={(event) => setForm({ ...form, exclude_purchased: event.target.checked })}
      />
    </fieldset>
  </form>;
}

function DeliveryReview({ campaign, onClose, onQueued }: { campaign: Campaign; onClose: () => void; onQueued: () => Promise<void> }) {
  const [audience, setAudience] = useState<{ count: number; confirmation: string } | null>(null);
  const [date, setDate] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api.request<{ count: number; confirmation: string }>(`${endpoint(campaign.id)}audience/`, { cache: 'no-store' })
      .then((result) => { if (active) setAudience(result); })
      .catch((err) => { if (active) setError(failureMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [campaign.id]);
  const queue = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !audience || !confirm) return;
    setBusy(true); setError('');
    try {
      await api.request(`${endpoint(campaign.id)}${date ? 'schedule' : 'send-now'}/`, {
        method: 'POST',
        body: JSON.stringify({ confirmation: audience.confirmation, ...(date ? { scheduled_at: new Date(date).toISOString() } : {}) }),
      });
      await onQueued();
    } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  };
  return <Drawer
    open
    title="Review and send"
    description="Nothing leaves until you confirm. Check the copy and the audience first."
    onClose={() => { if (!busy) onClose(); }}
    footer={<>
      <Action disabled={busy} onClick={onClose}>Back to campaigns</Action>
      <Action
        type="submit"
        form="campaign-review"
        intent="primary"
        loading={busy}
        disabled={!confirm || !audience?.count}
      >{date ? 'Confirm schedule' : 'Confirm and queue'}</Action>
    </>}
  >
    <form id="campaign-review" className={formClass} onSubmit={(event) => void queue(event)}>
      <div className={adminStyles.stack}>
        <p className={adminStyles.factLabel}>Subject</p>
        <p className={adminStyles.rowTitle}>{campaign.subject}</p>
        <p className={adminStyles.factLabel}>Message</p>
        <div className={adminStyles.preview}>{campaign.custom_text}</div>
        <EmailPreview subject={campaign.subject} text={campaign.custom_text} />
      </div>
      <div className={adminStyles.readout} role="status" aria-live="polite">
        <div>
          <p className={adminStyles.factLabel}>Eligible recipients</p>
          <p className={adminStyles.readoutValue}>{loading ? 'Checking...' : audience ? audience.count.toLocaleString() : 'Not available'}</p>
        </div>
        <p className={adminStyles.hint}>Opt-outs, suppressed addresses and disabled accounts are already excluded.</p>
      </div>
      {!loading && audience?.count === 0 && <StatusNote tone="error">
        Nobody is eligible for this audience right now. Adjust the audience or the exclusions, save the draft, then review again.
      </StatusNote>}
      <CheckRow
        label="I reviewed the content and audience and have permission to send this marketing email."
        checked={confirm}
        disabled={busy}
        onChange={(event) => setConfirm(event.target.checked)}
      />
      <Field
        label="Schedule"
        optional
        hint="Your local time. Leave it blank to queue the campaign now for the next marketing cron run."
      >
        <TextInput type="datetime-local" value={date} disabled={busy} onChange={(event) => setDate(event.target.value)} />
      </Field>
      <p className={adminStyles.hint}>Sending needs an enabled marketing cron job and the Platform Settings toggle. Pausing or cancelling cannot recall a message already being handed to the mail server.</p>
      {error && <StatusNote tone="error">{error}</StatusNote>}
    </form>
  </Drawer>;
}

export default function MarketingManager() {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [editing, setEditing] = useState<Campaign | 'new' | null>(null);
  const [review, setReview] = useState<Campaign | null>(null);
  const [report, setReport] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState<Campaign | null>(null);
  const [cancelling, setCancelling] = useState<Campaign | null>(null);
  const [filter, setFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setCampaigns(await managementList('/marketing/campaigns/')); setError(''); }
    catch (err) { setError(failureMessage(err)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (editing || review || report || deleting || cancelling || saving || busy) return;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30000);
    return () => window.clearInterval(timer);
  }, [load, editing, review, report, deleting, cancelling, saving, busy]);

  const rows = useMemo(() => campaigns.filter((campaign) => {
    if (filter === 'draft') return campaign.status === 'draft';
    if (filter === 'active') return ['scheduled', 'sending', 'paused'].includes(campaign.status);
    if (filter === 'finished') return ['sent', 'cancelled', 'failed'].includes(campaign.status);
    return true;
  }), [campaigns, filter]);

  const closeForm = () => { if (!saving) setEditing(null); };

  const act = async (campaign: Campaign, operation: 'preview' | 'pause' | 'resume') => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await api.request<{ detail?: string }>(`${endpoint(campaign.id)}${operation}/`, { method: 'POST', body: '{}' });
      const message = operation === 'preview'
        ? result?.detail ?? 'SMTP accepted a test message for your admin email. Check your inbox and spam folder.'
        : operation === 'pause'
          ? `“${campaign.name}” is paused. A message already being sent may still finish.`
          : `“${campaign.name}” resumed. The cron job continues from where it stopped.`;
      toast.push(message, 'success');
      await load();
    } catch (err) { toast.push(failureMessage(err), 'error'); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true); setConfirmError('');
    try {
      await api.request(endpoint(deleting.id), { method: 'DELETE' });
      toast.push(`“${deleting.name}” was deleted.`, 'success');
      setDeleting(null);
      await load();
    } catch (err) { setConfirmError(failureMessage(err)); } finally { setBusy(false); }
  };

  const cancelDelivery = async () => {
    if (!cancelling) return;
    setBusy(true); setConfirmError('');
    try {
      await api.request(`${endpoint(cancelling.id)}cancel/`, { method: 'POST', body: '{}' });
      toast.push(`“${cancelling.name}” was cancelled and will not send another message.`, 'success');
      setCancelling(null);
      await load();
    } catch (err) { setConfirmError(failureMessage(err)); } finally { setBusy(false); }
  };

  return <>
    <AdminSection
      title="Marketing campaigns"
      description="Write a draft, check exactly who receives it, then send now or schedule. SMTP accepted means the mail server took the message; it is not proof it reached an inbox."
      actions={<Action intent="primary" disabled={busy || !!editing} onClick={() => setEditing('new')}>New campaign</Action>}
    >
      <Toolbar label="Campaign list controls">
        <Field label="Show">
          <select className={controlClass} value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All campaigns</option>
            <option value="draft">Drafts</option>
            <option value="active">Scheduled, sending or paused</option>
            <option value="finished">Sent, cancelled or failed</option>
          </select>
        </Field>
        <Action loading={loading} onClick={() => void load()}>Refresh campaigns</Action>
      </Toolbar>
      {error && <StatusNote tone="error">{error}</StatusNote>}
      {error && campaigns.length > 0 && <p className={adminStyles.hint}>Showing the last campaigns we could load.</p>}
      {loading && !campaigns.length && <Skeleton rows={3} />}
      {!loading && !campaigns.length && <EmptyState
        icon="bi-envelope-paper"
        title="Your first campaign starts here"
        description="Create a draft with a subject, message and audience. Saving does not send anything; you review the recipient count before it queues."
        action={<Action intent="primary" onClick={() => setEditing('new')}>Create a campaign</Action>}
      />}
      {campaigns.length > 0 && (rows.length
        ? <AdminList label="Marketing campaigns">
          {rows.map((campaign) => <AdminRow
            key={campaign.id}
            placeholder="bi-megaphone"
            title={campaign.name}
            badges={<Pill tone={STATUS_TONE[campaign.status] ?? 'muted'}>{statusLabel(campaign.status)}</Pill>}
            meta={<>
              <span>{campaign.subject}</span>
              <span className="block">
                {audienceLabel(campaign.audience_filter)} · {campaign.total_recipients} recipients · {campaign.sent_count} accepted by SMTP
                {campaign.failed_count > 0 ? ` · ${campaign.failed_count} failed` : ''}
              </span>
              {campaign.scheduled_at && ['scheduled', 'sending', 'paused'].includes(campaign.status) && (
                <span className="block">Scheduled for {formatWorkspaceDate(campaign.scheduled_at, true)}</span>
              )}
            </>}
            actions={<>
              {campaign.status === 'draft' && <>
                <Action disabled={busy} onClick={() => setEditing(campaign)}>Edit draft</Action>
                <Action disabled={busy} onClick={() => void act(campaign, 'preview')}>Send test to my email</Action>
                <Action intent="primary" disabled={busy} onClick={() => setReview(campaign)}>Review and send</Action>
                <Action intent="danger" disabled={busy} onClick={() => { setConfirmError(''); setDeleting(campaign); }}>Delete</Action>
              </>}
              {['scheduled', 'sending'].includes(campaign.status) && <Action disabled={busy} onClick={() => void act(campaign, 'pause')}>Pause</Action>}
              {campaign.status === 'paused' && <Action disabled={busy} onClick={() => void act(campaign, 'resume')}>Resume</Action>}
              {['scheduled', 'sending', 'paused'].includes(campaign.status) && <Action intent="danger" disabled={busy} onClick={() => { setConfirmError(''); setCancelling(campaign); }}>Cancel delivery</Action>}
              {campaign.status !== 'draft' && <Action onClick={() => setReport(campaign)}>Delivery report</Action>}
            </>}
          />)}
        </AdminList>
        : <EmptyState
          icon="bi-funnel"
          title="No campaigns in this view"
          description="Nothing matches the selected status. Switch back to All campaigns to see the rest."
          action={<Action onClick={() => setFilter('all')}>Show all campaigns</Action>}
        />)}
    </AdminSection>

    <Drawer
      open={!!editing}
      title={editing === 'new' || !editing ? 'New campaign' : `Editing “${editing.name}”`}
      description="Save a draft first. Nothing is sent until you review the audience and confirm delivery."
      onClose={closeForm}
      footer={<>
        <Action disabled={saving} onClick={closeForm}>Cancel</Action>
        <Action type="submit" form="campaign-form" intent="primary" loading={saving}>Save draft</Action>
      </>}
    >
      {editing && <CampaignForm
        key={editing === 'new' ? 'new' : editing.id}
        campaign={editing === 'new' ? undefined : editing}
        saving={saving}
        onSaving={setSaving}
        onSaved={async () => {
          setEditing(null);
          toast.push('Draft saved. Nothing has been sent.', 'success');
          await load();
        }}
      />}
    </Drawer>

    {review && <DeliveryReview
      campaign={review}
      onClose={() => setReview(null)}
      onQueued={async () => {
        setReview(null);
        toast.push('Campaign queued. The marketing cron job takes it from here.', 'success');
        await load();
      }}
    />}

    {report && <DeliveryReport campaign={report} onClose={() => setReport(null)} />}

    {deleting && <ConfirmDelete
      title="Delete campaign draft"
      description={`Delete “${deleting.name}”? The draft and its message are removed for good. This cannot be undone.`}
      confirmationName={deleting.name}
      busy={busy}
      error={confirmError}
      onCancel={() => setDeleting(null)}
      onConfirm={() => void remove()}
    />}

    {cancelling && <ConfirmDelete
      title="Cancel campaign delivery"
      description={`Stop future messages for “${cancelling.name}”? A message already handed to the mail server may still arrive, and this campaign cannot be resumed after cancellation.`}
      busy={busy}
      error={confirmError}
      onCancel={() => setCancelling(null)}
      onConfirm={() => void cancelDelivery()}
    />}
  </>;
}
