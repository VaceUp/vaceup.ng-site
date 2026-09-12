'use client';

import { useState } from 'react';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { formatWorkspaceDate, type WorkspaceCourse, type WorkspaceOverview, type WorkspacePage, type WorkspacePayment, type WorkspaceStudent, type WorkspaceCertificate } from '@/lib/workspace-api';
import { downloadApiFile } from '@/lib/api-pages';
import { useWorkspaceTheme } from './MemberShell';
import { WorkspaceHeading, WorkspacePanel, WorkspaceEmpty, WorkspaceFeedback, WorkspaceRefresh, WorkspaceLink, WorkspaceButton, WorkspaceCourseCard, WorkspacePagination, WorkspaceProgress, styles } from './WorkspaceUI';

export function MemberOverview() {
  const { user } = useAuth();
  const instructor = user?.role === 'instructor';
  const resource = useWorkspaceResource<WorkspaceOverview>('/dashboard/overview/');
  const data = resource.data;
  const metrics = instructor ? [['courses', 'Courses'], ['published_courses', 'Published'], ['students', 'Enrolled students'], ['completed_courses', 'Course completions']] : [['courses', 'Enrolled courses'], ['lessons_completed', 'Lessons completed'], ['completed_courses', 'Courses completed'], ['certificates', 'Valid certificates']];
  return <>
    <WorkspaceHeading eyebrow={instructor ? 'TUTOR WORKSPACE' : 'YOUR LEARNING WORKSPACE'} title={instructor ? 'Ready to teach?' : `Keep moving forward${user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}.`}
      description={instructor ? 'Your courses, learners and upcoming sessions, in one place.' : 'Pick up a lesson, check your next class, and see the progress you have earned.'}
      action={<WorkspaceRefresh loading={resource.loading} onRefresh={resource.refresh} />} />
    <WorkspaceFeedback {...resource} hasData={!!data} onRetry={resource.refresh} />
    {data && <><dl className={styles.stats}>{metrics.map(([key, label]) => <div className={styles.stat} key={key}><dt>{label}</dt><dd>{data.counts[key] ?? 0}</dd></div>)}</dl>
      <div className={styles.split}><section className={styles.stack} aria-label="Your courses"><div className={styles.row}><h2>{instructor ? 'Your teaching' : 'Continue learning'}</h2><WorkspaceLink href="/dashboard/courses">All courses<ArrowRight aria-hidden="true" /></WorkspaceLink></div>
        {data.recent_courses.length ? data.recent_courses.map((course, index) => <WorkspaceCourseCard course={course} instructor={instructor} featured={index === 0} key={course.id} />) : <WorkspaceEmpty title={instructor ? 'Your next course starts here' : 'Your learning starts here'} action={!instructor && <WorkspaceLink href="/courses" primary>Explore courses</WorkspaceLink>}>{instructor ? 'Courses assigned to you by the academy will appear here, including drafts.' : 'Once you enroll in a course, your lessons and progress will appear here.'}</WorkspaceEmpty>}
      </section><WorkspacePanel><CalendarDays aria-hidden="true" /><h2>Next live classes</h2><p className={styles.muted}>Times are shown in your device timezone.</p>
        {data.upcoming_classes.length ? <ul className={styles.list}>{data.upcoming_classes.map(item => <li key={item.id}><p>{item.title}</p><p className={styles.muted}>{item.course_title}</p><p className={styles.muted}>{formatWorkspaceDate(item.scheduled_start, true)}</p></li>)}</ul> : <p className={styles.footer}>No upcoming classes scheduled for your courses.</p>}
        <WorkspaceLink href="/dashboard/live-classes">View live classes</WorkspaceLink>
      </WorkspacePanel></div></>}
  </>;
}

