'use client';

import { useMemo, useState } from 'react';
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
  Pill,
  Skeleton,
  StatusNote,
  TextInput,
  Toolbar,
  adminStyles,
  controlClass,
  useToast,
} from './AdminUI';

type KidsAdmissionStatus = 'submitted' | 'review' | 'approved' | 'declined' | 'withdrawn';

interface KidsAdmission {
  id: number;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  learner: number;
  learner_name: string;
  course: number;
  course_title: string;
  intake: number | null;
  intake_title: string;
  payment_preference: 'pay_now' | 'pay_later';
  status: KidsAdmissionStatus;
  parent_note: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string;
  enrollment: { id: number; status: string; current_stage: number; progress_percent: string } | null;
}

const STATUS: Record<KidsAdmissionStatus, { label: string; tone: 'neutral' | 'live' | 'draft' | 'danger' | 'muted' }> = {
  submitted: { label: 'Submitted', tone: 'draft' },
  review: { label: 'Under review', tone: 'draft' },
  approved: { label: 'Approved', tone: 'live' },
  declined: { label: 'Declined', tone: 'danger' },
  withdrawn: { label: 'Withdrawn', tone: 'muted' },
};

const pending = (row: KidsAdmission) => row.status === 'submitted' || row.status === 'review';
const EMPTY_ADMISSIONS: KidsAdmission[] = [];

export default function KidsAdmissionsTab() {
  const toast = useToast();
  const resource = useWorkspaceResource<KidsAdmission[]>('/admin/dashboard/kids/admissions/');
  const [scope, setScope] = useState<'pending' | 'all' | 'decided'>('pending');
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<KidsAdmission | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const admissions = resource.data ?? EMPTY_ADMISSIONS;
  const pendingCount = admissions.filter(pending).length;
  const rows = useMemo(() => admissions
    .filter((row) => scope === 'all' || (scope === 'pending' ? pending(row) : !pending(row)))
    .filter((row) => {
      const needle = search.trim().toLowerCase();
      return !needle || `${row.parent_name} ${row.parent_email} ${row.learner_name} ${row.course_title}`.toLowerCase().includes(needle);
    }), [admissions, scope, search]);

  async function review(action: 'approve' | 'review' | 'decline' | 'withdraw') {
    if (!viewing || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.request('/admin/dashboard/kids/admissions/review/', {
        method: 'POST',
        body: JSON.stringify({ admission_id: viewing.id, action }),
      });
      toast.push(action === 'approve' ? `${viewing.learner_name} is now enrolled in Kids Academy.` : `Kids admission marked ${action}.`, 'success');
      setViewing(null);
      resource.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The Kids admission could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AdminSection
        title="Kids Academy admissions"
        description="Parent requests stay in the Kids lifecycle. Approving creates a Kids enrollment; it does not create an adult application or adult course access."
        actions={<Action onClick={resource.refresh} disabled={resource.loading}>Refresh</Action>}
      >
        <Toolbar label="Filter Kids admissions">
          <TextInput type="search" placeholder="Search parent, learner or programme" aria-label="Search Kids admissions" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className={controlClass} aria-label="Show Kids admissions" value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}>
            <option value="pending">Waiting for a decision ({pendingCount})</option>
            <option value="decided">Decided</option>
            <option value="all">Every request</option>
          </select>
        </Toolbar>

        {resource.error && <StatusNote tone="error">{resource.error}<span className={adminStyles.inlineActions}><Action onClick={resource.refresh}>Retry</Action></span></StatusNote>}
        {resource.loading && !resource.data && <Skeleton rows={5} />}
        {!resource.loading && !resource.error && admissions.length === 0 && <EmptyState icon="bi-person-hearts" title="No Kids admissions yet" description="Parent requests will appear here after a family submits one from kids.vaceup.ng." />}
        {!resource.loading && admissions.length > 0 && rows.length === 0 && <EmptyState icon="bi-funnel" title="Nothing matches that view" description={search.trim() ? 'Try a shorter search or clear the filter.' : 'No admissions are in this view yet.'} />}
        {rows.length > 0 && <AdminList label="Kids Academy admissions">
          {rows.map((row) => <AdminRow
            key={row.id}
            round
            placeholder="bi-person-hearts"
            title={`${row.learner_name} · ${row.course_title}`}
            badges={<Pill tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Pill>}
            meta={`${row.parent_name || 'Parent'} · ${row.parent_email} · sent ${formatWorkspaceDate(row.created_at)}`}
            description={row.enrollment ? `Stage ${row.enrollment.current_stage} · ${row.enrollment.progress_percent}% complete` : row.parent_note || `${row.payment_preference === 'pay_now' ? 'Parent selected pay now' : 'Parent selected pay later'}.`}
            actions={<Action onClick={() => { setError(''); setViewing(row); }}>{pending(row) ? 'Review request' : 'View request'}</Action>}
          />)}
        </AdminList>}
      </AdminSection>

      <Drawer
        open={Boolean(viewing)}
        title={viewing ? `${viewing.learner_name} · ${viewing.course_title}` : 'Kids admission'}
        description={viewing ? `Parent request from ${viewing.parent_name || viewing.parent_email}` : undefined}
        onClose={() => { if (!busy) setViewing(null); }}
        footer={viewing && pending(viewing) ? <>
          <Action disabled={busy} onClick={() => setViewing(null)}>Close</Action>
          <div className={adminStyles.actions}>
            <Action disabled={busy} onClick={() => void review('decline')} intent="danger">Decline</Action>
            <Action disabled={busy} onClick={() => void review('review')}>Keep under review</Action>
            <Action intent="primary" loading={busy} onClick={() => void review('approve')}>Approve and enroll</Action>
          </div>
        </> : <Action disabled={busy} onClick={() => setViewing(null)}>Close</Action>}
      >
        {viewing && <div className={adminStyles.stack}>
          <StatusNote tone={STATUS[viewing.status].tone === 'danger' ? 'error' : viewing.status === 'approved' ? 'ok' : 'info'}>
            {STATUS[viewing.status].label}{viewing.reviewed_at ? ` · ${formatWorkspaceDate(viewing.reviewed_at)}` : ''}{viewing.reviewed_by ? ` by ${viewing.reviewed_by}` : ''}
          </StatusNote>
          <div className={adminStyles.facts}>
            <div><p className={adminStyles.factLabel}>Parent</p><p className={adminStyles.factValue}>{viewing.parent_name || 'Not supplied'}<br />{viewing.parent_email}{viewing.parent_phone && <><br />{viewing.parent_phone}</>}</p></div>
            <div><p className={adminStyles.factLabel}>Programme</p><p className={adminStyles.factValue}>{viewing.course_title}{viewing.intake_title ? <><br />{viewing.intake_title}</> : null}</p></div>
            <div><p className={adminStyles.factLabel}>Payment preference</p><p className={adminStyles.factValue}>{viewing.payment_preference === 'pay_now' ? 'Pay now' : 'Pay later'}</p></div>
            {viewing.enrollment && <div><p className={adminStyles.factLabel}>Learning journey</p><p className={adminStyles.factValue}>Stage {viewing.enrollment.current_stage}<br />{viewing.enrollment.progress_percent}% complete</p></div>}
          </div>
          {viewing.parent_note && <div><p className={adminStyles.factLabel}>Parent note</p><p className={adminStyles.prose}>{viewing.parent_note}</p></div>}
          {error && <StatusNote tone="error">{error}</StatusNote>}
        </div>}
      </Drawer>
    </>
  );
}
