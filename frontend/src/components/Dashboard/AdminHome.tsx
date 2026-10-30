'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminHref, type AdminTab as Tab } from '@/lib/admin-sections';
import { useAdminTab } from '@/lib/use-admin-tab';
import AdminGuide from './admin/AdminGuide';
import CourseManager from './admin/CourseManager';
import MarketingManager from './admin/MarketingManager';
import PlatformSettings from './admin/PlatformSettings';
import DeleteUserDialog from './admin/DeleteUserDialog';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';
import { Action, Feedback, styles as authoringStyles } from './admin/AuthoringUI';
import { cn } from '@/lib/utils';
import LiveClassesTab from '@/components/Dashboard/admin/LiveClassesTab';
import ContentTab from '@/components/Dashboard/admin/ContentTab';
import AssessmentWorkspace from './AssessmentWorkspace';
import CertificatesTab from '@/components/Dashboard/admin/CertificatesTab';
import EnrollmentsTab from '@/components/Dashboard/admin/EnrollmentsTab';
import AnnouncementsManager from '@/components/Dashboard/admin/AnnouncementsManager';
import WebsiteManager from '@/components/Dashboard/admin/WebsiteManager';
import EventsManager from '@/components/Dashboard/admin/EventsManager';
import BlogManager from '@/components/Dashboard/admin/BlogManager';

interface AdminStats {
  users: { total: number; students: number; instructors: number; admins: number; new_last_30_days: number };
  courses: { total: number; published: number; draft: number };
  enrollments: { total: number; active: number; completed: number; revenue_last_30_days?: string };
  live_classes?: { total: number };
  applications?: { pending: number };
}

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'instructor' | 'student';
  is_active: boolean;
  date_joined: string;
}

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm transition-all focus:border-navy-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-900/20';

function Card({ label, value, icon }: { label: string; value: React.ReactNode; icon: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy-900">
        <i className={cn('bi', icon)} aria-hidden="true" />
      </span>
      <div className="text-3xl font-black text-navy-950">{value}</div>
      <div className="mt-1 text-sm text-gray-500">{label}</div>
    </div>
  );
}

function naira(v: number | string) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(parseFloat(String(v)) || 0);
}

function adminReadError(error: unknown, section: string) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Sign in again, then retry.';
    if (error.status === 403) return 'This account cannot access this section. Ask an authorised administrator to check your access.';
    if (error.status >= 500) return `The server could not load ${section}. Retry shortly. If it continues, contact support with the time of the failure.`;
    return error.message;
  }
  return `We could not reach the API to load ${section}. Check your connection and retry. This does not mean records were removed.`;
}


