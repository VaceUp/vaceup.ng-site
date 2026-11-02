'use client';

import Link from 'next/link';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';
import type { WebsiteEvent } from '@/lib/website-api';

const clockTime = (iso: string | null | undefined) => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isFinite(date.getTime())
    ? date.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })
    : '';
};

/**
 * The place an attendee enters from. Their seat lives in the emailed link, so
 * this panel only has to say whether the room is open and hand them to it.
 */
export default function JoinBand({ event }: { event: WebsiteEvent }) {
  if (!event.is_online || event.is_past) return null;

  const ready = event.join_ready ?? false;
  const joinable = event.is_joinable ?? false;
  const opensAt = clockTime(event.join_opens_at);
  const closesAt = clockTime(event.join_closes_at);
  const seatHref = `/live/?event=${encodeURIComponent(event.slug)}`;

  let sentence = '';
  if (!ready) {
    sentence = 'The academy has not set the meeting details yet. Your personal link shows them the moment they are added.';
  } else if (joinable) {
    sentence = `The room is open${closesAt ? ` until ${closesAt}` : ''}. Use the link from your confirmation email, or enter here.`;
  } else if (opensAt) {
    sentence = `The room opens at ${opensAt}. Your link works from then until the event ends.`;
  } else {
    sentence = 'The room opens shortly before the start. Keep the link we emailed you.';
  }

  return (
    <section aria-label="Joining this event" className="mt-6 rounded-2xl border border-navy-200 bg-navy-50 p-5">
      <div className="flex items-start gap-3">
        <LordIconComponent src={LordIcons.videoCall} size={20} className="mt-0.5 flex-shrink-0 text-navy-700" />
        <div className="min-w-0">
          <h2 className="font-bold text-navy-950">Joining this event</h2>
          <p className="mt-1 text-sm text-navy-800">{sentence}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {joinable && ready && (
              <Link
                href={seatHref}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gold-brand px-5 font-bold text-navy-950 hover:bg-gold-hover"
              >
                Enter the room
              </Link>
            )}
            <Link
              href={seatHref}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-navy-900 px-5 text-sm font-semibold text-navy-900 hover:bg-navy-100"
            >
              I cannot find my link
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
