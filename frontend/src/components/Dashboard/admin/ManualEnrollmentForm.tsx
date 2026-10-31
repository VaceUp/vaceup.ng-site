'use client';

import { useEffect, useRef, useState } from 'react';
import { api, type PaginatedResponse } from '@/lib/api';
import { managedCourses, failureMessage, type ManagedCourse } from '@/lib/course-management';
import {
  Action,
  CheckRow,
  Drawer,
  Field,
  FormGroup,
  StatusNote,
  TextInput,
  Toolbar,
  controlClass,
  formClass,
  useToast,
} from './AdminUI';

/**
 * Off-platform access grant. For a learner who paid by transfer or cash, or
 * who studied here before the platform existed. No charge is created.
 */

type Student = { id: number; full_name: string; email: string; is_active: boolean };

export default function GrantAccessDrawer({ open, onClose, onGranted }: {
  open: boolean; onClose: () => void; onGranted: () => void;
}) {
  const toast = useToast();
  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [studentId, setStudentId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [source, setSource] = useState('legacy_paid_student');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const pending = useRef<{ payload: string; id: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    managedCourses()
      .then((rows) => setCourses(rows.filter((course) => course.is_published)))
      .catch((err) => setError(failureMessage(err)))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (open) return;
    setStudents([]); setSearch(''); setStudentId(''); setCourseId(''); setSource('legacy_paid_student');
    setReason(''); setReference(''); setConfirmed(false); setError(''); setSearched(false);
  }, [open]);

  const student = students.find((item) => String(item.id) === studentId);
  const course = courses.find((item) => String(item.id) === courseId);

  async function findStudent(event: React.FormEvent) {
    event.preventDefault();
    setSearching(true);
    setError('');
    setStudents([]);
    setStudentId('');
    setConfirmed(false);
    try {
      const result = await api.request<PaginatedResponse<Student>>(`/admin/dashboard/users/?role=student&search=${encodeURIComponent(search.trim())}`);
      setStudents(result.results.filter((item) => item.is_active));
      setSearched(true);
    } catch (err) {
      setError(failureMessage(err));
    } finally {
      setSearching(false);
    }
  }

  async function grant(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !student || !course || !confirmed) return;
    setBusy(true);
    setError('');
    const data = { student_id: student.id, course_id: course.id, source, reason: reason.trim(), payment_reference: reference.trim(), confirmed };
    const payload = JSON.stringify(data);
    if (pending.current?.payload !== payload) pending.current = { payload, id: crypto.randomUUID() };
    try {
      const result = await api.request<{ status: string }>('/admin/dashboard/enrollments/grant/', {
        method: 'POST',
        body: JSON.stringify({ ...data, request_id: pending.current.id }),
      });
      pending.current = null;
      toast.push(
        result.status === 'suspended'
          ? 'This request was already processed, but the learner is suspended. No suspension was changed.'
          : `${student.full_name} has ${result.status} access to ${course.title}. No new payment was collected.`,
        result.status === 'suspended' ? 'error' : 'success',
      );
      onGranted();
      onClose();
    } catch (err) {
      setError(failureMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const canGrant = Boolean(student && course && confirmed && reason.trim().length >= 10);

  return (
    <Drawer
      open={open}
      title="Give a learner course access"
      description="For money received outside the platform, or a learner who studied here before this platform. Verify your records first — this does not create a Paystack payment."
      onClose={() => { if (!busy) onClose(); }}
      footer={<>
        <Action disabled={busy} onClick={onClose}>Cancel</Action>
        <Action intent="primary" type="submit" form="grant-access-form" loading={busy} disabled={!canGrant}>
          Activate access
        </Action>
      </>}
    >
      <form onSubmit={findStudent}>
        <Toolbar label="Find the learner">
          <TextInput
            type="search"
            required
            minLength={2}
            aria-label="Find a learner by name or email"
            value={search}
            disabled={busy || searching}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or email"
          />
          <Action type="submit" loading={searching} disabled={busy}>Find learner</Action>
        </Toolbar>
      </form>

      <form id="grant-access-form" className={formClass} onSubmit={grant}>
        <FormGroup title="Who gets access">
          <Field
            label="Learner"
            required
            error={searched && students.length === 0 ? 'No active student matches that search. Check the spelling, or find the account under Users.' : undefined}
          >
            <select
              className={controlClass}
              required
              value={studentId}
              disabled={busy || searching}
              onChange={(event) => { setStudentId(event.target.value); setConfirmed(false); }}
            >
              <option value="">{searched ? 'Choose from the search results' : 'Search for the learner first'}</option>
              {students.map((item) => <option key={item.id} value={item.id}>{item.full_name} / {item.email}</option>)}
            </select>
          </Field>
          <Field label="Published course" required hint="Draft courses cannot be granted until they are published.">
            <select
              className={controlClass}
              required
              value={courseId}
              disabled={busy || loading}
              onChange={(event) => { setCourseId(event.target.value); setConfirmed(false); }}
            >
              <option value="">{loading ? 'Loading courses…' : 'Choose a published course'}</option>
              {courses.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </Field>
        </FormGroup>

        <FormGroup title="Payment record">
          <Field label="How was it paid" required>
            <select className={controlClass} value={source} disabled={busy} onChange={(event) => { setSource(event.target.value); setConfirmed(false); }}>
              <option value="legacy_paid_student">Existing learner who already paid</option>
              <option value="external_payment">Payment received outside the platform</option>
            </select>
          </Field>
          <Field label="Receipt or transfer reference" optional hint="A bank transfer reference, receipt number or the name on the payment.">
            <TextInput maxLength={120} value={reference} disabled={busy} onChange={(event) => setReference(event.target.value)} />
          </Field>
          <Field label="Verification note" required hint="At least 10 characters. Describe the record you checked. Never enter passwords, card numbers or bank credentials.">
            <textarea
              className={controlClass}
              required
              minLength={10}
              maxLength={1000}
              rows={3}
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
        </FormGroup>

        <CheckRow
          label={<>I verified the payment and want to activate {student?.full_name || 'the selected learner'} for {course?.title || 'the selected course'} without charging them again.</>}
          checked={confirmed}
          disabled={busy || !student || !course}
          onChange={(event) => setConfirmed(event.target.checked)}
        />

        {error && <StatusNote tone="error">{error}</StatusNote>}
      </form>
    </Drawer>
  );
}
