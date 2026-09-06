'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Tab = 'overview' | 'staff' | 'announcements' | 'flags' | 'marketing';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'speedometer2' },
  { id: 'staff', label: 'Staff & Users', icon: 'people' },
  { id: 'announcements', label: 'Announcements', icon: 'megaphone' },
  { id: 'flags', label: 'Feature Flags', icon: 'toggles' },
  { id: 'marketing', label: 'Marketing', icon: 'send' },
];

interface AdminStats {
  users: { total: number; students: number; instructors: number; admins: number; new_last_30_days: number };
  courses: { total: number; published: number; draft: number };
  enrollments: { total: number; active: number; completed: number };
  live_classes?: { total: number };
  applications?: { total: number; pending: number };
}

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

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm transition-all focus:border-navy-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-900/20';

export function AdminHome() {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Staff form state
  const [invite, setInvite] = useState({ email: '', full_name: '', role: 'instructor' });
  const [staffMsg, setStaffMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [knownStaff, setKnownStaff] = useState<{ id: string; email: string; full_name: string; role: string; active: boolean }[]>([]);
  const [targetId, setTargetId] = useState('');

  // Announcements state
  const [ann, setAnn] = useState({ title: '', body: '' });
  const [annMsg, setAnnMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  // Flags state
  const [flags, setFlags] = useState<{ key: string; value: string }[]>([]);
  const [flagMsg, setFlagMsg] = useState('');

  // Marketing state
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const loadAll = useCallback(() => {
    api.request('/admin/dashboard/').then(setStats).catch(() => setStats(null));
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
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

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

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffMsg(null);
    try {
      const created = await post('/admin/dashboard/staff/invite/', invite);
      setStaffMsg({ ok: true, text: `${invite.full_name} (${invite.role}) invited successfully.` });
      if (created?.id || created?.user?.id) {
        setKnownStaff((prev) => [
          {
            id: created.id ?? created.user?.id,
            email: invite.email,
            full_name: invite.full_name,
            role: invite.role,
            active: true,
          },
          ...prev,
        ]);
      }
      setInvite({ email: '', full_name: '', role: 'instructor' });
      loadAll();
    } catch (err: any) {
      setStaffMsg({ ok: false, text: err.message });
    }
  };

  const staffAction = async (action: 'deactivate' | 'activate' | 'promote', user_id: string) => {
    setStaffMsg(null);
    try {
      await post(`/admin/dashboard/staff/${action}/`, { user_id, role: 'admin' });
      setStaffMsg({ ok: true, text: `User ${action}d successfully.` });
      setKnownStaff((prev) =>
        prev.map((s) => (s.id === user_id ? { ...s, active: action !== 'deactivate' } : s))
      );
    } catch (err: any) {
      setStaffMsg({ ok: false, text: err.message });
    }
  };

  const handleAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnnMsg(null);
    try {
      await post('/admin/announcements/', { title: ann.title, body: ann.body });
      setAnnMsg({ ok: true, text: 'Announcement created. Publish it when ready.' });
      setAnn({ title: '', body: '' });
      loadAll();
    } catch (err: any) {
      setAnnMsg({ ok: false, text: err.message });
    }
  };

  const publishAnnouncement = async (id: string) => {
    try {
      await post(`/admin/announcements/${id}/publish/`, {});
      setAnnMsg({ ok: true, text: 'Announcement published.' });
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
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-bold transition-all',
              tab === t.id
                ? 'bg-navy-950 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-navy-50'
            )}
          >
            <i className={cn('bi', `bi-${t.icon}`, 'mr-1.5')} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {!stats ? (
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

              {/* Quick actions */}
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { tab: 'staff' as Tab, icon: 'bi-person-plus', title: 'Invite a tutor or admin', text: 'Add team members with roles' },
                  { tab: 'announcements' as Tab, icon: 'bi-megaphone', title: 'Post an announcement', text: 'Reach every student in-app' },
                  { tab: 'flags' as Tab, icon: 'bi-toggles', title: 'Toggle features', text: 'Enable or disable platform features' },
                ].map((a) => (
                  <button
                    key={a.title}
                    type="button"
                    onClick={() => setTab(a.tab)}
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

      {/* Staff & Users */}
      {tab === 'staff' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleInvite} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-1 font-black text-navy-950">Invite Tutor / Admin</h3>
            <p className="mb-5 text-xs text-gray-500">
              Creates the account immediately — share the password with them to start.
            </p>
            <div className="space-y-4">
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
              <button
                type="submit"
                className="w-full rounded-xl bg-gold-brand py-3.5 font-bold text-navy-950 shadow-md transition-all hover:bg-gold-hover"
              >
                Create Account
              </button>
            </div>
          </form>

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-1 font-black text-navy-950">Manage Accounts</h3>
            <p className="mb-5 text-xs text-gray-500">
              Deactivating blocks login instantly and revokes their sessions.
            </p>

            {knownStaff.length > 0 && (
              <ul className="mb-5 divide-y divide-gray-100">
                {knownStaff.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-bold text-navy-950">{s.full_name}</p>
                      <p className="text-xs text-gray-500">
                        {s.email} · {s.role} · {s.active ? 'active' : 'disabled'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => staffAction(s.active ? 'deactivate' : 'activate', s.id)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-bold',
                        s.active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-teal-brand/10 text-teal-700'
                      )}
                    >
                      {s.active ? 'Disable' : 'Enable'}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-400">
              Act on a user by ID (from Django admin)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="user id"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className={cn(inputCls, 'font-mono')}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(['deactivate', 'activate', 'promote'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  disabled={!targetId}
                  onClick={() => staffAction(a, targetId)}
                  className="rounded-lg bg-navy-950 px-4 py-2 text-xs font-bold capitalize text-white transition-colors hover:bg-navy-900 disabled:opacity-40"
                >
                  {a}
                </button>
              ))}
            </div>

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
            <p className="mt-4 text-xs text-gray-400">
              Full user list: <a href="https://api.vaceup.ng/admin/" target="_blank" rel="noopener noreferrer" className="underline">Django admin → Users</a>
            </p>
          </div>
        </div>
      )}

      {/* Announcements */}
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

      {/* Feature Flags */}
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
                <li key={f.key ?? f.id} className="flex items-center justify-between gap-4 py-3">
                  <span className="font-mono text-sm text-navy-950">{f.key}</span>
                  <div className="flex items-center gap-2">
                    <input
                      defaultValue={f.value}
                      onBlur={(e) => {
                        if (e.target.value !== f.value) saveFlag(f.key, e.target.value);
                      }}
                      className="w-48 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-navy-900 focus:outline-none"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {flagMsg && <p className="mt-3 text-xs font-bold text-teal-700">{flagMsg}</p>}
        </div>
      )}

      {/* Marketing */}
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
