'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { failureMessage } from '@/lib/course-management';
import type { WorkspacePage } from '@/lib/workspace-api';
import { ConfirmDelete } from './AuthoringUI';
import {
  Action, AdminList, AdminRow, AdminSection, CheckRow, Drawer, EmptyState, Field, FileField,
  FormGrid, Pager, Pill, Skeleton, StatusNote, TextInput, controlClass, useToast,
} from './AdminUI';

interface ProfileForm {
  id: number | null;
  name: string;
  tagline: string;
  mission: string;
  story: string;
  location: string;
  founded_year: string;
  email: string;
  phone: string;
  linkedin_url: string;
  instagram_url: string;
  facebook_url: string;
  website_url: string;
}

interface TeamRow {
  id: number;
  name: string;
  role_title: string;
  bio: string;
  quote: string;
  image: string;
  linkedin_url: string;
  instagram_url: string;
  website_url: string;
  is_founder: boolean;
  order: number;
  is_published: boolean;
}

const emptyProfile = (): ProfileForm => ({
  id: null, name: '', tagline: '', mission: '', story: '', location: '', founded_year: '',
  email: '', phone: '', linkedin_url: '', instagram_url: '', facebook_url: '', website_url: '',
});

const emptyMember = () => ({
  name: '', role_title: '', bio: '', quote: '', image_url: '',
  linkedin_url: '', instagram_url: '', website_url: '',
  is_founder: false, order: '0', is_published: false,
});

type MemberForm = ReturnType<typeof emptyMember>;

