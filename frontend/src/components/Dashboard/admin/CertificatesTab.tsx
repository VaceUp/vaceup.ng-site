'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { api, type PaginatedResponse } from '@/lib/api';
import { managementList, managedTutors, type ManagedCourse, type ManagedTutor } from '@/lib/course-management';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { ManagementSignatureCard } from './CertificateSignatures';
import { formatWorkspaceDate } from '@/lib/workspace-api';
import {
  Action,
  AdminList,
  AdminRow,
  AdminSection,
  Drawer,
  EmptyState,
  Field,
  FormGrid,
  FormGroup,
  LinkAction,
  Pager,
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
 * Certificates: issue one for a completed enrollment (the preview is rendered
 * by the same code that draws the PDF), download the PDF, open public
 * verification, and revoke an award with a recorded reason.
 */

interface CertificateRow {
  id: number;
  certificate_number: string;
  verification_code: string;
  student_name: string;
  course_title: string;
  student_name_at_issue: string;
  course_title_at_issue: string;
  status: 'issued' | 'revoked' | 'expired' | string;
  issue_date: string;
  pdf_url: string | null;
  pdf_generated_at: string | null;
}

interface StudentOption {
  id: number;
  full_name: string;
  email: string;
  is_active: boolean;
}

interface IssuedResult {
  certificate_number: string;
  verification_code: string;
  student_name: string;
  course_title: string;
  tutor_name?: string;
}

interface Preview {
  html: string;
  template: string;
  page_size?: string;
  orientation?: string;
}

const STATUS: Record<string, { label: string; tone: 'live' | 'danger' | 'muted' }> = {
  issued: { label: 'Valid', tone: 'live' },
  revoked: { label: 'Revoked', tone: 'danger' },
  expired: { label: 'Expired', tone: 'muted' },
};

const rowsOf = <T,>(value: PaginatedResponse<T> | T[] | undefined): T[] =>
  !value ? [] : Array.isArray(value) ? value : value.results;

const studentName = (row: CertificateRow) => row.student_name_at_issue || row.student_name || 'Student';
const courseTitle = (row: CertificateRow) => row.course_title_at_issue || row.course_title || 'Course';

export function CertificatesTab() {
  const toast = useToast();

  const [page, setPage] = useState(1);
  const certificates = useWorkspaceResource<PaginatedResponse<CertificateRow>>(`/certificates/?page=${page}`);
  const [filter, setFilter] = useState('');

  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [coursesError, setCoursesError] = useState('');
  const [tutors, setTutors] = useState<ManagedTutor[]>([]);
  const [tutorsError, setTutorsError] = useState('');

  const [studentQuery, setStudentQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const students = useWorkspaceResource<PaginatedResponse<StudentOption> | StudentOption[]>(
    appliedQuery ? `/admin/dashboard/users/?role=student&search=${encodeURIComponent(appliedQuery)}` : '/admin/dashboard/users/?role=student',
  );
  const [courseId, setCourseId] = useState('');
  const [tutorId, setTutorId] = useState('');

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const previewBox = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0);

  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState('');
  const [issued, setIssued] = useState<IssuedResult | null>(null);

  const [revoking, setRevoking] = useState<CertificateRow | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [revokeError, setRevokeError] = useState('');

  const [pdfBusy, setPdfBusy] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    managementList<ManagedCourse>('/admin/dashboard/courses/')
      .then((rows) => { if (active) { setCourses(rows); setCoursesError(''); } })
      .catch((error: unknown) => {
        if (active) setCoursesError(error instanceof Error ? error.message : 'Courses could not be loaded.');
      });
    managedTutors()
      .then((rows) => { if (active) { setTutors(rows); setTutorsError(''); } })
      .catch((error: unknown) => {
        if (active) setTutorsError(error instanceof Error ? error.message : 'Tutors could not be loaded.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const term = studentQuery.trim();
    const timer = window.setTimeout(() => setAppliedQuery(term.length >= 2 ? term : ''), 350);
    return () => window.clearTimeout(timer);
  }, [studentQuery]);

  const studentId = selectedStudent?.id;
  useEffect(() => {
    if (!studentId || !courseId) {
      setPreview(null);
      setPreviewError('');
      setPreviewBusy(false);
      return undefined;
    }
    let active = true;
    setPreviewBusy(true);
    setPreviewError('');
    const tutorQuery = tutorId ? `&tutor=${encodeURIComponent(tutorId)}` : '';
    api.request<{ html: string; template: string }>(`/certificates/templates/preview/?course=${courseId}&student=${studentId}${tutorQuery}`)
      .then((result) => { if (active) setPreview(result); })
      .catch((error: unknown) => {
        if (!active) return;
        setPreview(null);
        setPreviewError(error instanceof Error ? error.message : 'The certificate design could not be previewed.');
      })
      .finally(() => { if (active) setPreviewBusy(false); });
    return () => { active = false; };
  }, [studentId, courseId, tutorId]);

  const previewPage = useMemo(() => {
    const letter = preview?.page_size === 'Letter';
    const portrait = preview?.orientation !== 'landscape';
    const shortSide = letter ? 816 : 794;
    const longSide = letter ? 1056 : 1123;
    return portrait
      ? { width: shortSide, height: longSide }
      : { width: longSide, height: shortSide };
  }, [preview?.page_size, preview?.orientation]);

  useLayoutEffect(() => {
    const box = previewBox.current;
    if (!box || !preview) return undefined;
    const measure = () => setPreviewScale(box.clientWidth / previewPage.width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [preview, previewPage.width]);

  const studentOptions = useMemo(() => {
    const rows = rowsOf(students.data);
    return selectedStudent && !rows.some((row) => row.id === selectedStudent.id)
      ? [selectedStudent, ...rows]
      : rows;
  }, [students.data, selectedStudent]);

  const onStudentQuery = (value: string) => {
    setStudentQuery(value);
    setSelectedStudent(null);
    setIssued(null);
    setIssueError('');
  };

  const chooseCourse = (value: string) => {
    setCourseId(value);
    const course = courses.find((row) => String(row.id) === value);
    setTutorId(course ? String(course.instructor) : '');
    setIssued(null);
    setIssueError('');
  };

  const chooseStudent = (value: string) => {
    setSelectedStudent(studentOptions.find((row) => String(row.id) === value) ?? null);
    setIssued(null);
    setIssueError('');
  };

  const issue = async (event: FormEvent) => {
    event.preventDefault();
    setIssueError('');
    setIssued(null);
    if (!studentId || !courseId) {
      setIssueError('Choose the student and the course.');
      return;
    }
    if (!tutorId) {
      setIssueError('Choose the tutor who signs this certificate.');
      return;
    }
    setIssuing(true);
    try {
      const result = await api.request<IssuedResult>('/admin/dashboard/certificates/issue/', {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId, course_id: Number(courseId), tutor_id: Number(tutorId) }),
      });
      setIssued(result);
      toast.push(`Certificate ${result.certificate_number} issued to ${result.student_name}.`, 'success');
      setPage(1);
      certificates.refresh();
    } catch (error) {
      setIssueError(error instanceof Error ? error.message : 'The certificate could not be issued.');
    } finally {
      setIssuing(false);
    }
  };

  const downloadPdf = async (row: CertificateRow) => {
    if (!row.pdf_url) return;
    setPdfBusy(row.id);
    try {
      const get = (token: string | null) => fetch(`${api.baseUrl}/certificates/${encodeURIComponent(row.certificate_number)}/pdf/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      let response = await get(api.getToken());
      if (response.status === 401) {
        await api.refreshToken();
        response = await get(api.getToken());
      }
      if (!response.ok) {
        throw new Error(response.status === 404
          ? 'The PDF is still being generated. Try again in a moment.'
          : 'The PDF could not be downloaded.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `certificate-${row.certificate_number}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'The PDF could not be downloaded.', 'error');
    } finally {
      setPdfBusy(null);
    }
  };

  const revoke = async (event: FormEvent) => {
    event.preventDefault();
    if (!revoking) return;
    setRevokeBusy(true);
    setRevokeError('');
    try {
      await api.request(`/certificates/${encodeURIComponent(revoking.certificate_number)}/revoke/`, {
        method: 'POST',
        body: JSON.stringify({ reason: revokeReason.trim() }),
      });
      toast.push(`Certificate ${revoking.certificate_number} revoked.`, 'success');
      setRevoking(null);
      setRevokeReason('');
      certificates.refresh();
    } catch (error) {
      setRevokeError(error instanceof Error ? error.message : 'The certificate could not be revoked.');
    } finally {
      setRevokeBusy(false);
    }
  };

  const total = certificates.data?.count ?? 0;
  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const all = rowsOf(certificates.data);
    if (!needle) return all;
    return all.filter((row) => `${studentName(row)} ${courseTitle(row)} ${row.certificate_number}`.toLowerCase().includes(needle));
  }, [certificates.data, filter]);

  return (
    <>
      <ManagementSignatureCard />

      <AdminSection
        title="Issue a certificate"
        description="Certificates are issued only for a completed enrollment. Choose the student and course: the preview is drawn by the same code that renders the PDF."
      >
        <form id="issue-certificate-form" className={formClass} onSubmit={issue}>
          <FormGrid>
            <FormGroup title="Recipient">
              <Field label="Find the student" hint="Search by name or email. The newest students are listed until you search.">
                <TextInput
                  type="search"
                  value={studentQuery}
                  placeholder="Start typing a name or email"
                  onChange={(event) => onStudentQuery(event.target.value)}
                />
              </Field>
              <Field
                label="Student"
                required
                error={students.error || undefined}
                hint={appliedQuery ? `Matching “${appliedQuery}”.` : 'Showing the newest students on the platform.'}
              >
                <select
                  className={controlClass}
                  value={selectedStudent ? String(selectedStudent.id) : ''}
                  disabled={students.loading || studentOptions.length === 0}
                  onChange={(event) => chooseStudent(event.target.value)}
                >
                  <option value="">
                    {students.loading ? 'Loading students…' : studentOptions.length ? 'Choose a student' : 'No student matches'}
                  </option>
                  {studentOptions.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.full_name || student.email}{student.is_active ? '' : ' (inactive)'}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Course"
                required
                error={coursesError || undefined}
                hint="The certificate records this course's title and tutor at the moment you issue it."
              >
                <select
                  className={controlClass}
                  value={courseId}
                  disabled={Boolean(coursesError)}
                  onChange={(event) => chooseCourse(event.target.value)}
                >
                  <option value="">Choose a course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}{course.is_published ? '' : ' (Draft)'}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Tutor who signs"
                required
                error={tutorsError || undefined}
                hint="Defaults to the course tutor. Choose another tutor to sign this award on their behalf."
              >
                <select
                  className={controlClass}
                  value={tutorId}
                  disabled={Boolean(tutorsError) || tutors.length === 0}
                  onChange={(event) => { setTutorId(event.target.value); setIssued(null); setIssueError(''); }}
                >
                  <option value="">{tutors.length ? 'Choose a tutor' : 'No active tutors'}</option>
                  {tutors.map((tutor) => (
                    <option key={tutor.id} value={tutor.id}>
                      {tutor.full_name ? `${tutor.full_name} (${tutor.email})` : tutor.email}
                    </option>
                  ))}
                </select>
              </Field>
              <div className={adminStyles.actions}>
                <Action intent="primary" type="submit" loading={issuing} disabled={!studentId || !courseId || !tutorId || Boolean(coursesError || tutorsError)}>
                  Issue certificate
                </Action>
              </div>
              {issueError && <StatusNote tone="error">{issueError}</StatusNote>}
              {issued && (
                <StatusNote tone="ok">
                  Certificate {issued.certificate_number} issued to {issued.student_name} for {issued.course_title}.{' '}
                  <LinkAction href={`/verify?code=${encodeURIComponent(issued.verification_code)}`} external>Open the public check</LinkAction>
                </StatusNote>
              )}
            </FormGroup>

            <FormGroup title="Preview">
              {!studentId || !courseId ? (
                <EmptyState
                  icon="bi-award"
                  title="The award, before you issue it"
                  description="Choose a student and a course to see the exact certificate they would receive, including names, dates and the verification code."
                />
              ) : previewBusy && !preview ? (
                <Skeleton rows={3} />
              ) : previewError ? (
                <StatusNote tone="error">{previewError}</StatusNote>
              ) : preview ? (
                <>
                  <div
                    ref={previewBox}
                    className={adminStyles.embed}
                    style={{ aspectRatio: `${previewPage.width} / ${previewPage.height}` }}
                  >
                    {previewScale > 0 && (
                      <iframe
                        title="Certificate preview"
                        srcDoc={preview.html}
                        sandbox=""
                        width={previewPage.width}
                        height={previewPage.height}
                        className={adminStyles.previewPage}
                        style={{ transform: `scale(${previewScale})` }}
                      />
                    )}
                  </div>
                  <p className={adminStyles.hint}>Design: {preview.template}. Details come from the real course records.</p>
                </>
              ) : null}
            </FormGroup>
          </FormGrid>
        </form>
      </AdminSection>

      <AdminSection
        title="Issued certificates"
        description="Newest first. Valid certificates can be downloaded and checked publicly; revoked awards stay on record with their reason."
        actions={<>
          <Action disabled={certificates.loading} onClick={certificates.refresh}>Refresh</Action>
          <LinkAction href="/verify" external>Open verify page</LinkAction>
        </>}
      >
        {total > 0 && (
          <Toolbar label="Filter issued certificates">
            <Field label="Filter this page" hint="Pagination stays on the server, so this narrows the certificates listed below.">
              <TextInput
                type="search"
                value={filter}
                placeholder="Student, course or certificate number"
                onChange={(event) => setFilter(event.target.value)}
              />
            </Field>
          </Toolbar>
        )}

        {certificates.error && <StatusNote tone="error">{certificates.error}</StatusNote>}
        {certificates.loading && !certificates.data && <Skeleton rows={4} />}

        {!certificates.loading && !certificates.error && total === 0 && (
          <EmptyState
            icon="bi-award"
            title="No certificates issued yet"
            description="Issue one above for a student who has completed a course, or let the platform issue them automatically on completion."
          />
        )}

        {total > 0 && rows.length === 0 && (
          <EmptyState
            icon="bi-search"
            title="Nothing matches this filter"
            description="This filter only narrows the certificates on this page. Clear it to see everything on the page, or move to another page."
            action={<Action onClick={() => setFilter('')}>Clear filter</Action>}
          />
        )}

        {rows.length > 0 && (
          <AdminList label="Issued certificates">
            {rows.map((row) => {
              const state = STATUS[row.status] ?? { label: row.status, tone: 'muted' as const };
              return (
                <AdminRow
                  key={row.id}
                  placeholder="bi-award"
                  title={studentName(row)}
                  badges={<>
                    <Pill tone={state.tone}>{state.label}</Pill>
                    {row.status === 'issued' && !row.pdf_url && <Pill tone="muted">PDF pending</Pill>}
                  </>}
                  meta={`${courseTitle(row)} · ${row.certificate_number} · issued ${formatWorkspaceDate(row.issue_date)}`}
                  actions={<>
                    {row.status === 'issued' && row.pdf_url && (
                      <Action loading={pdfBusy === row.id} onClick={() => void downloadPdf(row)}>Download PDF</Action>
                    )}
                    <LinkAction href={`/verify?code=${encodeURIComponent(row.verification_code)}`} external>Verify</LinkAction>
                    {row.status === 'issued' && (
                      <Action intent="danger" onClick={() => { setRevokeError(''); setRevokeReason(''); setRevoking(row); }}>Revoke</Action>
                    )}
                  </>}
                />
              );
            })}
          </AdminList>
        )}

        {total > 0 && (
          <Pager
            page={page}
            count={total}
            hasNext={Boolean(certificates.data?.next)}
            label="Issued certificates"
            busy={certificates.loading}
            onPrev={() => setPage((value) => Math.max(1, value - 1))}
            onNext={() => setPage((value) => value + 1)}
          />
        )}
      </AdminSection>

      <Drawer
        open={Boolean(revoking)}
        title={revoking ? `Revoke “${studentName(revoking)}” certificate` : 'Revoke certificate'}
        description="Revoking keeps the record but the public verification page will report the award as revoked. This cannot be undone from here."
        onClose={() => { if (!revokeBusy) setRevoking(null); }}
        footer={<>
          <Action disabled={revokeBusy} onClick={() => setRevoking(null)}>Cancel</Action>
          <Action intent="danger" type="submit" form="revoke-certificate-form" loading={revokeBusy}>Revoke certificate</Action>
        </>}
      >
        {revoking && (
          <form id="revoke-certificate-form" className={formClass} onSubmit={revoke}>
            <StatusNote tone="info">
              {studentName(revoking)} · {courseTitle(revoking)} · issued {formatWorkspaceDate(revoking.issue_date)}
            </StatusNote>
            <Field label="Reason" optional hint="Kept on record so the decision can be explained later.">
              <textarea
                className={controlClass}
                rows={4}
                value={revokeReason}
                placeholder="For example: issued in error, or the completion was reversed."
                onChange={(event) => setRevokeReason(event.target.value)}
              />
            </Field>
            {revokeError && <StatusNote tone="error">{revokeError}</StatusNote>}
          </form>
        )}
      </Drawer>
    </>
  );
}

export default CertificatesTab;