export function AdminHome() {
  const tab = useAdminTab();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState('');
  const [statsLoading, setStatsLoading] = useState(false);

  // ── Users ──
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRole, setUserRole] = useState('');
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [usersCount, setUsersCount] = useState(0);
  const [usersNext, setUsersNext] = useState(false);
  const usersQuery = useRef({ search: '', role: '', page: 1 });
  const usersRequest = useRef(0);
  const usersAbort = useRef<AbortController | null>(null);
  const [invite, setInvite] = useState({ email: '', full_name: '', role: 'instructor' });
  const [staffMsg, setStaffMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  // ── Applications ──
  const [applications, setApplications] = useState<any[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appMsg, setAppMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  // ── Payments ──
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);

  const loadStats = useCallback(() => {
    setStatsLoading(true);
    api
      .request('/admin/dashboard/')
      .then((res) => {
        setStats(res as AdminStats);
        setStatsError('');
      })
      .catch((err) => {
        setStatsError(adminReadError(err, 'platform statistics'));
      }).finally(() => setStatsLoading(false));
  }, []);

  const loadUsers = useCallback(
    async (search = usersQuery.current.search, role = usersQuery.current.role, page = usersQuery.current.page) => {
      const version = ++usersRequest.current;
      usersAbort.current?.abort();
      const controller = new AbortController();
      usersAbort.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), 20000);
      usersQuery.current = { search, role, page };
      setUsersLoading(true);
      setUsersError('');
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (role) params.set('role', role);
      params.set('page', String(page));
      try {
        const result = await api.request<AdminUser[] | { results: AdminUser[]; count: number; next: string | null }>(`/admin/dashboard/users/?${params.toString()}`, { signal: controller.signal, cache: 'no-store' });
        const rows = Array.isArray(result) ? result : result.results;
        if (!Array.isArray(rows)) throw new Error('Invalid directory response');
        if (version !== usersRequest.current) return;
        setUsers(rows);
        setUsersPage(page);
        setUsersCount(Array.isArray(result) ? rows.length : result.count);
        setUsersNext(!Array.isArray(result) && !!result.next);
      } catch (error) {
        if (version === usersRequest.current) setUsersError(adminReadError(error, 'the user directory'));
      } finally {
        window.clearTimeout(timeout);
        if (version === usersRequest.current) setUsersLoading(false);
      }
    },
    []
  );

  const loadApplications = useCallback(() => {
    setAppsLoading(true);
    api
      .request('/applications/')
      .then((res: any) => setApplications(res.results ?? res ?? []))
      .catch(() => setApplications([]))
      .finally(() => setAppsLoading(false));
  }, []);

  const loadPayments = useCallback(() => {
    setPaymentsLoading(true);
    api
      .request('/admin/dashboard/payments/')
      .then((res: any) => setPayments(res.results ?? res ?? []))
      .catch(() => setPayments([]))
      .finally(() => setPaymentsLoading(false));
  }, []);

  // Request only the section being viewed; one failing service must not clear other lists.
  const loadAll = useCallback(() => {
    if (tab === 'overview') loadStats();
    if (tab === 'users') void loadUsers();
    if (tab === 'applications') loadApplications();
    if (tab === 'payments') loadPayments();
  }, [tab, loadStats, loadUsers, loadApplications, loadPayments]);
  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => () => { usersRequest.current++; usersAbort.current?.abort(); }, []);

  const setTabAndHash = (t: Tab) => {
    router.push(adminHref(t));
  };

  const post = (url: string, body: unknown) => api.request(url, { method: 'POST', body: JSON.stringify(body) });

  // ── User actions ──
  const userAction = async (action: 'deactivate' | 'activate' | 'promote', user_id: string) => {
    if (!/^\d+$/.test(String(user_id))) {
      setStaffMsg({
        ok: false,
        text: 'That user identifier is invalid. Refresh the directory and try again.',
      });
      return;
    }
    setStaffMsg(null);
    try {
      await post(`/admin/dashboard/staff/${action}/`, { user_id: String(user_id), role: 'admin' });
      setStaffMsg({ ok: true, text: `User ${action}d successfully.` });
      loadUsers();
    } catch (err: any) {
      setStaffMsg({ ok: false, text: err.message });
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffMsg(null);
    try {
      await post('/admin/dashboard/staff/invite/', invite);
      setStaffMsg({
        ok: true,
        text: 'Account created. A password setup email has been requested. If it does not arrive, ask them to use Forgot password.',
      });
      setInvite({ email: '', full_name: '', role: 'instructor' });
      loadUsers();
      loadAll();
    } catch (err: any) {
      setStaffMsg({ ok: false, text: err.message });
    }
  };

  // ── Application actions ──
  const reviewApplication = async (id: string, action: 'approve' | 'reject') => {
    setAppMsg(null);
    try {
      await post(`/applications/${id}/review/`, { action });
      setAppMsg({ id, ok: true, text: action === 'approve'
        ? 'Application approved. Paid courses still require payment or an explicit off-platform access grant.'
        : 'Application rejected. Course access has not been granted.' });
      loadApplications();
      loadAll();
    } catch (err: any) {
      setAppMsg({ id, ok: false, text: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <AdminGuide currentTab={tab} onNavigate={setTabAndHash} />
      {/* ═══ Overview ═══ */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {statsError && <div className={`${authoringStyles.root} ${authoringStyles.stack}`}><Feedback error={statsError} />
            {stats && <p>Showing the last statistics we could load.</p>}
            <div><Action loading={statsLoading} onClick={loadStats}>Retry statistics</Action></div></div>}
          {!stats && !statsError ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-200" />
              ))}
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Card icon="bi-people" label="Total Users" value={stats.users?.total ?? 0} />
                <Card icon="bi-mortarboard" label="Students" value={stats.users?.students ?? 0} />
                <Card icon="bi-person-badge" label="Tutors" value={stats.users?.instructors ?? 0} />
                <Card icon="bi-shield-lock" label="Admins" value={stats.users?.admins ?? 0} />
                <Card icon="bi-book" label="Courses" value={stats.courses?.total ?? 0} />
                <Card icon="bi-check-circle" label="Published" value={stats.courses?.published ?? 0} />
                <Card icon="bi-activity" label="Active Enrollments" value={stats.enrollments?.active ?? 0} />
                <Card icon="bi-person-plus" label="New (30 days)" value={stats.users?.new_last_30_days ?? 0} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { tab: 'users' as Tab, icon: 'bi-person-plus', title: 'Invite a tutor or admin', text: 'Add team members with roles' },
                  { tab: 'courses' as Tab, icon: 'bi-book', title: 'Create a course', text: 'Build and publish a new program' },
                  { tab: 'applications' as Tab, icon: 'bi-file-earmark-text', title: 'Review applications', text: 'Approve or reject student applications' },
                  { tab: 'website' as Tab, icon: 'bi-globe2', title: 'Update the public website', text: 'About page, events and blog' },
                ].map((a) => (
                  <button
                    key={a.title}
                    type="button"
                    onClick={() => setTabAndHash(a.tab)}
                    className="rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <i className={cn('bi', a.icon, 'text-2xl text-gold-700')} aria-hidden="true" />
                    <h3 className="mt-3 font-bold text-navy-950">{a.title}</h3>
                    <p className="text-xs text-gray-500">{a.text}</p>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ═══ Users ═══ */}
      {tab === 'users' && (
        <div className="space-y-5">
          {/* Invite */}
          <form onSubmit={handleInvite} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-1 font-black text-navy-950">Create Tutor / Admin Account</h3>
            <p className="mb-5 text-xs text-gray-500">
              A password-setup email is requested after the account is created. Delivery depends on the mail queue.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <input
                type="text"
                required
                placeholder="Full name"
                value={invite.full_name}
                onChange={(e) => setInvite({ ...invite, full_name: e.target.value })}
                className={inputCls}
              />
              <input
                type="email"
                required
                placeholder="Email address"
                value={invite.email}
                onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                className={inputCls}
              />
              <select
                value={invite.role}
                onChange={(e) => setInvite({ ...invite, role: e.target.value })}
                className={inputCls}
              >
                <option value="instructor">Tutor (Instructor)</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              type="submit"
              className="mt-4 rounded-xl bg-gold-brand px-8 py-3 font-bold text-navy-950 shadow-md transition-all hover:bg-gold-hover"
            >
              Create Account
            </button>
            {staffMsg && (
              <p
                className={cn(
                  'mt-4 rounded-xl px-4 py-3 text-sm',
                  staffMsg.ok ? 'bg-teal-brand/10 text-teal-700' : 'bg-red-50 text-red-700'
                )}
              >
                {staffMsg.text}
              </p>
            )}
          </form>

          {/* Directory */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-black text-navy-950">User Directory</h3>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                placeholder="Search by email or name…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                aria-label="Search users by email or name"
                onKeyDown={(e) => e.key === 'Enter' && void loadUsers(userSearch, userRole, 1)}
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-navy-900 focus:bg-white focus:outline-none"
              />
              <select
                value={userRole}
                onChange={(e) => {
                  setUserRole(e.target.value);
                  void loadUsers(userSearch, e.target.value, 1);
                }}
                aria-label="Filter users by role"
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm sm:w-44"
              >
                <option value="">All roles</option>
                <option value="student">Students</option>
                <option value="instructor">Tutors</option>
                <option value="admin">Admins</option>
              </select>
              <button
                type="button"
                onClick={() => void loadUsers(userSearch, userRole, 1)}
                className="rounded-xl bg-navy-950 px-5 py-2.5 text-sm font-bold text-white"
              >
                Search
              </button>
            </div>

            {usersError && <div className={`${authoringStyles.root} ${authoringStyles.stack}`}><Feedback error={usersError} />
              {users.length > 0 && <p>Showing the last directory results we could load. Your requested search or page may not be shown yet.</p>}
              <div><Action loading={usersLoading} onClick={() => void loadUsers()}>Retry user directory</Action></div></div>}
            {usersLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />
                ))}
              </div>
            ) : users.length === 0 && !usersError ? (
              <p className="text-sm text-gray-500">No users match.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {users.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-navy-950">
                        {u.full_name || '(no name)'}{' '}
                        {!u.is_active && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                            DISABLED
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {u.email} · <span className="capitalize">{u.role}</span> · joined{' '}
                        {new Date(u.date_joined).toLocaleDateString('en-NG')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => userAction(u.is_active ? 'deactivate' : 'activate', u.id)}
                        className={cn(
                          'rounded-lg px-3 py-1.5 text-xs font-bold',
                          u.is_active
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-teal-brand/10 text-teal-700 hover:bg-teal-brand/20'
                        )}
                      >
                        {u.is_active ? 'Disable' : 'Enable'}
                      </button>
                      {u.role !== 'admin' && (
                        <button
                          type="button"
                          onClick={() => userAction('promote', u.id)}
                          className="rounded-lg bg-navy-50 px-3 py-1.5 text-xs font-bold text-navy-900 hover:bg-navy-100"
                        >
                          Make Admin
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const pw = window.prompt(`New password for ${u.full_name || u.email}:`);
                          if (!pw) return;
                          setStaffMsg(null);
                          fetch(`${api.baseUrl}/admin/dashboard/users/password/`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${api.getToken()}`,
                            },
                            body: JSON.stringify({ user_id: u.id, new_password: pw }),
                          })
                            .then(async (res) => {
                              const data = await res.json().catch(() => ({}));
                              const detail =
                                data.detail || data.error?.detail || 'Password updated.';
                              setStaffMsg({ ok: res.ok, text: detail });
                            })
                            .catch(() => setStaffMsg({ ok: false, text: 'Password update failed.' }));
                        }}
                        className="rounded-lg bg-navy-50 px-3 py-1.5 text-xs font-bold text-navy-900 hover:bg-navy-100"
                      >
                        Set Password
                      </button>
                      {u.role !== 'admin' && <Button variant="destructive" size="sm" className="rounded-lg" onClick={() => setDeleteTarget(u)} aria-label={`Permanently delete ${u.full_name || u.email}`}>Delete user</Button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!usersLoading && usersCount > 0 && <nav aria-label="User directory pages" className={`${authoringStyles.root} ${authoringStyles.row}`}>
              <Action disabled={usersPage <= 1} onClick={() => void loadUsers(usersQuery.current.search, usersQuery.current.role, usersPage - 1)}>Previous users</Action>
              <span>Page {usersPage} / {usersCount} users</span>
              <Action disabled={!usersNext} onClick={() => void loadUsers(usersQuery.current.search, usersQuery.current.role, usersPage + 1)}>Next users</Action>
            </nav>}
            {staffMsg && (
              <p
                className={cn(
                  'mt-4 rounded-xl px-4 py-3 text-sm',
                  staffMsg.ok ? 'bg-teal-brand/10 text-teal-700' : 'bg-red-50 text-red-700'
                )}
              >
                {staffMsg.text}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ═══ Courses ═══ */}
      {deleteTarget && <DeleteUserDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={(id) => {
        setUsers((current) => current.filter((item) => String(item.id) !== String(id)));
        void loadUsers(usersQuery.current.search, usersQuery.current.role, 1);
        setStaffMsg({ ok: true, text: 'User and the listed database records were permanently deleted. Backups, external files and audit records were retained.' });
      }} />}
      {tab === 'courses' && <CourseManager />}

      {/* ═══ Content Manager ═══ */}
      {tab === 'content' && <ContentTab />}

      {/* ═══ Live Classes ═══ */}
      {tab === 'liveclasses' && <LiveClassesTab />}

      {/* ═══ Assignments & Quizzes ═══ */}
      {tab === 'assignments' && <AssessmentWorkspace />}

      {/* ═══ Certificates ═══ */}
      {tab === 'certificates' && <CertificatesTab />}

      {/* ═══ Enrollments ═══ */}
      {tab === 'enrollments' && <EnrollmentsTab />}

      {/* ═══ Applications ═══ */}
      {tab === 'applications' && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-black text-navy-950">Applications</h3>
          {appsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : applications.length === 0 ? (
            <p className="text-sm text-gray-500">No applications yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {applications.map((a: any) => {
                const status = a.status;
                const pending = status === 'submitted' || status === 'under_review';
                return (
                  <li key={a.id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-navy-950">
                          {a.student?.full_name || a.student_name || 'Applicant'} →{' '}
                          {a.course?.title || a.course_title || a.course}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-gray-600">{a.motivation}</p>
                        <p className="mt-1 text-[11px] text-gray-400">
                          {a.submitted_at
                            ? new Date(a.submitted_at).toLocaleDateString('en-NG')
                            : ''}{' '}
                          · status: {status}
                        </p>
                      </div>
                      {pending ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => reviewApplication(a.id, 'approve')}
                            className="rounded-lg bg-teal-brand/10 px-4 py-2 text-xs font-bold text-teal-700 hover:bg-teal-brand/20"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const reason = window.prompt('Rejection reason (optional):') ?? '';
                              reviewApplication(a.id, 'reject');
                              void reason;
                            }}
                            className="rounded-lg bg-red-50 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span
                          className={cn(
                            'rounded-full px-3 py-1 text-xs font-bold capitalize',
                            status === 'approved'
                              ? 'bg-teal-brand/10 text-teal-700'
                              : status === 'rejected'
                                ? 'bg-red-50 text-red-600'
                                : 'bg-gray-100 text-gray-600'
                          )}
                        >
                          {status}
                        </span>
                      )}
                    </div>
                    {appMsg && appMsg.id === a.id && (
                      <p
                        className={cn(
                          'mt-2 rounded-lg px-3 py-2 text-xs',
                          appMsg.ok ? 'bg-teal-brand/10 text-teal-700' : 'bg-red-50 text-red-700'
                        )}
                      >
                        {appMsg.text}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ═══ Payments ═══ */}
      {tab === 'payments' && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-black text-navy-950">All Payments</h3>
          {paymentsLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <p className="text-sm text-gray-500">No payments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                    <th className="pb-2 pr-4">Student</th>
                    <th className="pb-2 pr-4">Course</th>
                    <th className="pb-2 pr-4">Amount</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payments.map((p: any) => (
                    <tr key={p.id ?? p.reference}>
                      <td className="py-3 pr-4 font-semibold text-navy-950">
                        {p.student?.full_name || p.student || '—'}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">{p.course?.title ?? '—'}</td>
                      <td className="py-3 pr-4 font-bold text-navy-950">{naira(p.amount)}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-1 text-[11px] font-bold capitalize',
                            p.status === 'success'
                              ? 'bg-teal-brand/10 text-teal-700'
                              : p.status === 'pending'
                                ? 'bg-gold-light text-gold-800'
                                : 'bg-red-50 text-red-600'
                          )}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-xs text-gray-500">
                        {String(p.reference).slice(0, 18)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ Announcements ═══ */}
      {tab === 'announcements' && <AnnouncementsManager />}

      {/* ═══ Public website ═══ */}
      {tab === 'website' && <WebsiteManager />}
      {tab === 'events' && <EventsManager />}
      {tab === 'blog' && <BlogManager />}

      {tab === 'flags' && <PlatformSettings />}
      {tab === 'marketing' && <MarketingManager />}
    </div>
  );
}

export default AdminHome;