export default function WebsiteManager() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const resource = useWorkspaceResource<WorkspacePage<TeamRow>>(`/website/team/?page=${page}`);
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile);
  const [baseline, setBaseline] = useState('');
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [member, setMember] = useState<MemberForm>(emptyMember);
  const [editing, setEditing] = useState<TeamRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<TeamRow | null>(null);

  useEffect(() => {
    let active = true;
    api.request<Partial<ProfileForm>>('/website/profile/', {}, false)
      .then((data) => {
        if (!active) return;
        const loaded = { ...emptyProfile(), ...data, founded_year: data.founded_year ? String(data.founded_year) : '' };
        setProfile(loaded);
        setBaseline(JSON.stringify(loaded));
        setProfileLoaded(true);
      })
      .catch((err) => { if (active) setProfileError(failureMessage(err)); });
    return () => { active = false; };
  }, []);

  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => setProfile((current) => ({ ...current, [key]: value }));
  const setMemberField = <K extends keyof MemberForm>(key: K, value: MemberForm[K]) => setMember((current) => ({ ...current, [key]: value }));
  const dirty = profileLoaded && JSON.stringify(profile) !== baseline;

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setProfileBusy(true); setProfileError('');
    try {
      const payload = { ...profile, founded_year: profile.founded_year ? Number(profile.founded_year) : null };
      const saved = await api.request<Partial<ProfileForm>>('/website/profile/', { method: 'PATCH', body: JSON.stringify(payload) });
      const merged = { ...profile, ...saved, founded_year: saved.founded_year ? String(saved.founded_year) : '' };
      setProfile(merged);
      setBaseline(JSON.stringify(merged));
      toast.push('Academy profile saved. The About page reads from it immediately.', 'success');
    } catch (err) { setProfileError(failureMessage(err)); } finally { setProfileBusy(false); }
  };

  const openCreate = () => { setEditing(null); setMember(emptyMember()); setPhoto(null); setFormError(''); setFormOpen(true); };

  const openEdit = (row: TeamRow) => {
    setEditing(row);
    setPhoto(null);
    setMember({
      name: row.name, role_title: row.role_title, bio: row.bio, quote: row.quote, image_url: '',
      linkedin_url: row.linkedin_url, instagram_url: row.instagram_url, website_url: row.website_url,
      is_founder: row.is_founder, order: String(row.order), is_published: row.is_published,
    });
    setFormError('');
    setFormOpen(true);
  };

  const saveMember = async (event: FormEvent) => {
    event.preventDefault();
    if (!member.name.trim() || !member.role_title.trim()) { setFormError('A profile needs a name and a role title.'); return; }
    setBusy(true); setFormError('');
    const body = new FormData();
    Object.entries({ ...member, order: Number(member.order) || 0 }).forEach(([key, value]) => {
      if (key === 'image_url' && !value) return; // keep the stored URL unless a new one is typed
      body.append(key, String(value));
    });
    if (photo) body.append('photo', photo);
    try {
      if (editing) await api.request(`/website/team/${editing.id}/`, { method: 'PATCH', body });
      else await api.request('/website/team/', { method: 'POST', body });
      toast.push(editing ? `${member.name}'s profile was updated.` : `${member.name} was added as a ${member.is_published ? 'published' : 'hidden'} profile.`, 'success');
      setFormOpen(false);
      setEditing(null);
      setMember(emptyMember());
      setPhoto(null);
      resource.refresh();
    } catch (err) { setFormError(failureMessage(err)); } finally { setBusy(false); }
  };

  const togglePublished = async (row: TeamRow) => {
    setBusy(true);
    try {
      await api.request(`/website/team/${row.id}/`, { method: 'PATCH', body: JSON.stringify({ is_published: !row.is_published }) });
      toast.push(`${row.name} is now ${row.is_published ? 'hidden from the About page' : 'visible on the About page'}.`, 'success');
      resource.refresh();
    } catch (err) { toast.push(failureMessage(err), 'error'); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await api.request(`/website/team/${confirm.id}/`, { method: 'DELETE' });
      toast.push(`${confirm.name} was removed from the team.`, 'success');
      if (editing?.id === confirm.id) { setFormOpen(false); setEditing(null); }
      setConfirm(null);
      resource.refresh();
    } catch (err) { toast.push(failureMessage(err), 'error'); } finally { setBusy(false); }
  };

  const rows = resource.data?.results ?? [];

  return (
    <>
      <AdminSection
        title="Academy profile"
        description="Written on the About page hero and contact strip. Leave a field empty to fall back to the details configured elsewhere on the site."
        actions={<Action type="submit" form="academy-profile-form" intent="primary" loading={profileBusy} disabled={!profileLoaded || !dirty}>Save profile</Action>}
      >
        <form id="academy-profile-form" onSubmit={(event) => void saveProfile(event)}>
          {profileError && <StatusNote tone="error">{profileError}</StatusNote>}
          {!profileLoaded && !profileError && <Skeleton rows={4} />}
          {profileLoaded && (
            <>
              <FormGrid>
                <Field label="Academy name" required>
                  <TextInput value={profile.name} onChange={(event) => set('name', event.target.value)} maxLength={200} />
                </Field>
                <Field label="Founded in" hint="Shown beside the academy name on the About page.">
                  <TextInput type="number" min="1900" max="2100" inputMode="numeric" value={profile.founded_year} onChange={(event) => set('founded_year', event.target.value)} />
                </Field>
              </FormGrid>
              <FormGrid columns={1}>
                <Field label="Tagline" hint="One line under the academy name.">
                  <TextInput value={profile.tagline} onChange={(event) => set('tagline', event.target.value)} maxLength={300} />
                </Field>
                <Field label="Story" hint="The long paragraph visitors read first.">
                  <textarea className={controlClass} rows={5} value={profile.story} onChange={(event) => set('story', event.target.value)} />
                </Field>
                <Field label="Mission">
                  <textarea className={controlClass} rows={4} value={profile.mission} onChange={(event) => set('mission', event.target.value)} />
                </Field>
              </FormGrid>
              <FormGrid columns={3}>
                <Field label="Location"><TextInput value={profile.location} onChange={(event) => set('location', event.target.value)} maxLength={200} /></Field>
                <Field label="Public email"><TextInput type="email" value={profile.email} onChange={(event) => set('email', event.target.value)} /></Field>
                <Field label="Phone"><TextInput value={profile.phone} onChange={(event) => set('phone', event.target.value)} maxLength={40} /></Field>
              </FormGrid>
              <FormGrid columns={3}>
                <Field label="LinkedIn" optional><TextInput type="url" placeholder="https://…" value={profile.linkedin_url} onChange={(event) => set('linkedin_url', event.target.value)} /></Field>
                <Field label="Instagram" optional><TextInput type="url" placeholder="https://…" value={profile.instagram_url} onChange={(event) => set('instagram_url', event.target.value)} /></Field>
                <Field label="Facebook" optional><TextInput type="url" placeholder="https://…" value={profile.facebook_url} onChange={(event) => set('facebook_url', event.target.value)} /></Field>
              </FormGrid>
            </>
          )}
        </form>
      </AdminSection>

      <AdminSection
        title="Founder and team"
        description="Only what you type here is published. The academy does not invent biographies."
        actions={<>
          <Action loading={resource.loading} onClick={resource.refresh}>Refresh list</Action>
          <Action intent="primary" onClick={openCreate}>Add profile</Action>
        </>}
      >
        {resource.error && <StatusNote tone="error">{resource.error}</StatusNote>}
        {resource.error && resource.data && <p className="text-sm">Showing the last team profiles we could load.</p>}
        {resource.loading && !resource.data && <Skeleton rows={3} />}
        {resource.data && (rows.length
          ? <AdminList label="Team profiles">{rows.map((row) => (
            <AdminRow
              key={row.id}
              thumbnail={row.image || undefined}
              placeholder="bi-person"
              round
              title={row.name}
              meta={`${row.role_title} · shown in position ${row.order + 1}`}
              description={row.bio || row.quote}
              badges={<>
                <Pill tone={row.is_published ? 'live' : 'draft'}>{row.is_published ? 'Published' : 'Hidden'}</Pill>
                {row.is_founder && <Pill>Founder</Pill>}
              </>}
              actions={<>
                <Action disabled={busy} onClick={() => void togglePublished(row)}>{row.is_published ? 'Hide from site' : 'Publish on site'}</Action>
                <Action disabled={busy} onClick={() => openEdit(row)}>Edit</Action>
                <Action intent="danger" disabled={busy} onClick={() => setConfirm(row)}>Delete</Action>
              </>}
            />
          ))}</AdminList>
          : <EmptyState
            icon="bi-people"
            title="No team profiles yet"
            description="Add the founder first — the About page shows a founder section only once a founder profile is published."
            action={<Action intent="primary" onClick={openCreate}>Add the first profile</Action>}
          />)}
        {resource.data && <Pager
          label="Team profiles"
          page={page}
          count={resource.data.count}
          hasNext={!!resource.data.next}
          busy={resource.loading}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => current + 1)}
        />}
      </AdminSection>

      <Drawer
        open={formOpen}
        title={editing ? `Editing ${editing.name}` : 'Add a founder or team member'}
        description="Changes reach the About page only when the profile is published."
        onClose={() => { setFormOpen(false); setEditing(null); }}
        footer={<>
          <Action disabled={busy} onClick={() => { setFormOpen(false); setEditing(null); }}>Cancel</Action>
          <Action type="submit" form="team-member-form" intent="primary" loading={busy}>{editing ? 'Save profile' : 'Add profile'}</Action>
        </>}
      >
        <form id="team-member-form" onSubmit={(event) => void saveMember(event)}>
          {formError && <StatusNote tone="error">{formError}</StatusNote>}
          <FormGrid>
            <Field label="Full name" required><TextInput value={member.name} onChange={(event) => setMemberField('name', event.target.value)} maxLength={150} required autoFocus /></Field>
            <Field label="Role title" required>
              <TextInput value={member.role_title} onChange={(event) => setMemberField('role_title', event.target.value)} maxLength={150} placeholder="Founder & Lead Instructor" required />
            </Field>
          </FormGrid>
          <FileField
            label="Profile photo"
            hint="A square photo reads best. Leave this empty to keep the stored photo."
            accept="image/*"
            file={photo}
            currentUrl={editing?.image}
            onFile={setPhoto}
          />
          <Field label="Or a photo URL" optional>
            <TextInput type="url" placeholder="https://…" value={member.image_url} onChange={(event) => setMemberField('image_url', event.target.value)} />
          </Field>
          <FormGrid columns={1}>
            <Field label="Biography" hint="What visitors read under the name.">
              <textarea className={controlClass} rows={5} value={member.bio} onChange={(event) => setMemberField('bio', event.target.value)} />
            </Field>
            <Field label="Quote" hint="Shown on the founder card.">
              <textarea className={controlClass} rows={2} value={member.quote} onChange={(event) => setMemberField('quote', event.target.value)} />
            </Field>
          </FormGrid>
          <FormGrid columns={3}>
            <Field label="LinkedIn" optional><TextInput type="url" placeholder="https://…" value={member.linkedin_url} onChange={(event) => setMemberField('linkedin_url', event.target.value)} /></Field>
            <Field label="Instagram" optional><TextInput type="url" placeholder="https://…" value={member.instagram_url} onChange={(event) => setMemberField('instagram_url', event.target.value)} /></Field>
            <Field label="Personal website" optional><TextInput type="url" placeholder="https://…" value={member.website_url} onChange={(event) => setMemberField('website_url', event.target.value)} /></Field>
          </FormGrid>
          <FormGrid>
            <Field label="Position on the page" hint="Lower numbers appear first.">
              <TextInput type="number" min="0" value={member.order} onChange={(event) => setMemberField('order', event.target.value)} />
            </Field>
            <div className="grid gap-3">
              <CheckRow label="Show in “Meet the founder”" checked={member.is_founder} onChange={(event) => setMemberField('is_founder', event.target.checked)} />
              <CheckRow label="Publish on the About page" hint="An unpublished profile stays hidden from visitors." checked={member.is_published} onChange={(event) => setMemberField('is_published', event.target.checked)} />
            </div>
          </FormGrid>
        </form>
      </Drawer>

      {confirm && <ConfirmDelete
        title="Delete team profile"
        description={`${confirm.name} will be removed from the team and the About page.`}
        confirmationName={confirm.name}
        error=""
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void remove()}
      />}
    </>
  );
}
