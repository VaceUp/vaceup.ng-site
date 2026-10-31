'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  getManagementSignature,
  removeManagementSignature,
  saveManagementSignature,
  signatureFileError,
  signatureUpdatedLabel,
  SIGNATURE_ACCEPT,
  type ManagementSignature,
} from '@/lib/certificate-api';
import { failureMessage } from '@/lib/course-management';
import {
  Action,
  AdminSection,
  Field,
  FileField,
  FormGrid,
  FormGroup,
  Skeleton,
  StatusNote,
  TextInput,
  adminStyles,
} from './AdminUI';

/** The academy signatory printed beside the tutor's signature on every award. */
export function ManagementSignatureCard() {
  const [current, setCurrent] = useState<ManagementSignature | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setLoadError('');
    getManagementSignature()
      .then((data) => {
        setCurrent(data);
        setName(data.name);
        setTitle(data.title);
      })
      .catch((reason: unknown) => setLoadError(failureMessage(reason)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const chooseFile = (picked: File | null) => {
    setFile(picked);
    setMessage('');
    setFileError(picked ? signatureFileError(picked) : '');
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');
    if (!name.trim() || !title.trim()) {
      setError('Add the signatory name and the role printed under the signature.');
      return;
    }
    if (file && fileError) return;
    if (!current?.signature && !file) {
      setError('Upload the management signature image.');
      return;
    }
    setSaving(true);
    try {
      const result = await saveManagementSignature(file, name, title);
      setCurrent(result);
      setFile(null);
      setFileError('');
      setMessage('The management signature has been saved. New certificates will print it.');
    } catch (reason) {
      setError(failureMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Remove the management signature? New certificates will print the signatory name without an image.')) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await removeManagementSignature();
      setCurrent(result);
      setMessage('The management signature image has been removed.');
    } catch (reason) {
      setError(failureMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminSection
      title="Management signature"
      description="This is the academy-side signature printed on certificates, beside the tutor who signed. It applies to every certificate issued from now on."
    >
      {loading ? <Skeleton rows={2} /> : loadError ? (
        <StatusNote tone="error">{loadError} <Action onClick={load}>Try again</Action></StatusNote>
      ) : (
        <form className={adminStyles.form} onSubmit={save}>
          <FormGrid>
            <FormGroup title="Signatory">
              <Field label="Name printed on the certificate" required>
                <TextInput
                  value={name}
                  maxLength={120}
                  placeholder="e.g. Dr Ada Obi"
                  onChange={(event) => { setName(event.target.value); setMessage(''); }}
                />
              </Field>
              <Field label="Role printed under the signature" required hint="For example: Academy Director.">
                <TextInput
                  value={title}
                  maxLength={120}
                  placeholder="Academy Director"
                  onChange={(event) => { setTitle(event.target.value); setMessage(''); }}
                />
              </Field>
              <div className={adminStyles.actions}>
                <Action intent="primary" type="submit" loading={saving}>
                  Save signatory
                </Action>
                {current?.signature && (
                  <Action intent="danger" disabled={saving} onClick={() => void remove()}>
                    Remove image
                  </Action>
                )}
              </div>
              {error && <StatusNote tone="error">{error}</StatusNote>}
              {message && <StatusNote tone="ok">{message}</StatusNote>}
            </FormGroup>
            <FormGroup title="Signature image">
              <FileField
                label="Upload the management signature"
                hint="PNG with a transparent background works best. Maximum 400 KB."
                accept={SIGNATURE_ACCEPT}
                file={file}
                currentUrl={current?.signature || undefined}
                onFile={chooseFile}
                error={fileError || undefined}
              />
              <p className={adminStyles.hint}>{signatureUpdatedLabel(current?.updated_at ?? null)}</p>
            </FormGroup>
          </FormGrid>
        </form>
      )}
    </AdminSection>
  );
}

export default ManagementSignatureCard;
