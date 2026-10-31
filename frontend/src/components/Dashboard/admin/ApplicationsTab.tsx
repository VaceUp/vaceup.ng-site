'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { formatWorkspaceDate } from '@/lib/workspace-api';
import {
  Action,
  AdminList,
  AdminRow,
  AdminSection,
  Drawer,
  EmptyState,
  Field,
  Pill,
  Skeleton,
  StatusNote,
  TextInput,
  Toolbar,
  adminStyles,
  controlClass,
  formClass,
  useToast,
} from './AdminUI';

/**
 * Course applications: read the full submission, then approve or reject with a
 * reason the applicant record keeps.
 */

interface Application {
  id: number;
  student: number;
  student_name: string;
  student_email: string;
  course: number;
  course_title: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'withdrawn';
  motivation: string;
  full_name: string;
  phone: string;
  country: string;
  city: string;
  education: string;
  current_role: string;
  experience: string;
  linkedin_url: string;
  github_url: string;
  goals: string;
  heard_from: string;
  reviewer_name: string;
  reviewed_at: string | null;
  rejection_reason: string;
  created_at: string;
}

const STATUS: Record<Application['status'], { label: string; tone: 'neutral' | 'live' | 'draft' | 'danger' | 'muted' }> = {
  submitted: { label: 'Submitted', tone: 'draft' },
  under_review: { label: 'Under review', tone: 'draft' },
  approved: { label: 'Approved', tone: 'live' },
  rejected: { label: 'Rejected', tone: 'danger' },
  withdrawn: { label: 'Withdrawn', tone: 'muted' },
};

const isPending = (row: Application) => row.status === 'submitted' || row.status === 'under_review';

