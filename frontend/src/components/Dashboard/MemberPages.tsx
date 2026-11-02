'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, CalendarDays, ClipboardList, ListChecks, Search, Video } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { formatWorkspaceDate, type WorkspaceAgendaItem, type WorkspaceApplication, type WorkspaceCourse, type WorkspaceOverview, type WorkspacePage, type WorkspacePayment, type WorkspaceStudent, type WorkspaceCertificate } from '@/lib/workspace-api';
import { formatPrice, getCategories, type CatalogCategory, type CatalogCourse } from '@/lib/public-catalog';
import { getTutorSignature, removeTutorSignature, saveTutorSignature, signatureFileError, signatureUpdatedLabel, SIGNATURE_ACCEPT, type TutorSignature } from '@/lib/certificate-api';
import { downloadApiFile } from '@/lib/api-pages';
import { Avatar } from '@/components/ui/Avatar';
import { useWorkspaceTheme } from './MemberShell';
import { WorkspaceHeading, WorkspacePanel, WorkspaceEmpty, WorkspaceFeedback, WorkspaceRefresh, WorkspaceLink, WorkspaceButton, WorkspaceCourseCard, WorkspacePagination, WorkspaceProgress, styles } from './WorkspaceUI';

function AcceptedCourses({ applications, heading }: { applications: WorkspaceApplication[]; heading?: string }) {
  if (!applications.length) return null;
  return <WorkspacePanel className={styles.accepted}>
    <p className={styles.eyebrow}>APPLICATION ACCEPTED</p>
    {heading ? <h2>{heading}</h2> : null}
    <p className={styles.muted}>The academy accepted your application. Complete the course payment to unlock your lessons and live classes.</p>
    <ul className={styles.list}>{applications.map((application) => <li key={application.id}>
      <div className={styles.row}>
        <div><h3>{application.course_title}</h3><p className={styles.muted}>Tuition {formatPrice(application.price)}{application.reviewed_at ? ` / accepted ${formatWorkspaceDate(application.reviewed_at)}` : ''}</p></div>
        <WorkspaceLink href={`/checkout?course_id=${application.course}`} primary>Pay and enroll<ArrowRight className="size-4" aria-hidden="true" /></WorkspaceLink>
      </div>
    </li>)}</ul>
  </WorkspacePanel>;
}

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
    {data && <><AcceptedCourses applications={data.approved_applications ?? []} heading="Finish your enrollment" /><dl className={styles.stats}>{metrics.map(([key, label]) => <div className={styles.stat} key={key}><dt>{label}</dt><dd>{data.counts[key] ?? 0}</dd></div>)}</dl>
      {data.tasks.some(task => task.count > 0) && <ul className={styles.taskRow} aria-label="Work waiting for you">{data.tasks.filter(task => task.count > 0).map(task =>
        <li key={task.kind}><Link href={task.href} className={styles.task}><strong>{task.count}</strong><span>{task.label}</span><ArrowRight aria-hidden="true" /></Link></li>)}</ul>}
      <div className={styles.split}><section className={styles.stack} aria-label="Your courses"><div className={styles.row}><h2>{instructor ? 'Your teaching' : 'Continue learning'}</h2><WorkspaceLink href="/dashboard/courses">All courses<ArrowRight aria-hidden="true" /></WorkspaceLink></div>
        {data.recent_courses.length ? data.recent_courses.map((course, index) => <WorkspaceCourseCard course={course} instructor={instructor} featured={index === 0} key={course.id} />) : <WorkspaceEmpty title={instructor ? 'Your next course starts here' : 'Your learning starts here'} action={!instructor && <WorkspaceLink href="/dashboard/explore" primary>Explore courses</WorkspaceLink>}>{instructor ? 'Courses assigned to you by the academy will appear here, including drafts.' : 'Once you enroll in a course, your lessons and progress will appear here.'}</WorkspaceEmpty>}
      </section><WorkspacePanel><CalendarDays aria-hidden="true" /><h2>Next up</h2><p className={styles.muted}>Deadlines, assessments and sessions across your courses. Times use this device’s timezone.</p>
        {data.agenda.length ? <ol className={styles.agendaList}>{data.agenda.map(item => <AgendaRow item={item} key={`${item.kind}:${item.id}`} />)}</ol> : <p className={styles.footer}>Nothing is due or scheduled right now. New work appears here automatically.</p>}
        <div className={styles.row}><WorkspaceLink href="/dashboard/assessments?view=list">Assessments</WorkspaceLink><WorkspaceLink href="/dashboard/live-classes">Live classes</WorkspaceLink></div>
      </WorkspacePanel></div></>}
  </>;
}

