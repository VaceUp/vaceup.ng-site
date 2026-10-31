'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { api, type PaginatedResponse } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { formatWorkspaceDate } from '@/lib/workspace-api';
import DeleteUserDialog from './DeleteUserDialog';
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
 * People directory: invite tutors and administrators, find an account, and
 * manage its access from one drawer instead of a strip of row buttons.
 */

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'instructor' | 'student';
  is_active: boolean;
  date_joined: string;
}

const ROLE_LABEL: Record<AdminUser['role'], string> = {
  admin: 'Administrator',
  instructor: 'Tutor',
  student: 'Student',
};

const ROLE_ICON: Record<AdminUser['role'], string> = {
  admin: 'bi-person-badge',
  instructor: 'bi-easel',
  student: 'bi-mortarboard',
};

export default function UsersTab() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [query, setQuery] = useState({ search: '', role: '' });
  const [applied, setApplied] = useState({ search: '', role: '' });
  const [page, setPage] = useState(1);

  const path = useMemo(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (applied.search.trim()) params.set('search', applied.search.trim());
    if (applied.role) params.set('role', applied.role);
    return `/admin/dashboard/users/?${params.toString()}`;
  }, [applied, page]);
  const resource = useWorkspaceResource<PaginatedResponse<AdminUser>>(path);
  const rows = resource.data?.results ?? [];
  const count = resource.data?.count ?? 0;

  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ full_name: '', email: '', role: 'instructor' });
  const [inviteError, setInviteError] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);

  const [managingId, setManagingId] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({ next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [confirmPromote, setConfirmPromote] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const managing = rows.find((row) => row.id === managingId) ?? null;

  function search(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setApplied({ search: query.search, role: query.role });
  }

  async function inviteTeammate(event: FormEvent) {
    event.preventDefault();
    if (inviteBusy) return;
    setInviteBusy(true);
    setInviteError('');
    try {
      await api.request('/admin/dashboard/staff/invite/', { method: 'POST', body: JSON.stringify(invite) });
      toast.push(`${invite.full_name || invite.email} was invited. A password setup email is requested.`, 'success');
      setInvite({ full_name: '', email: '', role: 'instructor' });
      setInviteOpen(false);
      resource.refresh();
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'The account could not be created.');
    } finally {
      setInviteBusy(false);
    }
  }

  async function setAccountState(row: AdminUser, active: boolean) {
    if (accountBusy) return;
    setAccountBusy(true);
    setAccountError('');
    try {
      await api.request(`/admin/dashboard/staff/${active ? 'activate' : 'deactivate'}/`, {
        method: 'POST',
        body: JSON.stringify({ user_id: row.id }),
      });
      toast.push(`${row.full_name || row.email} can ${active ? 'sign in again' : 'no longer sign in'}.`, 'success');
      resource.refresh();
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'The account could not be updated.');
    } finally {
      setAccountBusy(false);
    }
  }

  async function promote(row: AdminUser) {
    if (accountBusy) return;
    setAccountBusy(true);
    setAccountError('');
    try {
      await api.request('/admin/dashboard/staff/promote/', { method: 'POST', body: JSON.stringify({ user_id: row.id }) });
      toast.push(`${row.full_name || row.email} is now an administrator.`, 'success');
      setConfirmPromote(null);
      resource.refresh();
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'The account could not be promoted.');
    } finally {
      setAccountBusy(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (!managing || passwordBusy) return;
    if (passwords.next !== passwords.confirm) {
      setPasswordError('Both entries must match.');
      return;
    }
    setPasswordBusy(true);
    setPasswordError('');
    try {
      await api.request('/admin/dashboard/users/password/', {
        method: 'POST',
        body: JSON.stringify({ user_id: managing.id, new_password: passwords.next }),
      });
      toast.push(`Password updated for ${managing.full_name || managing.email}. They will sign in with it next time.`, 'success');
      setPasswords({ next: '', confirm: '' });
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'The password could not be changed.');
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <>
      <AdminSection
        title="Invite a teammate"
        description="Tutors and administrators receive a password setup email. Create the account here, then send them the dashboard link."
        actions={<Action intent="primary" onClick={() => { setInviteError(''); setInviteOpen(true); }}>Invite tutor or admin</Action>}
      >
        <div className={adminStyles.shortcuts}>
          <div>
            <p className={adminStyles.rowTitle}>Tutor</p>
            <p className={adminStyles.hint}>Builds courses, schedules classes and grades their own learners.</p>
          </div>
          <div>
            <p className={adminStyles.rowTitle}>Administrator</p>
            <p className={adminStyles.hint}>Full access to every learner, course, payment and website setting.</p>
          </div>
        </div>
      </AdminSection>

      <AdminSection
        title="User directory"
        description="Search by name or email. A disabled account keeps its records but cannot sign in."
        actions={<Action onClick={resource.refresh} disabled={resource.loading}>Refresh</Action>}
      >
        <form onSubmit={search}>
          <Toolbar label="Filter the user directory">
            <TextInput
              type="search"
              placeholder="Search by name or email"
              aria-label="Search users by name or email"
              value={query.search}
              onChange={(event) => setQuery({ ...query, search: event.target.value })}
            />
            <select
              className={controlClass}
              aria-label="Filter by role"
              value={query.role}
              onChange={(event) => {
                const role = event.target.value;
                setQuery({ ...query, role });
                setPage(1);
                setApplied({ search: query.search, role });
              }}
            >
              <option value="">All roles</option>
              <option value="student">Students</option>
              <option value="instructor">Tutors</option>
              <option value="admin">Administrators</option>
            </select>
            <Action type="submit" loading={resource.loading}>Search</Action>
          </Toolbar>
        </form>

        {resource.error && (
          <StatusNote tone="error">
            {resource.error}
            <span className={adminStyles.inlineActions}>
              <Action onClick={resource.refresh}>Retry</Action>
            </span>
          </StatusNote>
        )}

        {resource.loading && !resource.data && <Skeleton rows={6} />}

        {!resource.loading && !resource.error && rows.length === 0 && (
          <EmptyState
            icon="bi-people"
            title={applied.search || applied.role ? 'No accounts match those filters' : 'No accounts yet'}
            description={applied.search || applied.role
              ? 'Try a shorter search, or clear the role filter to see everyone.'
              : 'Invite the first tutor or administrator to get started.'}
          />
        )}

        {rows.length > 0 && (
          <AdminList label="User accounts">
            {rows.map((row) => (
              <AdminRow
                key={row.id}
                round
                placeholder={ROLE_ICON[row.role]}
                title={row.full_name || 'No name recorded'}
                badges={<>
                  {!row.is_active && <Pill tone="danger">Disabled</Pill>}
                  {me && String(me.id) === String(row.id) && <Pill tone="muted">You</Pill>}
                </>}
                meta={`${row.email} · ${ROLE_LABEL[row.role]} · joined ${formatWorkspaceDate(row.date_joined)}`}
                actions={<>
                  <Action onClick={() => { setAccountError(''); setPasswordError(''); setPasswords({ next: '', confirm: '' }); setManagingId(row.id); }}>
                    Manage account
                  </Action>
                </>}
              />
            ))}
          </AdminList>
        )}

        <Pager
          page={page}
          count={count}
          hasNext={Boolean(resource.data?.next)}
          label="User directory"
          busy={resource.loading}
          onPrev={() => setPage((value) => Math.max(1, value - 1))}
          onNext={() => setPage((value) => value + 1)}
        />
      </AdminSection>

      <Drawer
        open={inviteOpen}
        title="Invite a tutor or administrator"
        description="The account is created straight away. The person sets their own password from the email we request for them."
        onClose={() => { if (!inviteBusy) setInviteOpen(false); }}
        footer={<>
          <Action disabled={inviteBusy} onClick={() => setInviteOpen(false)}>Cancel</Action>
          <Action intent="primary" type="submit" form="invite-form" loading={inviteBusy}>Create account</Action>
        </>}
      >
        <form id="invite-form" className={formClass} onSubmit={inviteTeammate}>
          <FormGrid>
            <Field label="Full name" required>
              <TextInput
                required
                autoComplete="name"
                value={invite.full_name}
                onChange={(event) => setInvite({ ...invite, full_name: event.target.value })}
              />
            </Field>
            <Field label="Email address" required>
              <TextInput
                required
                type="email"
                autoComplete="email"
                value={invite.email}
                onChange={(event) => setInvite({ ...invite, email: event.target.value })}
              />
            </Field>
          </FormGrid>
          <Field label="Role" required hint="A tutor only sees their own courses. An administrator sees everything.">
            <select className={controlClass} value={invite.role} onChange={(event) => setInvite({ ...invite, role: event.target.value })}>
              <option value="instructor">Tutor</option>
              <option value="admin">Administrator</option>
            </select>
          </Field>
          {inviteError && <StatusNote tone="error">{inviteError}</StatusNote>}
        </form>
      </Drawer>

      <Drawer
        open={Boolean(managing)}
        title={managing ? (managing.full_name || managing.email) : 'Manage account'}
        description={managing ? `${managing.email} · ${ROLE_LABEL[managing.role]} · joined ${formatWorkspaceDate(managing.date_joined)}` : undefined}
        onClose={() => { if (!accountBusy && !passwordBusy) setManagingId(null); }}
        footer={<Action onClick={() => setManagingId(null)} disabled={accountBusy || passwordBusy}>Done</Action>}
      >
        {managing && (
          <>
            <StatusNote tone={managing.is_active ? 'ok' : 'error'}>
              {managing.is_active
                ? 'This account can sign in.'
                : 'This account is disabled. Its records are kept, but it cannot sign in.'}
            </StatusNote>

            <FormGroup title="Password">
              <form className={formClass} onSubmit={changePassword} id="account-password-form">
                <FormGrid>
                  <Field label="New password" required hint="At least 8 characters. Avoid the person's name or email.">
                    <TextInput
                      required
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={passwords.next}
                      onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
                    />
                  </Field>
                  <Field label="Repeat the password" required>
                    <TextInput
                      required
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={passwords.confirm}
                      onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
                    />
                  </Field>
                </FormGrid>
                {passwordError && <StatusNote tone="error">{passwordError}</StatusNote>}
                <div className={adminStyles.actions}>
                  <Action type="submit" loading={passwordBusy}>Set password</Action>
                </div>
              </form>
            </FormGroup>

            <FormGroup title="Access">
              {accountError && <StatusNote tone="error">{accountError}</StatusNote>}
              {managing.role === 'admin' || (me && String(me.id) === String(managing.id)) ? (
                <p className={adminStyles.hint}>
                  Access cannot be changed from here for an administrator, or for the account you are signed in with.
                  {managing.role !== 'admin' && ' Your access can only be changed by another administrator.'}
                </p>
              ) : (
                <div className={adminStyles.actions}>
                  <Action
                    intent={managing.is_active ? 'danger' : 'primary'}
                    loading={accountBusy}
                    onClick={() => void setAccountState(managing, !managing.is_active)}
                  >
                    {managing.is_active ? 'Disable sign-in' : 'Allow sign-in again'}
                  </Action>
                  <span className={adminStyles.hint}>
                    {managing.is_active
                      ? 'Signs the person out everywhere. Their course records stay intact.'
                      : 'Lets the person sign in with their existing password.'}
                  </span>
                </div>
              )}
              {managing.role === 'student' && (
                <div className={adminStyles.actions}>
                  <Action disabled={accountBusy} onClick={() => setConfirmPromote(managing)}>Make administrator</Action>
                  <span className={adminStyles.hint}>Adds full access to every section of this panel.</span>
                </div>
              )}
            </FormGroup>

            <FormGroup title="Delete account">
              <p className={adminStyles.hint}>
                Deletes the account and the records listed before you confirm. Backups, external files and audit records are kept.
                For a temporary restriction, disable sign-in instead.
              </p>
              <div className={adminStyles.actions}>
                <Action intent="danger" onClick={() => setDeleteTarget(managing)}>Delete user permanently</Action>
              </div>
            </FormGroup>
          </>
        )}
      </Drawer>

      <Drawer
        open={Boolean(confirmPromote)}
        title={confirmPromote ? `Make ${confirmPromote.full_name || confirmPromote.email} an administrator?` : 'Make administrator'}
        description="Administrators can manage every learner, course, payment and website setting. This panel has no way to undo it, so keep a written record of who asked for the change."
        onClose={() => { if (!accountBusy) setConfirmPromote(null); }}
        footer={<>
          <Action disabled={accountBusy} onClick={() => setConfirmPromote(null)}>Cancel</Action>
          <Action intent="primary" loading={accountBusy} onClick={() => confirmPromote && void promote(confirmPromote)}>
            Make administrator
          </Action>
        </>}
      >
        <StatusNote tone="info">
          {confirmPromote?.email} currently has {confirmPromote ? ROLE_LABEL[confirmPromote.role].toLowerCase() : 'limited'} access.
        </StatusNote>
      </Drawer>

      {deleteTarget && (
        <DeleteUserDialog
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setManagingId(null);
            toast.push('The user and the listed database records were permanently deleted.', 'success');
            if (rows.length === 1 && page > 1) setPage((value) => value - 1);
            else resource.refresh();
          }}
        />
      )}
    </>
  );
}
