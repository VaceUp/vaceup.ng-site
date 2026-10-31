'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { failureMessage } from '@/lib/course-management';
import {
  Action, AdminSection, CheckRow, Field, Skeleton, StatusNote, TextInput, adminStyles,
} from './AdminUI';

interface Setting { key: string; label: string; description: string; type: 'boolean' | 'integer'; value: boolean | number; default: boolean | number; min?: number; max?: number; }

function SettingForm({ setting, onSaved }: { setting: Setting; onSaved: () => Promise<void> }) {
  const [value, setValue] = useState(setting.value), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  useEffect(() => { setValue(setting.value); }, [setting.value]);
  return <form className={adminStyles.setting} onSubmit={async (event) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setMessage('');
    try {
      try { await api.request(`/admin/settings/${setting.key}/`, { method: 'PATCH', body: JSON.stringify({ value }) }); }
      catch (err) { if (!(err instanceof ApiError) || err.status !== 404) throw err; await api.request('/admin/settings/', { method: 'POST', body: JSON.stringify({ key: setting.key, value }) }); }
      setMessage('Setting saved.'); await onSaved();
    } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  }}>
    <div className={adminStyles.settingHead}>
      <div>
        <h4 className={adminStyles.settingTitle}>{setting.label}</h4>
        <p className={adminStyles.hint}>{setting.description}</p>
      </div>
      <Action type="submit" intent="primary" loading={busy}>Save setting</Action>
    </div>
    {setting.type === 'boolean'
      ? <CheckRow
        label={setting.label}
        checked={Boolean(value)}
        disabled={busy}
        onChange={(event) => setValue(event.target.checked)}
      />
      : <div className={adminStyles.settingControl}>
        <Field
          label="Value"
          hint={`Whole number${setting.min !== undefined ? ` from ${setting.min}` : ''}${setting.max !== undefined ? ` to ${setting.max}` : ''}.`}
        >
          <TextInput required type="number" disabled={busy} min={setting.min} max={setting.max} step="1" value={Number(value)} onChange={(event) => setValue(Number(event.target.value))} />
        </Field>
      </div>}
    {error && <StatusNote tone="error">{error}</StatusNote>}
    {message && <StatusNote tone="ok">{message}</StatusNote>}
  </form>;
}

export default function PlatformSettings() {
  const [settings, setSettings] = useState<Setting[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setSettings(await api.request('/admin/settings/definitions/', { cache: 'no-store' })); }
    catch (err) { setError(failureMessage(err)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <AdminSection
    title="Platform settings"
    description="These settings are connected to platform features. SMTP credentials, passwords and provider keys belong in the server environment, not this panel."
    actions={<Action loading={loading} onClick={() => void load()}>Refresh settings</Action>}
  >
    {error && <StatusNote tone="error">{error}</StatusNote>}
    {loading && !settings.length && <Skeleton rows={2} />}
    {!loading && !settings.length && !error && <StatusNote>No settings are exposed in this panel yet.</StatusNote>}
    {settings.map((setting) => <SettingForm key={setting.key} setting={setting} onSaved={load} />)}
  </AdminSection>;
}