export function MemberCourses() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const resource = useWorkspaceResource<WorkspacePage<WorkspaceCourse>>(`/dashboard/courses/?page=${page}&search=${encodeURIComponent(query)}`);
  return <><WorkspaceHeading title="My courses" description={user?.role === 'instructor' ? 'Review the courses you teach, including unpublished drafts.' : 'Your enrollments and progress. Open a course to continue its lessons.'} action={<WorkspaceRefresh loading={resource.loading} onRefresh={resource.refresh} />} />
    <form className={styles.filters} onSubmit={event => { event.preventDefault(); setPage(1); setQuery(search.trim()); }}><label className={styles.field}>Search your courses<input value={search} onChange={event => setSearch(event.target.value)} type="search" /></label><WorkspaceButton type="submit">Search</WorkspaceButton></form>
    <WorkspaceFeedback {...resource} hasData={!!resource.data} onRetry={resource.refresh} />
    {resource.data && <>{resource.data.results.length ? <div className={styles.courseGrid}>{resource.data.results.map(course => <WorkspaceCourseCard key={course.id} course={course} instructor={user?.role === 'instructor'} />)}</div> : <WorkspaceEmpty title={query ? 'No matching courses' : 'No courses yet'} action={!query && user?.role === 'student' && <WorkspaceLink href="/courses">Explore courses</WorkspaceLink>}>{query ? 'Try a different title or clear your search.' : user?.role === 'instructor' ? 'Ask your academy administrator to assign your teaching courses.' : 'Courses will appear here after enrollment.'}</WorkspaceEmpty>}
    <WorkspacePagination page={page} count={resource.data.count} hasNext={!!resource.data.next} loading={resource.loading} onPage={setPage} /></>}
  </>;
}

export function MemberStudents() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const allowed = user?.role === 'instructor';
  const resource = useWorkspaceResource<WorkspacePage<WorkspaceStudent>>(allowed ? `/instructor/students/?page=${page}&status=${status}` : null);
  if (!allowed) return <WorkspaceEmpty title="Tutor access only">This roster is available to the tutors teaching these courses.</WorkspaceEmpty>;
  return <><WorkspaceHeading title="My students" description="Enrollment records for your courses only. A student enrolled in two courses appears twice." action={<WorkspaceRefresh loading={resource.loading} onRefresh={resource.refresh} />} />
    <label className={styles.field}>Enrollment status<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="active">Active</option><option value="completed">Completed</option><option value="suspended">Suspended</option></select></label>
    <WorkspaceFeedback {...resource} hasData={!!resource.data} onRetry={resource.refresh} />
    {resource.data && <>{resource.data.results.length ? <ul className={styles.records}>{resource.data.results.map(student => <li key={`${student.student_id}-${student.course}`} className={styles.record}><div><h2>{student.student_name}</h2><p className={styles.muted}>{student.email}</p><p>{student.course_title}</p><span className={styles.badge}>{student.status}</span></div><div><WorkspaceProgress value={student.progress_percent} label={`${student.student_name}: ${student.course_title}`} /><p className={styles.muted}>Enrolled {formatWorkspaceDate(student.enrolled_at)}</p></div></li>)}</ul> : <WorkspaceEmpty title="No enrollments found">Your students will appear here once they enroll. Try another status filter.</WorkspaceEmpty>}
    <WorkspacePagination page={page} count={resource.data.count} hasNext={!!resource.data.next} loading={resource.loading} onPage={setPage} /></>}
  </>;
}

function money(value: string, currency: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Amount unavailable';
  try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}
