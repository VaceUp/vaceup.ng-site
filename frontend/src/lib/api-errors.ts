/** Preserve DRF field validation messages instead of replacing them with HTTP 400. */
export function apiErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const error = data as Record<string, unknown>;
    const nested = error.error as { detail?: unknown } | undefined;
    const detail = error.detail ?? nested?.detail ?? error.message;
    if (typeof detail === 'string' && detail.trim()) return detail;
    const labels: Record<string, string> = {
      email: 'Email', password: 'Password', full_name: 'Full name',
      phone_number: 'Phone number', non_field_errors: '',
    };
    const messages = Object.entries(error).flatMap(([field, value]) => {
      const entries = Array.isArray(value) ? value : [value];
      const label = labels[field] ?? field.replaceAll('_', ' ');
      return entries.filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => label ? `${label}: ${entry}` : entry);
    });
    if (messages.length) return messages.join(' ');
  }
  if (status === 400) return 'Your request could not be accepted. Check the form and try again. If it continues, contact support and mention error 400.';
  if (status === 429) return 'Too many attempts. Please wait a moment before trying again.';
  if (status >= 500) return 'The service is temporarily unavailable. Please try again shortly.';
  return `Request failed (HTTP ${status}). Please try again.`;
}