function AgendaRow({ item }: { item: WorkspaceAgendaItem }) {
  const Icon = item.kind === 'class' ? Video : item.kind === 'quiz' ? ListChecks : ClipboardList;
  return <li className={styles.agendaItem}><Icon aria-hidden="true" /><div><Link href={item.href}><strong>{item.title}</strong></Link>
    <p className={styles.muted}>{item.course_title} / {item.detail}</p>
    <p className={styles.agendaMeta}>{item.when ? formatWorkspaceDate(item.when, true) : 'Available now'}<span className={styles.badge}>{item.state}</span></p></div></li>;
}

export function MemberCourses() {
  const { user } = useAuth();
  const student = user?.role === 'student';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const resource = useWorkspaceResource<WorkspacePage<WorkspaceCourse>>(`/dashboard/courses/?page=${page}&search=${encodeURIComponent(query)}`);
  const accepted = useWorkspaceResource<WorkspacePage<WorkspaceApplication>>(student ? '/dashboard/applications/' : null);
  return <><WorkspaceHeading title="My courses" description={user?.role === 'instructor' ? 'Review the courses you teach, including unpublished drafts.' : 'Your enrollments, accepted applications and progress. Open a course to continue its lessons.'} action={<div className={styles.row}><WorkspaceRefresh loading={resource.loading} onRefresh={() => { resource.refresh(); accepted.refresh(); }} />{student && <WorkspaceLink href="/dashboard/explore">Explore courses</WorkspaceLink>}</div>} />
    <WorkspaceFeedback {...accepted} hasData={!!accepted.data} onRetry={accepted.refresh} />
    {accepted.data && <AcceptedCourses applications={accepted.data.results} heading="Applications waiting for payment" />}
    <form className={styles.filters} onSubmit={event => { event.preventDefault(); setPage(1); setQuery(search.trim()); }}><label className={styles.field}>Search your courses<input value={search} onChange={event => setSearch(event.target.value)} type="search" /></label><WorkspaceButton type="submit">Search</WorkspaceButton></form>
    <WorkspaceFeedback {...resource} hasData={!!resource.data} onRetry={resource.refresh} />
    {resource.data && <>{resource.data.results.length ? <div className={styles.courseGrid}>{resource.data.results.map(course => <WorkspaceCourseCard key={course.id} course={course} instructor={user?.role === 'instructor'} />)}</div> : <WorkspaceEmpty title={query ? 'No matching courses' : accepted.data?.results.length ? 'Your enrollment unlocks after payment' : 'No courses yet'} action={!query && user?.role === 'student' && <WorkspaceLink href="/dashboard/explore">Explore courses</WorkspaceLink>}>{query ? 'Try a different title or clear your search.' : user?.role === 'instructor' ? 'Ask your academy administrator to assign your teaching courses.' : accepted.data?.results.length ? 'Complete the payment above and your course will appear here automatically.' : 'Browse the catalogue and apply for a course to get started.'}</WorkspaceEmpty>}
    <WorkspacePagination page={page} count={resource.data.count} hasNext={!!resource.data.next} loading={resource.loading} onPage={setPage} /></>}
  </>;
}

function ExploreImage({ course }: { course: CatalogCourse }) {
  const source = course.thumbnail || course.image_url || '';
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [source]);
  return <div className={styles.courseImage}>{source && !failed
    ? <img src={source} alt="" loading="lazy" onError={() => setFailed(true)} />
    : <div className={styles.imageFallback}><BookOpen aria-hidden="true" /><span>{course.category_name || course.category || 'VaceUp course'}</span></div>}
  </div>;
}

