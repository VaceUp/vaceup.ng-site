'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { failureMessage } from '@/lib/course-management';
import type { WorkspacePage } from '@/lib/workspace-api';
import { Action, ConfirmDelete, Field, Feedback, styles } from './AuthoringUI';
import { WorkspacePagination } from '../WorkspaceUI';

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

export default function WebsiteManager() {
  const [page, setPage] = useState(1);
  const resource = useWorkspaceResource<WorkspacePage<TeamRow>>(`/website/team/?page=${page}`);
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile());
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [member, setMember] = useState(emptyMember());
  const [editing, setEditing] = useState<TeamRow | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState<TeamRow | null>(null);

  useEffect(() => {
    let active = true;
    api.request<Partial<ProfileForm>>('/website/profile/', {}, false)
      .then((data) => {
        if (!active) return;
        setProfile({ ...emptyProfile(), ...data, founded_year: data.founded_year ? String(data.founded_year) : '' });
        setProfileLoaded(true);
      })
      .catch((err) => { if (active) setError(failureMessage(err)); });
    return () => { active = false; };
  }, []);

  const founders = useMemo(() => (resource.data?.results || []).filter((row) => row.is_founder), [resource.data]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setProfileBusy(true); setError(''); setNotice('');
    try {
      const payload = { ...profile, founded_year: profile.founded_year ? Number(profile.founded_year) : null };
      const saved = await api.request<Partial<ProfileForm>>('/website/profile/', { method: 'PATCH', body: JSON.stringify(payload) });
      setProfile((current) => ({ ...current, ...saved, founded_year: saved.founded_year ? String(saved.founded_year) : '' }));
      setNotice('Academy profile saved. The About page reads from it immediately.');
    } catch (err) { setError(failureMessage(err)); } finally { setProfileBusy(false); }
  };

  const resetMember = () => { setEditing(null); setMember(emptyMember()); setPhoto(null); };

  const editMember = (row: TeamRow) => {
    setEditing(row);
    setPhoto(null);
    setMember({
      name: row.name, role_title: row.role_title, bio: row.bio, quote: row.quote, image_url: '',
      linkedin_url: row.linkedin_url, instagram_url: row.instagram_url, website_url: row.website_url,
      is_founder: row.is_founder, order: String(row.order), is_published: row.is_published,
    });
    setNotice(`Editing ${row.name}. Saving keeps it ${row.is_published ? 'published' : 'hidden'}.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveMember = async (event: FormEvent) => {
    event.preventDefault();
    if (!member.name.trim() || !member.role_title.trim()) { setError('A profile needs a name and a role title.'); return; }
    setBusy(true); setError(''); setNotice('');
    const body = new FormData();
    Object.entries({ ...member, order: Number(member.order) || 0 }).forEach(([key, value]) => {
      if (key === 'image_url' && !value) return; // keep the stored URL unless a new one is typed
      body.append(key, String(value));
    });
    if (photo) body.append('photo', photo);
    try {
      if (editing) await api.request(`/website/team/${editing.id}/`, { method: 'PATCH', body });
      else await api.request('/website/team/', { method: 'POST', body });
      setNotice(editing ? `${member.name}'s profile was updated.` : `${member.name} was added as a ${member.is_published ? 'published' : 'hidden'} profile.`);
      resetMember();
      resource.refresh();
    } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  };

  const togglePublished = async (row: TeamRow) => {
    setBusy(true); setError('');
    try {
      await api.request(`/website/team/${row.id}/`, { method: 'PATCH', body: JSON.stringify({ is_published: !row.is_published }) });
      setNotice(`${row.name} is now ${row.is_published ? 'hidden from the About page' : 'visible on the About page'}.`);
      resource.refresh();
    } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm) return;
    setBusy(true); setError('');
    try {
      await api.request(`/website/team/${confirm.id}/`, { method: 'DELETE' });
      setNotice(`${confirm.name} was removed from the team.`);
      if (editing?.id === confirm.id) resetMember();
      setConfirm(null);
      resource.refresh();
    } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  };

  return <div className={`${styles.root} ${styles.stack}`}>
    <div className={styles.heading}>
      <h2>Website content</h2>
      <p className={styles.muted}>The public About page is built from these two blocks. Nothing appears on the site until you save it and tick Publish.</p>
    </div>
    <Feedback error={error || resource.error} message={notice} />

    <form className={`${styles.panel} ${styles.stack}`} onSubmit={(event) => void saveProfile(event)} aria-label="Academy profile">
      <h3>Academy profile</h3>
      <p className={styles.muted}>Written on the About page hero and contact strip. Leave a field empty to fall back to the details configured in the site.</p>
      {!profileLoaded && <p className={styles.muted}>Loading the saved profile…</p>}
      <div className={styles.grid}>
        <Field label="Academy name"><input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} maxLength={200} /></Field>
        <Field label="Founded in (year)"><input type="number" min="1900" max="2100" value={profile.founded_year} onChange={(event) => setProfile({ ...profile, founded_year: event.target.value })} /></Field>
      </div>
      <Field label="Tagline"><input value={profile.tagline} onChange={(event) => setProfile({ ...profile, tagline: event.target.value })} maxLength={300} /></Field>
      <Field label="Story"><textarea rows={5} value={profile.story} onChange={(event) => setProfile({ ...profile, story: event.target.value })} /></Field>
      <Field label="Mission"><textarea rows={4} value={profile.mission} onChange={(event) => setProfile({ ...profile, mission: event.target.value })} /></Field>
      <div className={styles.grid}>
        <Field label="Location"><input value={profile.location} onChange={(event) => setProfile({ ...profile, location: event.target.value })} maxLength={200} /></Field>
        <Field label="Public email"><input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></Field>
        <Field label="Phone"><input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} maxLength={40} /></Field>
        <Field label="LinkedIn"><input type="url" value={profile.linkedin_url} onChange={(event) => setProfile({ ...profile, linkedin_url: event.target.value })} /></Field>
        <Field label="Instagram"><input type="url" value={profile.instagram_url} onChange={(event) => setProfile({ ...profile, instagram_url: event.target.value })} /></Field>
        <Field label="Facebook"><input type="url" value={profile.facebook_url} onChange={(event) => setProfile({ ...profile, facebook_url: event.target.value })} /></Field>
      </div>
      <div><Action type="submit" intent="primary" loading={profileBusy}>Save profile</Action></div>
    </form>

    <form className={`${styles.panel} ${styles.stack}`} onSubmit={(event) => void saveMember(event)} aria-label={editing ? 'Edit team profile' : 'Add team profile'}>
      <div className={styles.row}><h3>{editing ? `Editing ${editing.name}` : 'Add a founder or team member'}</h3>{editing && <Action disabled={busy} onClick={resetMember}>Cancel editing</Action>}</div>
      <p className={styles.muted}>Only what you type here is published. The academy does not invent biographies.</p>
      <div className={styles.grid}>
        <Field label="Full name"><input value={member.name} onChange={(event) => setMember({ ...member, name: event.target.value })} maxLength={150} required /></Field>
        <Field label="Role title"><input value={member.role_title} onChange={(event) => setMember({ ...member, role_title: event.target.value })} maxLength={150} required placeholder="Founder & Lead Instructor" /></Field>
        <Field label="Order"><input type="number" min="0" value={member.order} onChange={(event) => setMember({ ...member, order: event.target.value })} /></Field>
        <Field label="Profile photo"><input type="file" accept="image/*" onChange={(event) => setPhoto(event.target.files?.[0] || null)} />{editing?.image && <span className={styles.muted}> Currently using the stored photo.</span>}</Field>
      </div>
      <Field label="Or a photo URL"><input type="url" value={member.image_url} onChange={(event) => setMember({ ...member, image_url: event.target.value })} placeholder="https://…" /></Field>
      <Field label="Biography"><textarea rows={5} value={member.bio} onChange={(event) => setMember({ ...member, bio: event.target.value })} /></Field>
      <Field label="Quote (shown on the founder card)"><textarea rows={2} value={member.quote} onChange={(event) => setMember({ ...member, quote: event.target.value })} /></Field>
      <div className={styles.grid}>
        <Field label="LinkedIn"><input type="url" value={member.linkedin_url} onChange={(event) => setMember({ ...member, linkedin_url: event.target.value })} /></Field>
        <Field label="Instagram"><input type="url" value={member.instagram_url} onChange={(event) => setMember({ ...member, instagram_url: event.target.value })} /></Field>
        <Field label="Personal website"><input type="url" value={member.website_url} onChange={(event) => setMember({ ...member, website_url: event.target.value })} /></Field>
      </div>
      <div className={styles.row}>
        <label className={styles.check}><input type="checkbox" checked={member.is_founder} onChange={(event) => setMember({ ...member, is_founder: event.target.checked })} />Show in “Meet the founder”</label>
        <label className={styles.check}><input type="checkbox" checked={member.is_published} onChange={(event) => setMember({ ...member, is_published: event.target.checked })} />Publish on the About page</label>
      </div>
      <div><Action type="submit" intent="primary" loading={busy}>{editing ? 'Save profile' : 'Add profile'}</Action></div>
    </form>

    <div className={`${styles.row} ${styles.between}`}>
      <h3>Team profiles</h3>
      <Action loading={resource.loading} onClick={resource.refresh}>Refresh list</Action>
    </div>

    {resource.error && resource.data && <p className={styles.muted}>Showing the last team profiles we could load.</p>}
    {resource.data && (resource.data.results.length
      ? <ul className={styles.list}>{resource.data.results.map((row) => <li className={`${styles.panel} ${styles.stack}`} key={row.id}>
        <div className={`${styles.row} ${styles.between}`}>
          <h3>{row.name}{row.is_founder ? ' - founder' : ''}</h3>
          <span className={styles.badge}>{row.is_published ? 'Published' : 'Hidden'}</span>
        </div>
        <p className={styles.muted}>{row.role_title} · order {row.order}</p>
        {row.bio && <p className={styles.preview}>{row.bio}</p>}
        <div className={styles.row}>
          <Action disabled={busy} onClick={() => void togglePublished(row)}>{row.is_published ? 'Hide from site' : 'Publish on site'}</Action>
          <Action disabled={busy} onClick={() => editMember(row)}>Edit</Action>
          <Action intent="danger" disabled={busy} onClick={() => setConfirm(row)}>Delete</Action>
        </div>
      </li>)}</ul>
      : <div className={styles.empty}><h3>No team profiles yet</h3><p className={styles.muted}>Add the founder first — the About page shows a founder section only once a founder profile is published.</p></div>)}
    {resource.data && <WorkspacePagination page={page} count={resource.data.count} hasNext={!!resource.data.next} loading={resource.loading} onPage={setPage} />}

    {confirm && <ConfirmDelete title="Delete team profile" description={`${confirm.name} will be removed from the team and the About page.`} confirmationName={confirm.name} error={error} busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => void remove()} />}
  </div>;
}
