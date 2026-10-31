'use client';

import type { ReactNode } from 'react';
import type { AdminTab } from '@/lib/admin-sections';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { Action, AdminSection, Skeleton, StatusNote, adminStyles } from './AdminUI';

interface AdminStats {
  users: { total: number; students: number; instructors: number; admins: number; new_last_30_days: number };
  courses: { total: number; published: number; draft: number };
  enrollments: { total: number; active: number; completed: number; revenue_last_30_days?: string | number };
  live_classes?: { total: number; upcoming: number; live: number };
  assignments?: { total: number; submissions_pending: number };
  applications?: { pending: number };
}

const count = (value: number | undefined) => (value ?? 0).toLocaleString();

function money(value: number | string | undefined) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function Stat({ label, value, note, money: isMoney, wide }: {
  label: string; value: ReactNode; note?: ReactNode; money?: boolean; wide?: boolean;
}) {
  return <div className={`${adminStyles.stat} ${wide ? adminStyles.statWide : ''}`}>
    <p className={adminStyles.statLabel}>{label}</p>
    <p className={`${adminStyles.statValue} ${isMoney ? adminStyles.statValueMoney : ''}`}>{value}</p>
    {note && <p className={adminStyles.statNote}>{note}</p>}
  </div>;
}

function AttentionCard({ value, title, hint, action, onOpen }: {
  value: number; title: string; hint: string; action: string; onOpen: () => void;
}) {
  return <button type="button" className={adminStyles.attentionCard} data-quiet={value === 0 ? 'true' : 'false'} onClick={onOpen}>
    <span className={adminStyles.attentionCount}>{count(value)}</span>
    <span className={adminStyles.attentionLabel}>{title}</span>
    <span className={adminStyles.hint}>{hint}</span>
    <span className={adminStyles.attentionAction}>{action} <i className="bi bi-arrow-right" aria-hidden="true" /></span>
  </button>;
}

const SHORTCUTS: { tab: AdminTab; icon: string; title: string; text: string }[] = [
  { tab: 'users', icon: 'bi-person-plus', title: 'Invite a tutor or admin', text: 'Give a teammate access with the right role.' },
  { tab: 'courses', icon: 'bi-book', title: 'Create a course', text: 'Build a programme and publish it when it is ready.' },
  { tab: 'applications', icon: 'bi-file-earmark-text', title: 'Review applications', text: 'Read, approve or reject a learner application.' },
  { tab: 'website', icon: 'bi-globe2', title: 'Update the public website', text: 'Edit the About page, team and site profile.' },
];

export default function OverviewTab({ onNavigate }: { onNavigate: (tab: AdminTab) => void }) {
  const resource = useWorkspaceResource<AdminStats>('/admin/dashboard/');
  const stats = resource.data;

  return <>
    {resource.error && <StatusNote tone="error">
      {resource.error}
      <Action className={adminStyles.inlineActions} onClick={resource.refresh}>Retry statistics</Action>
    </StatusNote>}
    {resource.error && stats && <p className={adminStyles.hint}>Showing the last statistics we could load.</p>}
    {resource.loading && !stats && <Skeleton rows={4} />}

    {stats && <>
      <AdminSection
        title="Needs attention"
        description="Work still waiting on a person. Open a card to clear the queue; counts refresh while this page is open."
      >
        <div className={adminStyles.attentionGrid}>
          <AttentionCard
            value={stats.applications?.pending ?? 0}
            title="Applications to review"
            hint="Submitted applications without a decision."
            action="Open applications"
            onOpen={() => onNavigate('applications')}
          />
          <AttentionCard
            value={stats.assignments?.submissions_pending ?? 0}
            title="Submissions to grade"
            hint="Student work a tutor has not marked yet."
            action="Open assignments"
            onOpen={() => onNavigate('assignments')}
          />
          <AttentionCard
            value={stats.courses?.draft ?? 0}
            title="Courses still in draft"
            hint="Programmes learners cannot see or join yet."
            action="Open courses"
            onOpen={() => onNavigate('courses')}
          />
        </div>
      </AdminSection>

      <AdminSection
        title="People"
        description="Everyone with an account on the academy, by role."
        actions={<Action onClick={() => onNavigate('users')}>Open users</Action>}
      >
        <div className={adminStyles.stats}>
          <Stat label="Total accounts" value={count(stats.users?.total)} note="Every role with a login." />
          <Stat label="Students" value={count(stats.users?.students)} />
          <Stat label="Tutors" value={count(stats.users?.instructors)} />
          <Stat label="New accounts" value={count(stats.users?.new_last_30_days)} note="Registered in the last 30 days." />
        </div>
      </AdminSection>

      <AdminSection
        title="Teaching and money"
        description="Programmes, enrolments, live teaching and payments collected over the last 30 days."
        actions={<Action onClick={() => onNavigate('courses')}>Open courses</Action>}
      >
        <div className={adminStyles.stats}>
          <Stat
            label="Collected (30 days)"
            value={money(stats.enrollments?.revenue_last_30_days)}
            money
            wide
            note="Successful payments only."
          />
          <Stat
            label="Courses"
            value={count(stats.courses?.total)}
            note={`${count(stats.courses?.published)} published, ${count(stats.courses?.draft)} in draft.`}
          />
          <Stat
            label="Active enrolments"
            value={count(stats.enrollments?.active)}
            note={`${count(stats.enrollments?.completed)} completed all time.`}
          />
          <Stat
            label="Live classes"
            value={count(stats.live_classes?.total)}
            note={`${count(stats.live_classes?.upcoming)} upcoming, ${count(stats.live_classes?.live)} live now.`}
          />
        </div>
      </AdminSection>

      <AdminSection title="Common tasks" description="The jobs done most often in this panel.">
        <div className={adminStyles.shortcutGrid}>
          {SHORTCUTS.map((shortcut) => <button
            key={shortcut.tab}
            type="button"
            className={adminStyles.shortcut}
            onClick={() => onNavigate(shortcut.tab)}
          >
            <span className={adminStyles.shortcutIcon} aria-hidden="true"><i className={`bi ${shortcut.icon}`} /></span>
            <span>
              <span className={adminStyles.shortcutTitle}>{shortcut.title}</span>
              <span className={adminStyles.shortcutText}>{shortcut.text}</span>
            </span>
          </button>)}
        </div>
      </AdminSection>
    </>}
  </>;
}
