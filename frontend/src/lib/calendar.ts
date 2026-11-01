import type { WebsiteEvent } from './website-api';

/** Calendar-file export for public events. */

const stamp = (iso: string) =>
  new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

// RFC 5545: commas, semicolons and backslashes are escaped, newlines flattened.
const fold = (value: string) => value.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, ' ');

export function buildEventIcs(event: WebsiteEvent): string | null {
  const start = new Date(event.starts_at);
  if (!Number.isFinite(start.getTime())) return null;
  const end = event.ends_at && Number.isFinite(new Date(event.ends_at).getTime())
    ? new Date(event.ends_at)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const venue = event.is_online ? 'Online' : event.location || 'Venue to be confirmed';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VaceUp Digital Academy//EN',
    'BEGIN:VEVENT',
    `UID:${event.slug}@vaceup.ng`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(event.starts_at)}`,
    `DTEND:${stamp(end.toISOString())}`,
    `SUMMARY:${fold(event.title)}`,
    `DESCRIPTION:${fold(event.summary || event.description)}`,
    `LOCATION:${fold(venue)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadEventIcs(event: WebsiteEvent) {
  const ics = buildEventIcs(event);
  if (!ics) return;
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${event.slug}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}