export function MemberExplore() {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const resource = useWorkspaceResource<WorkspacePage<CatalogCourse>>(`/courses/?is_published=true&page=${page}&search=${encodeURIComponent(query)}${category ? `&category=${category}` : ''}`);
  useEffect(() => {
    let active = true;
    getCategories().then(rows => { if (active) setCategories(rows); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  return <><WorkspaceHeading title="Explore courses" description="Browse every published course without leaving your workspace. Open a course to read the full outline, then apply or pay for a place." action={<WorkspaceRefresh loading={resource.loading} onRefresh={resource.refresh} />} />
    <form className={styles.filters} onSubmit={event => { event.preventDefault(); setPage(1); setQuery(search.trim()); }}>
      <label className={styles.field}>Search the catalogue<input value={search} onChange={event => setSearch(event.target.value)} type="search" placeholder="Course title or topic" /></label>
      <label className={styles.field}>Category<select value={category} onChange={event => { setCategory(event.target.value); setPage(1); }}><option value="">All categories</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <WorkspaceButton type="submit" leftIcon={<Search className="size-4" />}>Search</WorkspaceButton>
    </form>
    <WorkspaceFeedback {...resource} hasData={!!resource.data} onRetry={resource.refresh} />
    {resource.data && <>{resource.data.results.length ? <div className={styles.courseGrid}>{resource.data.results.map(course => <WorkspacePanel key={course.id} className={styles.courseCard}>
      <ExploreImage course={course} />
      <div className={styles.courseBody}>
        <div className={styles.row}><span className={styles.eyebrow}>{course.category_name || course.category}</span><span className={styles.badge}>{course.level}</span></div>
        <h2>{course.title}</h2>
        <p className={styles.muted}>{course.instructor_name}{course.duration ? ` / ${course.duration}` : ''}</p>
        <p className={styles.price}>{formatPrice(course.price)}</p>
        <WorkspaceLink href={`/course?slug=${encodeURIComponent(course.slug)}`}>View course<ArrowRight className="size-4" aria-hidden="true" /></WorkspaceLink>
      </div>
    </WorkspacePanel>)}</div> : <WorkspaceEmpty title={query || category ? 'No matching courses' : 'The catalogue is being updated'}>{query || category ? 'Try a different search or category.' : 'Published courses will appear here as soon as the academy opens them.'}</WorkspaceEmpty>}
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

function TutorSignatureCard() {
  const [current, setCurrent] = useState<TutorSignature | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true); setLoadError('');
    getTutorSignature()
      .then(data => setCurrent(data))
      .catch(() => setLoadError('Your signature could not be loaded. Refresh this page or try again.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const chooseFile = (picked: File | null) => {
    setFile(picked); setMessage('');
    setFileError(picked ? signatureFileError(picked) : '');
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError(''); setMessage('');
    if (!file) { setError('Choose your signature image before saving.'); return; }
    if (fileError) return;
    setSaving(true);
    try {
      const result = await saveTutorSignature(file);
      setCurrent(result);
      setFile(null);
      setFileError('');
      setMessage('Your signature has been saved. Certificates issued to you from now on will print it.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your signature could not be saved. Try again.');
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!window.confirm('Remove your certificate signature? New certificates will print your name without an image.')) return;
    setSaving(true); setError(''); setMessage('');
    try {
      await removeTutorSignature();
      setCurrent(current ? { ...current, signature: '', updated_at: null } : current);
      setMessage('Your signature image has been removed.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your signature could not be removed. Try again.');
    } finally { setSaving(false); }
  };

  if (loading) return <WorkspacePanel><h2>Certificate signature</h2><p className={styles.muted} role="status">Loading your signature...</p></WorkspacePanel>;
  return <WorkspacePanel>
    <p className={styles.eyebrow}>CERTIFICATE SIGNATURE</p>
    <h2>Your signature</h2>
    <p className={styles.muted}>The academy prints this beside the management signature on every certificate issued for your courses. Use a clear PNG signature on a transparent or white background.</p>
    {loadError && <p role="alert" className={styles.error}>{loadError}</p>}
    <form className={`${styles.stack} ${styles.signatureForm}`} onSubmit={event => void save(event)} aria-label="Upload your certificate signature">
      <label className={styles.field}>Signature image<input type="file" accept={SIGNATURE_ACCEPT} onChange={event => chooseFile(event.target.files?.[0] ?? null)} /></label>
      <p className={styles.muted}>PNG, JPEG or WebP, up to 400 KB. {signatureUpdatedLabel(current?.updated_at ?? null)}</p>
      {fileError && <p role="alert" className={styles.error}>{fileError}</p>}
      {current?.signature && <img src={current.signature} alt={`Signature of ${current.name}`} className={styles.signaturePreview} />}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {message && <p role="status">{message}</p>}
      <div className={styles.row}>
        <WorkspaceButton type="submit" primary loading={saving} disabled={!file || !!fileError}>Save signature</WorkspaceButton>
        {current?.signature && <WorkspaceButton type="button" disabled={saving} onClick={() => void remove()}>Remove image</WorkspaceButton>}
      </div>
    </form>
  </WorkspacePanel>;
}

export function MemberCertificates() {
  const { user } = useAuth();
  const instructor = user?.role === 'instructor';
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const resource = useWorkspaceResource<WorkspacePage<WorkspaceCertificate>>(`/certificates/?page=${page}`);
  const download = async (certificate: WorkspaceCertificate) => {
    setBusy(certificate.certificate_number); setError('');
    try { await downloadApiFile(`/certificates/${encodeURIComponent(certificate.certificate_number)}/pdf/`, `VaceUp-${certificate.certificate_number}.pdf`); }
    catch { setError('The certificate could not be downloaded. Try again or contact the academy if it continues.'); }
    finally { setBusy(''); }
  };
  return <><WorkspaceHeading title={instructor ? 'Certificates and signature' : 'My certificates'} description={instructor ? 'Your signing signature and the awards issued for your courses. Course completion does not by itself guarantee an award.' : 'Awards issued by your academy, with their current status. Course completion does not by itself guarantee an award.'} action={<WorkspaceRefresh loading={resource.loading} onRefresh={resource.refresh} />} />
    {instructor && <div className={styles.accepted}><TutorSignatureCard /></div>}
    <WorkspaceFeedback {...resource} hasData={!!resource.data} onRetry={resource.refresh} />{error && <p role="alert" className={styles.error}>{error}</p>}
    {resource.data && <>{resource.data.results.length ? <ul className={styles.records}>{resource.data.results.map(certificate => <li className={styles.record} key={certificate.certificate_number}><div><h2>{certificate.course_title_at_issue}</h2><p>{instructor ? `Awarded to ${certificate.student_name_at_issue}` : certificate.student_name_at_issue}</p><p className={styles.muted}>Issued {formatWorkspaceDate(certificate.issue_date)}</p><span className={styles.badge}>{certificate.status}</span></div><div><p className={styles.muted}>{certificate.certificate_number}</p><WorkspaceButton disabled={!!busy || certificate.status !== 'issued'} loading={busy === certificate.certificate_number} onClick={() => void download(certificate)}>Download certificate</WorkspaceButton></div></li>)}</ul> : <WorkspaceEmpty title={instructor ? 'Awards for your courses appear here' : 'Your achievements belong here'}>{instructor ? 'When the academy issues a certificate for one of your courses, it will be listed here.' : 'Certificates will appear when the academy issues them to your account.'}</WorkspaceEmpty>}
    <WorkspacePagination page={page} count={resource.data.count} hasNext={!!resource.data.next} loading={resource.loading} onPage={setPage} /></>}
  </>;
}

const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_LIMIT = 5 * 1024 * 1024;
const ROLE_LABELS: Record<string, string> = { instructor: 'Tutor', admin: 'Administrator', student: 'Student' };

function ProfilePictureCard() {
  const { user, uploadAvatar, removeAvatar } = useAuth();
  const [busy, setBusy] = useState<'uploading' | 'removing' | ''>('');
  const [percent, setPercent] = useState(0);
  const [preview, setPreview] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  // Revoke only after the picture is no longer on screen: revoking a blob the
  // browser is still displaying makes the image fail and fall back to initials.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const choose = async (picked: File | null) => {
    if (!picked) return;
    setMessage(''); setError('');
    if (!AVATAR_TYPES.includes(picked.type)) { setError('Choose a JPEG, PNG or WebP picture.'); return; }
    if (picked.size > AVATAR_LIMIT) { setError('Choose a picture smaller than 5 MB.'); return; }
    // Show the chosen picture straight away, so the learner sees exactly what is being sent.
    const local = URL.createObjectURL(picked);
    setPreview(local); setBusy('uploading'); setPercent(0);
    try {
      await uploadAvatar(picked, setPercent);
      setMessage('Your picture is saved. It now appears beside your name.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your picture could not be saved. Try again.');
    } finally {
      setPreview(''); setBusy('');
      if (input.current) input.current.value = '';
    }
  };

  const remove = async () => {
    setMessage(''); setError(''); setBusy('removing');
    try {
      await removeAvatar();
      setMessage('Your picture has been removed. Your initials are shown instead.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your picture could not be removed. Try again.');
    } finally { setBusy(''); }
  };

  return <WorkspacePanel>
    <p className={styles.eyebrow}>PROFILE PICTURE</p>
    <h2>How you appear</h2>
    <p className={styles.muted}>Your picture appears beside your name in your workspace, on messages and on certificates. A square picture at least 400 pixels wide works best.</p>
    <div className={styles.avatarRow}>
      <Avatar src={preview || user?.avatar} name={user?.full_name} size="2xl" aria-hidden="true" />
      <div className={`${styles.stack} ${styles.avatarForm}`} aria-live="polite">
        <label className={styles.field}>Choose a picture<input ref={input} type="file" accept={AVATAR_TYPES.join(',')} disabled={!!busy} onChange={event => void choose(event.target.files?.[0] ?? null)} /></label>
        <p className={styles.muted}>JPEG, PNG or WebP, up to 5 MB.</p>
        {busy === 'uploading' && <div className={styles.progressWrap}>
          <progress value={percent} max={100} aria-label="Picture upload progress" />
          <span>{percent}%</span>
        </div>}
        {busy === 'uploading' && <p role="status">{percent < 100 ? `Sending your picture to the academy (${percent}%).` : 'Saving your picture to your account...'}</p>}
      </div>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {message && <p role="status">{message}</p>}
    {user?.avatar && busy !== 'uploading' && <div className={styles.row}>
      <WorkspaceButton type="button" disabled={!!busy} loading={busy === 'removing'} onClick={() => void remove()}>Remove picture</WorkspaceButton>
    </div>}
  </WorkspacePanel>;
}

// The same screen serves staff, who have no workspace theme to switch and are
// not learners, so the caller says which of the two it is.
export function MemberAccount({ staff = false }: { staff?: boolean }) {
  const { user, updateProfile } = useAuth();
  const { theme, toggle } = useWorkspaceTheme();
  const [name, setName] = useState(user?.full_name ?? '');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileBusy(true); setProfileError(''); setProfileMessage('');
    try {
      await updateProfile({ full_name: name.trim() });
      setProfileMessage('Your display name has been updated.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Your profile could not be saved. Try again.');
    } finally { setProfileBusy(false); }
  };
  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(''); setPasswordMessage('');
    if (next !== confirm) { setPasswordError('The new passwords do not match.'); return; }
    setPasswordBusy(true);
    try {
      await api.changePassword({ current_password: current, new_password: next });
      setCurrent(''); setNext(''); setConfirm('');
      setPasswordMessage('Password updated. Every session, including this one, will need to sign in again once its access token expires.');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Your password could not be changed. Try again.');
    } finally { setPasswordBusy(false); }
  };
  return <><WorkspaceHeading title={staff ? 'Your account' : 'Account & appearance'} description={staff ? 'How you appear to learners and tutors, and how you sign in.' : 'Your account details, security and workspace preferences.'} /><div className={styles.split}>
    <div className={styles.stack}>
      <ProfilePictureCard />
      <WorkspacePanel><h2>Name and sign-in</h2><dl className={styles.list}><div><dt>Email address</dt><dd>{user?.email}</dd></div><div><dt>Account type</dt><dd>{ROLE_LABELS[user?.role ?? 'student'] || 'Student'}</dd></div></dl>
        <form className={styles.stack} onSubmit={event => void saveProfile(event)} aria-label="Update your display name"><label className={styles.field}>Full name<input value={name} onChange={event => setName(event.target.value)} maxLength={150} required /></label>
          {profileError && <p role="alert" className={styles.error}>{profileError}</p>}{profileMessage && <p role="status">{profileMessage}</p>}
          <div><WorkspaceButton type="submit" loading={profileBusy} disabled={!name.trim() || name.trim() === user?.full_name}>Save display name</WorkspaceButton></div></form>
        <p className={styles.footer}>{staff
          ? 'Your email address is how you sign in. Only the academy can change it, so account recovery stays secure.'
          : 'Contact the academy to correct your email address. Email changes are staff-controlled so account recovery stays secure.'}</p>
      </WorkspacePanel>
      <WorkspacePanel><h2>Change password</h2><p className={styles.footer}>Use at least eight characters. Changing your password signs every session, including this one, out once its access token expires.</p>
        <form className={styles.stack} onSubmit={event => void savePassword(event)} aria-label="Change your password">
          <label className={styles.field}>Current password<input type="password" value={current} onChange={event => setCurrent(event.target.value)} autoComplete="current-password" required /></label>
          <label className={styles.field}>New password<input type="password" value={next} onChange={event => setNext(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
          <label className={styles.field}>Confirm new password<input type="password" value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
          {passwordError && <p role="alert" className={styles.error}>{passwordError}</p>}{passwordMessage && <p role="status">{passwordMessage}</p>}
          <div className={styles.row}><WorkspaceButton type="submit" loading={passwordBusy} disabled={!current || !next || !confirm}>Update password</WorkspaceButton><WorkspaceLink href="/forgot-password">I forgot my password</WorkspaceLink></div>
        </form>
      </WorkspacePanel>
    </div>
    {!staff && <WorkspacePanel><h2>Workspace appearance</h2><p className={styles.footer}>This preference applies to the student and tutor workspace and is saved on this device when browser storage is available.</p><WorkspaceButton aria-pressed={theme === 'dark'} onClick={toggle}>Dark theme: {theme === 'dark' ? 'on' : 'off'}</WorkspaceButton></WorkspacePanel>}
  </div></>;
}
