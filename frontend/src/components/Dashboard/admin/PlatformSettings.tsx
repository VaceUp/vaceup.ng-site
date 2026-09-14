'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { failureMessage } from '@/lib/course-management';
import { Action, Field, Feedback, styles } from './AuthoringUI';

interface Setting { key: string; label: string; description: string; type: 'boolean' | 'integer'; value: boolean | number; default: boolean | number; min?: number; max?: number; }
function SettingForm({ setting, onSaved }: { setting: Setting; onSaved: () => Promise<void> }) {
  const [value, setValue] = useState(setting.value), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  useEffect(() => { setValue(setting.value); }, [setting.value]);
  return <form className={`${styles.panel} ${styles.stack}`} onSubmit={async (event) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setMessage('');
    try {
      try { await api.request(`/admin/settings/${setting.key}/`, { method: 'PATCH', body: JSON.stringify({ value }) }); }
      catch (err) { if (!(err instanceof ApiError) || err.status !== 404) throw err; await api.request('/admin/settings/', { method: 'POST', body: JSON.stringify({ key: setting.key, value }) }); }
      setMessage('Setting saved.'); await onSaved();
    } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  }}><h3>{setting.label}</h3><p className={styles.muted}>{setting.description}</p>
    {setting.type === 'boolean' ? <label className={styles.check}><input type="checkbox" disabled={busy} checked={Boolean(value)} onChange={(event) => setValue(event.target.checked)} />{setting.label}</label> : <Field label={setting.label}><input required type="number" disabled={busy} min={setting.min} max={setting.max} step="1" value={Number(value)} onChange={(event) => setValue(Number(event.target.value))} /></Field>}
    <Feedback error={error} message={message} /><div><Action type="submit" intent="primary" loading={busy}>Save setting</Action></div>
  </form>;
}
export default function PlatformSettings() {
  const [settings, setSettings] = useState<Setting[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { setSettings(await api.request('/admin/settings/definitions/', { cache: 'no-store' })); } catch (err) { setError(failureMessage(err)); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  return <section className={`${styles.root} ${styles.stack}`} aria-label="Platform settings"><header className={styles.heading}><h2>Platform settings</h2><p className={styles.muted}>These settings are connected to platform features. SMTP credentials, passwords and provider keys belong in the server environment, not this panel.</p><div><Action loading={loading} onClick={() => void load()}>Refresh settings</Action></div></header><Feedback error={error} />{settings.map((setting) => <SettingForm key={setting.key} setting={setting} onSaved={load} />)}</section>;
}
