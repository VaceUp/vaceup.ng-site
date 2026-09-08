'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminHref, type AdminTab as Tab } from '@/lib/admin-sections';
import { useAdminTab } from '@/lib/use-admin-tab';
import AdminGuide from './admin/AdminGuide';
import CategoryManager from './admin/CategoryManager';
import CourseDetailsEditor from './admin/CourseDetailsEditor';
import { getCategories, type CatalogCategory } from '@/lib/public-catalog';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import LiveClassesTab from '@/components/Dashboard/admin/LiveClassesTab';
import ContentTab from '@/components/Dashboard/admin/ContentTab';
import AssignmentsTab from '@/components/Dashboard/admin/AssignmentsTab';
import CertificatesTab from '@/components/Dashboard/admin/CertificatesTab';
import EnrollmentsTab from '@/components/Dashboard/admin/EnrollmentsTab';

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function AdminHome() {
  const tab = useAdminTab();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState('');

  // ── Users ──
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRole, setUserRole] = useState('');
  const [usersLoading, setUsersLoading] = useState(true);
  const [invite, setInvite] = useState({ email: '', full_name: '', role: 'instructor' });
  const [staffMsg, setStaffMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Courses ──
  const [courses, setCourses] = useState<any[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [instructors, setInstructors] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [courseMsg, setCourseMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newCourse, setNewCourse] = useState({
    title: '',
    category_id: '',
    instructor_id: '',
    description: '',
    level: 'beginner',
    price: '',
    is_published: false,
  });

  // ── Applications ──
  const [applications, setApplications] = useState<any[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appMsg, setAppMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  // ── Payments ──
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);

  // ── Announcements ──
  const [ann, setAnn] = useState({ title: '', body: '' });
  const [annMsg, setAnnMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  // ── Flags ──
  const [flags, setFlags] = useState<{ key: string; value: string }[]>([]);
  const [flagMsg, setFlagMsg] = useState('');

  // ── Marketing ──
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const loadAll = useCallback(() => {
    api
      .request('/admin/dashboard/')
      .then((res) => {
        setStats(res as AdminStats);
        setStatsError('');
      })
      .catch((err) => {
        setStats(null);
        setStatsError(err?.message || 'Request failed');
      });
    loadUsers();
    loadCourses();
    loadApplications();
    loadPayments();
    api
      .request('/admin/announcements/')
      .then((res: any) => setAnnouncements(res.results ?? res ?? []))
      .catch(() => undefined);
    api
      .request('/admin/settings/')
      .then((res: any) => setFlags(res.results ?? res ?? []))
      .catch(() => undefined);
    api
      .request('/marketing/campaigns/')
      .then((res: any) => setCampaigns(res.results ?? res ?? []))
      .catch(() => undefined);
    getCategories().then(setCategories).catch(() => setCourseMsg({ ok: false, text: 'Categories could not be loaded. Please refresh before creating a course.' }));
    api
      .request('/admin/dashboard/users/?role=instructor')
      .then((res: any) => setInstructors(res.results ?? res ?? []))
      .catch(() => undefined);
  }, []);

  const loadUsers = useCallback(
    (search = userSearch, role = userRole) => {
      setUsersLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (role) params.set('role', role);
      api
        .request(`/admin/dashboard/users/?${params.toString()}`)
        .then((res: any) => setUsers(res.results ?? res ?? []))
        .catch(() => setUsers([]))
        .finally(() => setUsersLoading(false));
    },
    [userSearch, userRole]
  );

  const loadCourses = useCallback(() => {
    setCoursesLoading(true);
    api
      .request('/admin/dashboard/courses/')
      .then((res: any) => setCourses(res.results ?? res ?? []))
      .catch((err) => { setCourses([]); setCourseMsg({ ok: false, text: err instanceof Error ? err.message : 'Courses could not be loaded. Please refresh and try again.' }); })
      .finally(() => setCoursesLoading(false));
  }, []);

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

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const setTabAndHash = (t: Tab) => {
    router.push(adminHref(t));
  };

  const post = async (url: string, body: any) => {
    const res = await fetch(`${api.baseUrl}${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${api.getToken()}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : JSON.stringify(data));
    return data;
  };

  // ── User actions ──
  const userAction = async (action: 'deactivate' | 'activate' | 'promote', user_id: string) => {
    if (!UUID_RE.test(user_id.trim())) {
      setStaffMsg({
        ok: false,
        text: 'That is not a valid user id. Copy the full id (UUID) from the directory above or Django admin.',
      });
      return;
    }
    setStaffMsg(null);
    try {
      await post(`/admin/dashboard/staff/${action}/`, { user_id: user_id.trim(), role: 'admin' });
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
        text: `${invite.full_name} (${invite.role}) created — share the password with them to start.`,
      });
      setInvite({ email: '', full_name: '', role: 'instructor' });
      loadUsers();
      loadAll();
      api
        .request('/admin/dashboard/users/?role=instructor')
        .then((res: any) => setInstructors(res.results ?? res ?? []))
        .catch(() => undefined);
    } catch (err: any) {
      setStaffMsg({ ok: false, text: err.message });
    }
  };

  // ── Course actions ──
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setCourseMsg(null);
    setCreating(true);
    try {
      await post('/admin/dashboard/courses/create/', {
        title: newCourse.title,
        category_id: newCourse.category_id,
        instructor_id: newCourse.instructor_id,
        description: newCourse.description,
        level: newCourse.level,
        price: parseFloat(newCourse.price) || 0,
        is_published: newCourse.is_published,
      });
      setCourseMsg({ ok: true, text: `“${newCourse.title}” created.` });
      setNewCourse({
        title: '',
        category_id: '',
        instructor_id: '',
        description: '',
        level: 'beginner',
        price: '',
        is_published: false,
      });
      setShowCreate(false);
      loadCourses();
      loadAll();
    } catch (err: any) {
      setCourseMsg({ ok: false, text: err.message });
    } finally {
      setCreating(false);
    }
  };

  const updateCourse = async (courseId: string, payload: any, okText: string) => {
    setCourseMsg(null);
    try {
      await api.request('/admin/dashboard/courses/update/', {
        method: 'POST', body: JSON.stringify({ course_id: courseId, ...payload }),
      });
      setCourseMsg({ ok: true, text: okText });
      loadCourses();
      loadAll();
    } catch (err: any) {
      setCourseMsg({ ok: false, text: err.message });
    }
  };

  // ── Application actions ──
  const reviewApplication = async (id: string, action: 'approve' | 'reject') => {
    setAppMsg(null);
    try {
      await post(`/applications/${id}/review/`, { action });
      setAppMsg({ id, ok: true, text: `Application ${action}d — the student is enrolled.` });
      loadApplications();
      loadAll();
    } catch (err: any) {
      setAppMsg({ id, ok: false, text: err.message });
    }
  };

  // ── Announcement actions ──
  const handleAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnnMsg(null);
    try {
      await post('/admin/announcements/', { title: ann.title, body: ann.body });
      setAnnMsg({ ok: true, text: 'Announcement created — publish it below.' });
      setAnn({ title: '', body: '' });
      loadAll();
    } catch (err: any) {
      setAnnMsg({ ok: false, text: err.message });
    }
  };

  const publishAnnouncement = async (id: string) => {
    try {
      await post(`/admin/announcements/${id}/publish/`, {});
      setAnnMsg({ ok: true, text: 'Published.' });
      loadAll();
    } catch (err: any) {
      setAnnMsg({ ok: false, text: err.message });
    }
  };

  const saveFlag = async (key: string, value: string) => {
    setFlagMsg('');
    try {
      await fetch(`${api.baseUrl}/admin/settings/${encodeURIComponent(key)}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify({ value }),
      });
      setFlagMsg(`Saved “${key}”.`);
    } catch {
      setFlagMsg(`Could not save “${key}”.`);
    }
  };

  const campaignAction = async (id: string, action: string) => {
    try {
      await post(`/marketing/campaigns/${id}/${action}/`, {});
      loadAll();
    } catch (err: any) {
      setFlagMsg(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <AdminGuide currentTab={tab} onNavigate={setTabAndHash} />
      {/* ═══ Overview ═══ */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {!stats && statsError ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
              <i className="bi bi-exclamation-triangle mb-3 block text-3xl text-red-400" aria-hidden="true" />
              <p className="font-bold text-red-700">Could not load platform stats</p>
              <p className="mx-auto mt-1 max-w-md break-words font-mono text-xs text-red-500">{statsError}</p>
              <p className="mx-auto mt-3 max-w-md text-xs text-gray-500">
                If this says 403: your account&apos;s <b>role</b> is not set to <code>admin</code> —
                set it in Django admin → Users → your account → Role.
              </p>
              <button
                type="button"
                onClick={loadAll}
                className="mt-4 rounded-xl bg-navy-950 px-6 py-2.5 text-sm font-bold text-white"
              >
                Retry
              </button>
            </div>
          ) : !stats ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-200" />
              ))}
            </div>
          ) : (
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

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { tab: 'users' as Tab, icon: 'bi-person-plus', title: 'Invite a tutor or admin', text: 'Add team members with roles' },
                  { tab: 'courses' as Tab, icon: 'bi-book', title: 'Create a course', text: 'Build and publish a new program' },
                  { tab: 'applications' as Tab, icon: 'bi-file-earmark-text', title: 'Review applications', text: 'Approve or reject student applications' },
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
          )}
        </div>
      )}

      {/* ═══ Users ═══ */}
      {tab === 'users' && (
        <div className="space-y-5">
          {/* Invite */}
          <form onSubmit={handleInvite} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-1 font-black text-navy-950">Create Tutor / Admin Account</h3>
            <p className="mb-5 text-xs text-gray-500">
              The account is created immediately — share the password with them to start.
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
                onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-navy-900 focus:bg-white focus:outline-none"
              />
              <select
                value={userRole}
                onChange={(e) => {
                  setUserRole(e.target.value);
                  setTimeout(() => loadUsers(), 0);
                }}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm sm:w-44"
              >
                <option value="">All roles</option>
                <option value="student">Students</option>
                <option value="instructor">Tutors</option>
                <option value="admin">Admins</option>
              </select>
              <button
                type="button"
                onClick={() => loadUsers()}
                className="rounded-xl bg-navy-950 px-5 py-2.5 text-sm font-bold text-white"
              >
                Search
              </button>
            </div>

            {usersLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />
                ))}
              </div>
            ) : users.length === 0 ? (
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
                    </div>
                  </li>
                ))}
              </ul>
            )}
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
      {tab === 'courses' && (
        <div className="space-y-6">
          <CategoryManager categories={categories} onChanged={async () => { setCategories(await getCategories()); }} />
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-navy-950">All Courses ({courses.length})</h3>
              <button
                type="button"
                onClick={() => setShowCreate((v) => !v)}
                className="rounded-xl bg-gold-brand px-5 py-2.5 text-sm font-bold text-navy-950 shadow-md transition-all hover:bg-gold-hover"
              >
                {showCreate ? 'Close' : '+ New Course'}
              </button>
            </div>

            {/* Create form */}
            {showCreate && (
              <form onSubmit={handleCreateCourse} className="mt-5 space-y-4 rounded-2xl bg-gray-50 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    type="text"
                    required
                    placeholder="Course title"
                    value={newCourse.title}
                    onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                    className={inputCls}
                  />
                  <select
                    required
                    aria-label="Course category"
                    value={newCourse.category_id}
                    onChange={(e) => setNewCourse({ ...newCourse, category_id: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">Select category…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    required
                    value={newCourse.instructor_id}
                    onChange={(e) => setNewCourse({ ...newCourse, instructor_id: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">Assign a tutor…</option>
                    {instructors.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name || t.email}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newCourse.level}
                    onChange={(e) => setNewCourse({ ...newCourse, level: e.target.value })}
                    className={inputCls}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-400">
                      Price (₦)
                    </span>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="e.g. 100000"
                      value={newCourse.price}
                      onChange={(e) => setNewCourse({ ...newCourse, price: e.target.value })}
                      className={inputCls}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-navy-950">
                    <input
                      type="checkbox"
                      checked={newCourse.is_published}
                      onChange={(e) => setNewCourse({ ...newCourse, is_published: e.target.checked })}
                      className="h-4 w-4"
                    />
                    Publish immediately
                  </label>
                </div>
                <textarea
                  rows={3}
                  placeholder="Course description…"
                  value={newCourse.description}
                  onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                  className={inputCls}
                />
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-gold-brand px-8 py-3 font-bold text-navy-950 shadow-md transition-all hover:bg-gold-hover disabled:opacity-60"
                >
                  {creating ? 'Creating…' : 'Create Course'}
                </button>
                {courseMsg && (
                  <p
                    className={cn(
                      'rounded-xl px-4 py-3 text-sm',
                      courseMsg.ok ? 'bg-teal-brand/10 text-teal-700' : 'bg-red-50 text-red-700'
                    )}
                  >
                    {courseMsg.text}
                  </p>
                )}
              </form>
            )}

            {/* List with inline management */}
            {coursesLoading ? (
              <div className="mt-5 space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />
                ))}
              </div>
            ) : courses.length === 0 ? (
              <p className="mt-5 text-sm text-gray-500">No courses yet.</p>
            ) : (
              <ul className="mt-5 divide-y divide-gray-100">
                {courses.map((c: any) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-navy-950">
                        {c.title}
                        <span
                          className={cn(
                            'ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold',
                            c.is_published
                              ? 'bg-teal-brand/10 text-teal-700'
                              : 'bg-gold-light text-gold-800'
                          )}
                        >
                          {c.is_published ? 'Published' : 'Draft'}
                        </span>
                      </p>
                      <p className="text-xs capitalize text-gray-500">
                        {c.level} · {naira(c.price)} · {categories.find((category) => category.id === c.category)?.name || 'Category unavailable'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateCourse(c.id, { is_published: !c.is_published }, 'Publish state saved.')
                        }
                        className="rounded-lg bg-navy-50 px-3 py-1.5 text-xs font-bold text-navy-900 hover:bg-navy-100"
                      >
                        {c.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const v = window.prompt(`New price for “${c.title}” (₦):`, String(c.price));
                          if (v !== null && v.trim() !== '') {
                            updateCourse(c.id, { price: parseFloat(v) }, 'Price updated.');
                          }
                        }}
                        className="rounded-lg bg-navy-50 px-3 py-1.5 text-xs font-bold text-navy-900 hover:bg-navy-100"
                      >
                        Change price
                      </button>
                    </div>
                    <CourseDetailsEditor course={c} categories={categories} instructors={instructors} onSaved={loadCourses} />
                  </li>
                ))}
              </ul>
            )}
            {courseMsg && !showCreate && (
              <p
                className={cn(
                  'mt-4 rounded-xl px-4 py-3 text-sm',
                  courseMsg.ok ? 'bg-teal-brand/10 text-teal-700' : 'bg-red-50 text-red-700'
                )}
              >
                {courseMsg.text}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ═══ Content Manager ═══ */}
      {tab === 'content' && <ContentTab />}

      {/* ═══ Live Classes ═══ */}
      {tab === 'liveclasses' && <LiveClassesTab />}

      {/* ═══ Assignments & Quizzes ═══ */}
      {tab === 'assignments' && <AssignmentsTab />}

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
      {tab === 'announcements' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleAnnouncement} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-5 font-black text-navy-950">New Announcement</h3>
            <div className="space-y-4">
              <input
                type="text"
                required
                placeholder="Title"
                value={ann.title}
                onChange={(e) => setAnn({ ...ann, title: e.target.value })}
                className={inputCls}
              />
              <textarea
                required
                rows={5}
                placeholder="Write the announcement…"
                value={ann.body}
                onChange={(e) => setAnn({ ...ann, body: e.target.value })}
                className={inputCls}
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-gold-brand py-3.5 font-bold text-navy-950 shadow-md transition-all hover:bg-gold-hover"
              >
                Create Announcement
              </button>
            </div>
          </form>

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-black text-navy-950">Published & Drafts</h3>
            {announcements.length === 0 ? (
              <p className="text-sm text-gray-500">No announcements yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {announcements.map((a: any) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-navy-950">{a.title}</p>
                      <p className="text-xs text-gray-500">
                        {a.status ?? 'draft'} · {a.target ?? 'all users'}
                      </p>
                    </div>
                    {a.status !== 'published' && (
                      <button
                        type="button"
                        onClick={() => publishAnnouncement(a.id)}
                        className="rounded-lg bg-navy-950 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Publish
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ═══ Feature Flags ═══ */}
      {tab === 'flags' && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="font-black text-navy-950">Platform Settings</h3>
          <p className="mb-5 text-xs text-gray-500">
            Key–value settings stored server-side (admin/settings API).
          </p>
          {flags.length === 0 ? (
            <p className="text-sm text-gray-500">No settings configured yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {flags.map((f) => (
                <li key={f.key} className="flex items-center justify-between gap-4 py-3">
                  <span className="font-mono text-sm text-navy-950">{f.key}</span>
                  <input
                    defaultValue={f.value}
                    onBlur={(e) => {
                      if (e.target.value !== f.value) saveFlag(f.key, e.target.value);
                    }}
                    className="w-48 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-navy-900 focus:outline-none"
                  />
                </li>
              ))}
            </ul>
          )}
          {flagMsg && <p className="mt-3 text-xs font-bold text-teal-700">{flagMsg}</p>}
        </div>
      )}

      {/* ═══ Marketing ═══ */}
      {tab === 'marketing' && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-1 font-black text-navy-950">Marketing Campaigns</h3>
          <p className="mb-5 text-xs text-gray-500">
            Email campaigns to registered users and newsletter leads (backend marketing app).
          </p>
          {campaigns.length === 0 ? (
            <p className="text-sm text-gray-500">No campaigns yet. Create them from Django admin → Marketing.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {campaigns.map((c: any) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-navy-950">{c.name ?? c.subject}</p>
                    <p className="text-xs text-gray-500">
                      {c.status} · {c.recipient_count ?? 0} recipients
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {c.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => campaignAction(c.id, 'send-now')}
                        className="rounded-lg bg-gold-brand px-3 py-1.5 text-xs font-bold text-navy-950"
                      >
                        Send now
                      </button>
                    )}
                    {c.status === 'sending' && (
                      <button
                        type="button"
                        onClick={() => campaignAction(c.id, 'pause')}
                        className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-navy-950"
                      >
                        Pause
                      </button>
                    )}
                    {c.status === 'paused' && (
                      <button
                        type="button"
                        onClick={() => campaignAction(c.id, 'resume')}
                        className="rounded-lg bg-teal-brand/10 px-3 py-1.5 text-xs font-bold text-teal-700"
                      >
                        Resume
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminHome;
