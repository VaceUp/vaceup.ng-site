'use client';

import { useEffect, useRef, useState } from 'react';
import { api, type PaginatedResponse } from '@/lib/api';
import { managedCourses, failureMessage, type ManagedCourse } from '@/lib/course-management';
import { Action, Field, Feedback, styles } from './AuthoringUI';

type Student = { id: number; full_name: string; email: string; is_active: boolean };

export default function ManualEnrollmentForm({ onGranted }: { onGranted: () => void }) {
  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [studentId, setStudentId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [source, setSource] = useState('legacy_paid_student');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const pending = useRef<{ payload: string; id: string } | null>(null);
  async function loadCourses() {
    setLoading(true); setError('');
    try { setCourses((await managedCourses()).filter(course => course.is_published)); }
    catch (err) { setError(failureMessage(err)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadCourses(); }, []);
  const student = students.find(item => String(item.id) === studentId);
  const course = courses.find(item => String(item.id) === courseId);
  return <section className={styles.root + ' ' + styles.panel + ' ' + styles.stack} aria-labelledby="manual-enrollment-title">
    <h3 id="manual-enrollment-title">Activate previously paid student</h3>
    <p className={styles.muted}>For students who paid by transfer, cash or before this platform existed. Verify your records first. This grants course access without a new charge; it does not create a Paystack payment, change course progress or bypass a suspension.</p>
    <Feedback error={error} message={message} />
    <form className={styles.row} onSubmit={async event => {
      event.preventDefault(); setSearching(true); setError(''); setStudents([]); setStudentId(''); setConfirmed(false);
      try {
        const result = await api.request<PaginatedResponse<Student>>('/admin/dashboard/users/?role=student&search=' + encodeURIComponent(search.trim()));
        setStudents(result.results.filter(item => item.is_active));
        setMessage(result.next ? 'More students match. Refine the search using their email if needed.' : 'Choose the matching active student below. If missing, check their account under Users.');
      } catch (err) { setError(failureMessage(err)); }
      finally { setSearching(false); }
    }}>
      <Field label="Find student by name or email"><input required minLength={2} value={search} disabled={busy || searching} onChange={event => setSearch(event.target.value)} /></Field>
      <Action type="submit" loading={searching} disabled={busy}>Find student</Action>
    </form>
    <form className={styles.stack} onSubmit={async event => {
      event.preventDefault(); if (busy || !student || !course || !confirmed) return;
      setBusy(true); setError(''); setMessage('');
      const data = { student_id: student.id, course_id: course.id, source, reason: reason.trim(), payment_reference: reference.trim(), confirmed };
      const payload = JSON.stringify(data);
      if (pending.current?.payload !== payload) pending.current = { payload, id: crypto.randomUUID() };
      try {
        const result = await api.request<{ status: string }>('/admin/dashboard/enrollments/grant/', { method: 'POST', body: JSON.stringify({ ...data, request_id: pending.current.id }) });
        setMessage(result.status === 'suspended' ? 'This request was already processed, but access is now suspended. No suspension was changed.' : student.full_name + ' has ' + result.status + ' access to ' + course.title + '. No new payment was collected.');
        setConfirmed(false); pending.current = null; onGranted();
      } catch (err) { setError(failureMessage(err)); }
      finally { setBusy(false); }
    }}>
      <Field label="Student"><select required value={studentId} disabled={busy || searching} onChange={event => { setStudentId(event.target.value); setConfirmed(false); }}><option value="">Choose a student from your search</option>{students.map(item => <option key={item.id} value={item.id}>{item.full_name} / {item.email}</option>)}</select></Field>
      <Field label="Published course"><select required value={courseId} disabled={busy || loading} onChange={event => { setCourseId(event.target.value); setConfirmed(false); }}><option value="">Choose a published course</option>{courses.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field>
      <Action loading={loading} disabled={busy} onClick={loadCourses}>Refresh courses</Action>
      <Field label="Payment source"><select value={source} disabled={busy} onChange={event => { setSource(event.target.value); setConfirmed(false); }}><option value="legacy_paid_student">Existing student who already paid</option><option value="external_payment">Payment received outside the platform</option></select></Field>
      <Field label="Receipt or payment reference (optional)"><input maxLength={120} value={reference} disabled={busy} onChange={event => setReference(event.target.value)} /></Field>
      <Field label="Verification note for the admin audit log"><textarea required minLength={10} maxLength={1000} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></Field>
      <p className={styles.muted}>Describe the record you checked. Do not enter passwords, card numbers or bank-account credentials.</p>
      <label className={styles.check}><input type="checkbox" required checked={confirmed} disabled={busy || !student || !course} onChange={event => setConfirmed(event.target.checked)} /><span>I verified payment and want to activate {student?.full_name || 'the selected student'} for {course?.title || 'the selected course'} without a new charge.</span></label>
      <Action intent="primary" type="submit" loading={busy} disabled={!confirmed || !student || !course || reason.trim().length < 10}>Activate course access</Action>
    </form>
  </section>;
}