export default function ApplicationsTab() {
  const toast = useToast();
  const resource = useWorkspaceResource<Application[] | { results: Application[] }>('/applications/');
  const applications = useMemo(() => {
    const data = resource.data;
    if (Array.isArray(data)) return data;
    return data?.results ?? [];
  }, [resource.data]);

  const [scope, setScope] = useState<'pending' | 'all' | 'decided'>('pending');
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<Application | null>(null);
  const [approving, setApproving] = useState<Application | null>(null);
  const [rejecting, setRejecting] = useState<Application | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pendingCount = applications.filter(isPending).length;

  const rows = useMemo(() => applications
    .filter((row) => scope === 'all' || (scope === 'pending' ? isPending(row) : !isPending(row)))
    .filter((row) => {
      const needle = search.trim().toLowerCase();
      if (!needle) return true;
      return `${row.student_name} ${row.student_email} ${row.course_title} ${row.motivation}`.toLowerCase().includes(needle);
    })
    .sort((a, b) => Number(isPending(b)) - Number(isPending(a))
      || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [applications, scope, search]);

  async function review(action: 'approve' | 'reject') {
    const target = action === 'approve' ? approving : rejecting;
    if (!target || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.request(`/applications/${target.id}/review/`, {
        method: 'POST',
        body: JSON.stringify(action === 'reject' ? { action, rejection_reason: reason.trim() } : { action }),
      });
      toast.push(action === 'approve'
        ? `${target.student_name || target.full_name} was approved. Paid courses still need payment or an access grant.`
        : `${target.student_name || target.full_name} was rejected and the reason was kept.`, 'success');
      setApproving(null);
      setRejecting(null);
      setReason('');
      setViewing(null);
      resource.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The application could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  function open(target: Application, mode: 'view' | 'approve' | 'reject') {
    setError('');
    setReason('');
    if (mode === 'view') { setViewing(target); return; }
    if (mode === 'approve') setApproving(target);
    if (mode === 'reject') setRejecting(target);
  }

  return (
    <>
      <AdminSection
        title="Course applications"
        description="Each learner explains why they want the course. Approving records the decision; it does not take a payment."
        actions={<Action onClick={resource.refresh} disabled={resource.loading}>Refresh</Action>}
      >
        <Toolbar label="Filter applications">
          <TextInput
            type="search"
            placeholder="Search name, email, course or reason"
            aria-label="Search applications"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className={controlClass}
            aria-label="Show applications"
            value={scope}
            onChange={(event) => setScope(event.target.value as typeof scope)}
          >
            <option value="pending">Waiting for a decision ({pendingCount})</option>
            <option value="decided">Decided</option>
            <option value="all">Every application</option>
          </select>
        </Toolbar>

        {resource.error && (
          <StatusNote tone="error">
            {resource.error}
            <span className={adminStyles.inlineActions}><Action onClick={resource.refresh}>Retry</Action></span>
          </StatusNote>
        )}

        {resource.loading && !resource.data && <Skeleton rows={5} />}

        {!resource.loading && !resource.error && applications.length === 0 && (
          <EmptyState
            icon="bi-file-earmark-text"
            title="No applications yet"
            description="Applications appear here the moment a learner sends one from the public course page."
          />
        )}

        {!resource.loading && applications.length > 0 && rows.length === 0 && (
          <EmptyState
            icon="bi-funnel"
            title="Nothing matches that view"
            description={search.trim()
              ? 'Try a shorter search, or switch to every application.'
              : scope === 'pending' ? 'Every application has a decision. Check the decided view to review one.' : 'No applications are in this view yet.'}
          />
        )}

        {rows.length > 0 && (
          <AdminList label="Course applications">
            {rows.map((row) => (
              <AdminRow
                key={row.id}
                round
                placeholder="bi-file-earmark-text"
                title={`${row.student_name || row.full_name || 'Applicant'} · ${row.course_title || 'Course removed'}`}
                badges={<Pill tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Pill>}
                meta={`${row.student_email || 'No email on the account'} · sent ${formatWorkspaceDate(row.created_at)}${row.reviewed_at ? ` · reviewed ${formatWorkspaceDate(row.reviewed_at)}` : ''}`}
                description={row.motivation || 'No motivation was included.'}
                actions={isPending(row) ? <>
                  <Action onClick={() => open(row, 'view')}>Read application</Action>
                  <Action intent="primary" onClick={() => open(row, 'approve')}>Approve</Action>
                  <Action intent="danger" onClick={() => open(row, 'reject')}>Reject</Action>
                </> : <Action onClick={() => open(row, 'view')}>Read application</Action>}
              />
            ))}
          </AdminList>
        )}
      </AdminSection>

      <Drawer
        open={Boolean(viewing)}
        title={viewing ? `${viewing.student_name || viewing.full_name || 'Applicant'} · ${viewing.course_title}` : 'Application'}
        description={viewing ? `Sent ${formatWorkspaceDate(viewing.created_at)}${viewing.reviewer_name ? ` · reviewed by ${viewing.reviewer_name}` : ''}` : undefined}
        onClose={() => setViewing(null)}
        footer={viewing && isPending(viewing) ? <>
          <Action onClick={() => setViewing(null)}>Close</Action>
          <div className={adminStyles.actions}>
            <Action intent="danger" onClick={() => { setViewing(null); setRejecting(viewing); setError(''); setReason(''); }}>Reject</Action>
            <Action intent="primary" onClick={() => { setViewing(null); setApproving(viewing); setError(''); }}>Approve</Action>
          </div>
        </> : <Action onClick={() => setViewing(null)}>Close</Action>}
      >
        {viewing && <ApplicationDetails application={viewing} />}
      </Drawer>

      <Drawer
        open={Boolean(approving)}
        title={approving ? `Approve ${approving.student_name || approving.full_name}?` : 'Approve application'}
        description="The decision is recorded against the applicant. A paid course still needs a successful payment or an explicit access grant before the learner can open it."
        onClose={() => { if (!busy) setApproving(null); }}
        footer={<>
          <Action disabled={busy} onClick={() => setApproving(null)}>Cancel</Action>
          <Action intent="primary" loading={busy} onClick={() => void review('approve')}>Approve application</Action>
        </>}
      >
        {approving && (
          <>
            <StatusNote tone="info">
              {approving.student_email} applied for {approving.course_title}.
            </StatusNote>
            <p className={adminStyles.hint}>
              If the course is free, the learner can enrol straight away. If it is paid, approve here, then either they pay online from the course page or you grant access under Enrollments once payment arrives another way.
            </p>
            {error && <StatusNote tone="error">{error}</StatusNote>}
          </>
        )}
      </Drawer>

      <Drawer
        open={Boolean(rejecting)}
        title={rejecting ? `Reject ${rejecting.student_name || rejecting.full_name}?` : 'Reject application'}
        description="The applicant keeps their account. The reason is stored on the application, so write it for a future teammate who reviews the record."
        onClose={() => { if (!busy) setRejecting(null); }}
        footer={<>
          <Action disabled={busy} onClick={() => setRejecting(null)}>Cancel</Action>
          <Action intent="danger" type="submit" form="reject-application-form" loading={busy}>Reject application</Action>
        </>}
      >
        {rejecting && (
          <form id="reject-application-form" className={formClass} onSubmit={(event: FormEvent) => { event.preventDefault(); void review('reject'); }}>
            <StatusNote tone="info">
              {rejecting.student_email} applied for {rejecting.course_title}.
            </StatusNote>
            <Field label="Reason for the decision" required hint="The applicant is not shown this automatically; it explains the record to your team.">
              <textarea
                className={controlClass}
                required
                rows={4}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="For example: the course requires two years of prior experience, which this application did not show."
              />
            </Field>
            {error && <StatusNote tone="error">{error}</StatusNote>}
          </form>
        )}
      </Drawer>
    </>
  );
}

function ApplicationDetails({ application }: { application: Application }) {
  const facts: Array<[string, string]> = [
    ['Account email', application.student_email],
    ['Phone', application.phone],
    ['Location', [application.city, application.country].filter(Boolean).join(', ')],
    ['Education', application.education],
    ['Current role', application.current_role],
    ['Experience', application.experience],
    ['Heard about us', application.heard_from],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <>
      <StatusNote tone={STATUS[application.status].tone === 'danger' ? 'error' : application.status === 'approved' ? 'ok' : 'info'}>
        {STATUS[application.status].label}
        {application.reviewed_at ? ` · ${formatWorkspaceDate(application.reviewed_at)}` : ''}
        {application.reviewer_name ? ` by ${application.reviewer_name}` : ''}
      </StatusNote>
      <div className={adminStyles.facts}>
        {facts.map(([label, value]) => (
          <div key={label}>
            <p className={adminStyles.factLabel}>{label}</p>
            <p className={adminStyles.factValue}>{value}</p>
          </div>
        ))}
      </div>
      {application.motivation && (
        <div>
          <p className={adminStyles.factLabel}>Why this course</p>
          <p className={adminStyles.prose}>{application.motivation}</p>
        </div>
      )}
      {application.goals && (
        <div>
          <p className={adminStyles.factLabel}>Goals</p>
          <p className={adminStyles.prose}>{application.goals}</p>
        </div>
      )}
      {(application.linkedin_url || application.github_url) && (
        <div className={adminStyles.actions}>
          {application.linkedin_url && <a className={adminStyles.linkAction} href={application.linkedin_url} target="_blank" rel="noopener noreferrer">LinkedIn <i className="bi bi-box-arrow-up-right" aria-hidden="true" /></a>}
          {application.github_url && <a className={adminStyles.linkAction} href={application.github_url} target="_blank" rel="noopener noreferrer">GitHub <i className="bi bi-box-arrow-up-right" aria-hidden="true" /></a>}
        </div>
      )}
      {application.rejection_reason && (
        <StatusNote tone="error">Reason kept on record: {application.rejection_reason}</StatusNote>
      )}
    </>
  );
}
