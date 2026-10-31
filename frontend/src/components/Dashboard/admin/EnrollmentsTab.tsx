'use client';

import { useMemo, useState } from 'react';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { formatWorkspaceDate } from '@/lib/workspace-api';
import GrantAccessDrawer from './ManualEnrollmentForm';
import {
  Action,
  AdminList,
  AdminRow,
  AdminSection,
  EmptyState,
  Pill,
  Skeleton,
  StatusNote,
  TextInput,
  Toolbar,
  adminStyles,
  controlClass,
} from './AdminUI';

/**
 * Course access: every enrolment, its progress and whether it is active.
 * Access arrives from a paid checkout, a free course, or a verified
 * off-platform payment granted from the drawer.
 */

interface Enrollment {
  id: string;
  student_name: string;
  student_email: string;
  course_title: string;
  status: 'active' | 'completed' | 'suspended';
  progress_percent: number;
  enrolled_at: string;
}

const STATUS: Record<Enrollment['status'], { label: string; tone: 'live' | 'muted' | 'danger' }> = {
  active: { label: 'Active', tone: 'live' },
  completed: { label: 'Completed', tone: 'muted' },
  suspended: { label: 'Suspended', tone: 'danger' },
};

export default function EnrollmentsTab() {
  const resource = useWorkspaceResource<Enrollment[] | { results: Enrollment[] }>('/admin/dashboard/enrollments/');
  const enrollments = useMemo(() => {
    const data = resource.data;
    if (Array.isArray(data)) return data;
    return data?.results ?? [];
  }, [resource.data]);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [grantOpen, setGrantOpen] = useState(false);

  const counts = useMemo(() => enrollments.reduce(
    (totals, row) => ({ ...totals, [row.status]: totals[row.status] + 1 }),
    { active: 0, completed: 0, suspended: 0 } as Record<Enrollment['status'], number>,
  ), [enrollments]);

  const rows = useMemo(() => enrollments.filter((row) => {
    if (status && row.status !== status) return false;
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return `${row.student_name} ${row.student_email} ${row.course_title}`.toLowerCase().includes(needle);
  }), [enrollments, search, status]);

  return (
    <>
      <AdminSection
        title="Enrollments"
        description="Who can open which course, and how far they have got. A checkout or a granted payment creates this record — deleting it would not refund anyone."
        actions={<>
          <Action onClick={resource.refresh} disabled={resource.loading}>Refresh</Action>
          <Action intent="primary" onClick={() => setGrantOpen(true)}>Grant access</Action>
        </>}
      >
        <div className={adminStyles.stats}>
          <div className={adminStyles.stat}>
            <p className={adminStyles.statLabel}>Everyone</p>
            <p className={adminStyles.statValue}>{enrollments.length}</p>
            <p className={adminStyles.statNote}>Latest 300 records</p>
          </div>
          <div className={adminStyles.stat}>
            <p className={adminStyles.statLabel}>Active</p>
            <p className={adminStyles.statValue}>{counts.active}</p>
            <p className={adminStyles.statNote}>Currently learning</p>
          </div>
          <div className={adminStyles.stat}>
            <p className={adminStyles.statLabel}>Completed</p>
            <p className={adminStyles.statValue}>{counts.completed}</p>
            <p className={adminStyles.statNote}>All lessons finished</p>
          </div>
          <div className={adminStyles.stat}>
            <p className={adminStyles.statLabel}>Suspended</p>
            <p className={adminStyles.statValue}>{counts.suspended}</p>
            <p className={adminStyles.statNote}>Access withdrawn</p>
          </div>
        </div>

        <Toolbar label="Filter enrollments">
          <TextInput
            type="search"
            placeholder="Search learner or course"
            aria-label="Search enrollments"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className={controlClass}
            aria-label="Filter by enrollment status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Every status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="suspended">Suspended</option>
          </select>
        </Toolbar>

        {resource.error && (
          <StatusNote tone="error">
            {resource.error}
            <span className={adminStyles.inlineActions}><Action onClick={resource.refresh}>Retry</Action></span>
          </StatusNote>
        )}

        {resource.loading && !resource.data && <Skeleton rows={6} />}

        {!resource.loading && !resource.error && enrollments.length === 0 && (
          <EmptyState
            icon="bi-door-open"
            title="Nobody has course access yet"
            description="Access is created when a learner pays for a course, enrolls in a free one, or when you grant it here after an off-platform payment."
            action={<Action intent="primary" onClick={() => setGrantOpen(true)}>Grant access</Action>}
          />
        )}

        {enrollments.length > 0 && rows.length === 0 && (
          <EmptyState
            icon="bi-funnel"
            title="No enrollment matches that filter"
            description="Clear the status filter or shorten the search."
          />
        )}

        {rows.length > 0 && (
          <AdminList label="Course enrollments">
            {rows.map((row) => {
              const progress = Math.round(Number(row.progress_percent) || 0);
              return (
                <AdminRow
                  key={row.id}
                  round
                  placeholder="bi-door-open"
                  title={row.student_name || 'Account removed'}
                  badges={<>
                    <Pill tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Pill>
                    <span className={adminStyles.amount}>{progress}% complete</span>
                  </>}
                  meta={`${row.student_email || 'No email on record'} · ${row.course_title} · started ${formatWorkspaceDate(row.enrolled_at)}`}
                />
              );
            })}
          </AdminList>
        )}
      </AdminSection>

      <GrantAccessDrawer
        open={grantOpen}
        onClose={() => setGrantOpen(false)}
        onGranted={resource.refresh}
      />
    </>
  );
}
