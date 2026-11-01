'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';
import { downloadEventIcs } from '@/lib/calendar';
import { formatEventWindow, getEvent, type WebsiteEvent } from '@/lib/website-api';
import RegisterButton from './RegisterButton';

export default function EventDetail({ slug }: { slug: string }) {
  const [event, setEvent] = useState<WebsiteEvent | null>(null);
  const [seats, setSeats] = useState<{ taken: number; full: boolean } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEvent(null);
    setError('');
    setSeats(null);
    setCopied(false);
    getEvent(slug)
      .then((value) => { if (!cancelled) setEvent(value); })
      .catch(() => { if (!cancelled) setError('This event is no longer listed. Open the Events page to see what is coming up.'); });
    return () => { cancelled = true; };
  }, [slug]);

  const shown = event && seats ? { ...event, seats_taken: seats.taken, is_full: seats.full } : event;
  const seatLine = shown
    ? shown.capacity
      ? `${shown.seats_taken} of ${shown.capacity} seats taken`
      : `${shown.seats_taken} registered`
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
          <section className="pb-8">
            <div className="mx-auto max-w-5xl px-6">
              <div className="relative overflow-hidden rounded-3xl">
                <div className="relative aspect-[16/9] lg:aspect-[21/9]">
                  {shown.image ? (
                    <img src={shown.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-navy-900" aria-hidden="true" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-navy-950/90 via-navy-900/50 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-12">
                    <div className="flex flex-wrap gap-3 mb-4">
                      <Badge variant="secondary" className="text-sm">{shown.event_type_label}</Badge>
                      <Badge className="bg-gold-brand text-navy-950 text-sm">{seatLine}</Badge>
                    </div>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 break-words">{shown.title}</h1>
                    {shown.summary && (
                      <p className="text-navy-100 text-lg max-w-2xl">{shown.summary}</p>
                    )}
                  </div>
                </div>
              </div>
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

                  {shown.is_online && !shown.is_past && (
                    <p className="mt-6 rounded-2xl border border-navy-100 bg-navy-50 p-4 text-sm text-navy-900">
                      This event is online. We email your joining link with the
                      registration confirmation, or as soon as the academy sets it.
                    </p>
                  )}

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
                        <p className="font-medium text-navy-950">{seatLine}</p>
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
