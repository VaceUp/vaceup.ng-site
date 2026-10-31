import { api } from './api';

export interface TutorSignature {
  signature: string;
  updated_at: string | null;
  name: string;
}

export interface ManagementSignature {
  signature: string;
  updated_at: string | null;
  name: string;
  title: string;
}

export const getTutorSignature = () => api.request<TutorSignature>('/certificates/signature/');

export function saveTutorSignature(file: File) {
  const body = new FormData();
  body.append('signature', file);
  return api.request<TutorSignature & { detail: string }>('/certificates/signature/', {
    method: 'POST',
    body,
  });
}

export const removeTutorSignature = () => api.request<{ detail: string }>('/certificates/signature/', {
  method: 'DELETE',
});

export const getManagementSignature = () =>
  api.request<ManagementSignature>('/certificates/signature/management/');

export function saveManagementSignature(file: File | null, name: string, title: string) {
  const body = new FormData();
  if (file) body.append('signature', file);
  body.append('name', name.trim());
  body.append('title', title.trim());
  return api.request<ManagementSignature & { detail: string }>('/certificates/signature/management/', {
    method: 'POST',
    body,
  });
}

export const removeManagementSignature = () =>
  api.request<ManagementSignature & { detail: string }>('/certificates/signature/management/', {
    method: 'DELETE',
  });

export const SIGNATURE_ACCEPT = 'image/png,image/jpeg,image/webp';
export const SIGNATURE_MAX_BYTES = 400 * 1024;

export function signatureFileError(file: File): string {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return 'Choose a PNG, JPEG or WebP image.';
  }
  if (file.size > SIGNATURE_MAX_BYTES) return 'Use an image under 400 KB.';
  return '';
}

export const signatureUpdatedLabel = (value: string | null) => {
  if (!value) return 'Not uploaded yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Uploaded';
  return `Updated ${new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)}`;
};
