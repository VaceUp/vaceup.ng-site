'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';
import { downloadEventIcs } from '@/lib/calendar';
import { trackMeta } from '@/lib/meta-pixel';
import { formatEventWindow, getEvent, type WebsiteEvent } from '@/lib/website-api';
import RegisterButton from './RegisterButton';
import JoinBand from './JoinBand';

export default function EventDetail({ slug }: { slug: string }) {
  const [event, setEvent] = useState<WebsiteEvent | null>(null);
  const [seats, setSeats] = useState<{ taken: number; full: boolean } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const viewed = useRef('');

  useEffect(() => {
    let cancelled = false;
    setEvent(null);
    setError('');
    setSeats(null);
    setCopied(false);
    getEvent(slug)
      .then((value) => {
        if (cancelled) return;
        setEvent(value);
        // The advert's landing page is usually this detail view. Reporting the
        // event there lets the ad account see which event drew the visit,
        // without sending any of the visitor's details.
        if (viewed.current !== value.slug) {
          viewed.current = value.slug;
          trackMeta('ViewContent', {
            content_name: value.title,
            content_category: 'event',
            content_ids: [value.slug],
          });
        }
      })
      .catch(() => { if (!cancelled) setError('This event is no longer listed. Open the Events page to see what is coming up.'); });
    return () => { cancelled = true; };
  }, [slug]);

  const shown = event && seats ? { ...event, seats_taken: seats.taken, is_full: seats.full } : event;
  const seatLine = shown
    ? shown.capacity
      ? `${shown.seats_taken} of ${shown.capacity} seats taken`
      : `${shown.seats_taken} registered`
    : '';
  const seatCount = shown
    ? shown.capacity
      ? `${shown.seats_taken} of ${shown.capacity}`
      : `${shown.seats_taken}`
    : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 4000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Link href="/events" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-navy-900 underline underline-offset-4 hover:text-navy-950">
          <LordIconComponent src={LordIcons.arrowLeft} size={18} />
          Back to all events
        </Link>
      </div>

      {error ? (
        <section className="pb-20">
          <div className="mx-auto max-w-2xl px-6 text-center">
            <h1 className="text-2xl font-bold text-navy-950">Event not found</h1>
            <p role="alert" className="mt-3 text-gray-600">{error}</p>
          </div>
        </section>
      ) : !shown ? (
        <section className="pb-20">
          <div className="mx-auto max-w-5xl px-6">
            <p role="status" className="text-sm text-gray-500">Loading event…</p>
            <div className="mt-6 aspect-[16/9] w-full animate-pulse rounded-3xl bg-gray-100" />
          </div>
        </section>
      ) : (
        <>
          <section className="pb-6">
            <div className="mx-auto max-w-5xl px-6">
              <div className="flex flex-wrap gap-3 mb-4">
                <Badge variant="secondary" className="text-sm">{shown.event_type_label}</Badge>
                <Badge className="bg-gold-brand text-navy-950 text-sm">{seatLine}</Badge>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-navy-950 mb-4 break-words">{shown.title}</h1>
              {shown.summary && (
                <p className="text-navy-800 text-lg max-w-2xl">{shown.summary}</p>
              )}
            </div>
          </section>

          <section className="pb-6">
            <div className="mx-auto max-w-5xl px-6">
              {/* An event flyer already carries its own headline and details,
                  so it is shown whole in its own band rather than cropped
                  behind the page's text. */}
              <figure className="rounded-3xl border border-gray-200 bg-navy-50 p-3 sm:p-4">
                {shown.image ? (
                  <img
                    src={shown.image}
                    alt={`${shown.title} — event flyer`}
                    className="mx-auto max-h-[70vh] max-w-full rounded-2xl object-contain"
                  />
                ) : (
                  <div className="flex aspect-[16/9] w-full items-center justify-center rounded-2xl bg-navy-900 px-6 text-center text-sm text-navy-200">
                    The academy has not added a flyer for this event yet.
                  </div>
                )}
              </figure>
            </div>
          </section>

          <section className="pb-12">
            <div className="mx-auto max-w-5xl px-6">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-navy-950 mb-3">About this event</h2>
                  {shown.description ? (
                    <p className="whitespace-pre-line leading-relaxed text-gray-700 break-words">{shown.description}</p>
                  ) : (
                    <p className="text-gray-600">
                      Details are being finalised. Reserve a seat and we will email you the full programme.
                    </p>
                  )}

                  {shown.is_online && !shown.is_past && <JoinBand event={shown} />}
                  {shown.is_online && shown.live_platform === 'livekit' && shown.is_past && <Link href={`/live/?event=${encodeURIComponent(shown.slug)}&replays=1`}>Watch event recordings</Link>}

                  {shown.is_past && (
                    <p className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                      This event has already taken place. Check the Events page for the next date.
                    </p>
                  )}
                </div>

                <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
                  <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <LordIconComponent src={LordIcons.calendar} size={20} className="flex-shrink-0 text-navy-700" />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-500">When</p>
                        <p className="font-medium text-navy-950">{formatEventWindow(shown)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <LordIconComponent src={LordIcons.location} size={20} className="flex-shrink-0 text-navy-700" />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-500">Where</p>
                        <p className="font-medium text-navy-950 break-words">
                          {shown.is_online ? 'Online' : shown.location || 'Venue to be confirmed'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <LordIconComponent src={LordIcons.userGroup} size={20} className="flex-shrink-0 text-navy-700" />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-500">Seats</p>
                        <p className="font-medium text-navy-950">{seatCount}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <RegisterButton
                      event={shown}
                      onRegistered={(taken, full) => setSeats({ taken, full })}
                    />
                    <Button
                      variant="outline"
                      onClick={() => downloadEventIcs(shown)}
                      className="w-full"
                    >
                      Add to calendar
                      <LordIconComponent src={LordIcons.calendar} size={18} className="ml-2" />
                    </Button>
                    <Button variant="ghost" onClick={() => void copyLink()} className="w-full">
                      {copied ? 'Link copied' : 'Copy event link'}
                    </Button>
                    {copied && <p role="status" className="text-sm font-semibold text-green-700">Share this link with anyone who should come.</p>}
                  </div>
                </aside>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