export function MemberBilling() {
  const [page, setPage] = useState(1);
  const resource = useWorkspaceResource<WorkspacePage<WorkspacePayment>>(`/dashboard/payments/?page=${page}`);
  return <><WorkspaceHeading title="Payment history" description="Your recorded course payments. A pending payment is not confirmation of enrollment." action={<WorkspaceRefresh loading={resource.loading} onRefresh={resource.refresh} />} />
    <WorkspaceFeedback {...resource} hasData={!!resource.data} onRetry={resource.refresh} />
    {resource.data && <>{resource.data.results.length ? <ul className={styles.records}>{resource.data.results.map(payment => <li className={styles.record} key={payment.reference}><div><h2>{payment.course_title}</h2><p className={styles.muted}>Reference: {payment.reference}</p></div><dl><div><dt>Amount</dt><dd>{money(payment.amount, payment.currency)}</dd></div><div><dt>Status</dt><dd>{payment.status}</dd></div><div><dt>{payment.paid_at ? 'Paid' : 'Started'}</dt><dd>{formatWorkspaceDate(payment.paid_at || payment.created_at)}</dd></div></dl></li>)}</ul> : <WorkspaceEmpty title="No payments recorded">Payments made through your account will appear here. Free courses do not require a payment.</WorkspaceEmpty>}
    <WorkspacePagination page={page} count={resource.data.count} hasNext={!!resource.data.next} loading={resource.loading} onPage={setPage} /></>}
  </>;
}

export function MemberCertificates() {
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const resource = useWorkspaceResource<WorkspacePage<WorkspaceCertificate>>(`/certificates/?page=${page}`);
  const download = async (certificate: WorkspaceCertificate) => {
    setBusy(certificate.certificate_number); setError('');
    try { await downloadApiFile(`/certificates/${encodeURIComponent(certificate.certificate_number)}/pdf/`, `VaceUp-${certificate.certificate_number}.pdf`); }
    catch { setError('Your certificate could not be downloaded. Try again or contact the academy if it continues.'); }
    finally { setBusy(''); }
  };
  return <><WorkspaceHeading title="My certificates" description="Awards issued by your academy, with their current status. Course completion does not by itself guarantee an award." action={<WorkspaceRefresh loading={resource.loading} onRefresh={resource.refresh} />} />
    <WorkspaceFeedback {...resource} hasData={!!resource.data} onRetry={resource.refresh} />{error && <p role="alert" className={styles.error}>{error}</p>}
    {resource.data && <>{resource.data.results.length ? <ul className={styles.records}>{resource.data.results.map(certificate => <li className={styles.record} key={certificate.certificate_number}><div><h2>{certificate.course_title_at_issue}</h2><p>{certificate.student_name_at_issue}</p><p className={styles.muted}>Issued {formatWorkspaceDate(certificate.issue_date)}</p><span className={styles.badge}>{certificate.status}</span></div><div><p className={styles.muted}>{certificate.certificate_number}</p><WorkspaceButton disabled={!!busy || certificate.status !== 'issued'} loading={busy === certificate.certificate_number} onClick={() => void download(certificate)}>Download certificate</WorkspaceButton></div></li>)}</ul> : <WorkspaceEmpty title="Your achievements belong here">Certificates will appear when the academy issues them to your account.</WorkspaceEmpty>}
    <WorkspacePagination page={page} count={resource.data.count} hasNext={!!resource.data.next} loading={resource.loading} onPage={setPage} /></>}
  </>;
}

export function MemberAccount() {
  const { user } = useAuth();
  const { theme, toggle } = useWorkspaceTheme();
  return <><WorkspaceHeading title="Account & appearance" description="Your account details and workspace preferences." /><div className={styles.split}>
    <WorkspacePanel><h2>Your account</h2><dl className={styles.list}><div><dt>Full name</dt><dd>{user?.full_name}</dd></div><div><dt>Email address</dt><dd>{user?.email}</dd></div><div><dt>Account type</dt><dd>{user?.role === 'instructor' ? 'Tutor' : 'Student'}</dd></div></dl><p className={styles.footer}>Contact the academy to correct your name or email address.</p><WorkspaceLink href="/forgot-password">Reset password</WorkspaceLink></WorkspacePanel>
    <WorkspacePanel><h2>Workspace appearance</h2><p className={styles.footer}>This preference applies to the student and tutor workspace and is saved on this device when browser storage is available.</p><WorkspaceButton aria-pressed={theme === 'dark'} onClick={toggle}>Dark theme: {theme === 'dark' ? 'on' : 'off'}</WorkspaceButton></WorkspacePanel>
  </div></>;
}
