'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';
import { cn } from '@/lib/utils';
import { SITE } from '@/lib/site-config';
import { useAuth } from '@/lib/auth-context';
import {
  formatEventWindow,
  getPublishedEvents,
  registerForEvent,
  type WebsiteEvent,
} from '@/lib/website-api';

type RsvpForm = { name: string; email: string; phone: string; note: string };

const icsStamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

export default function EventsPage() {
  const { user } = useAuth();
  const [upcoming, setUpcoming] = useState<WebsiteEvent[]>([]);
  const [past, setPast] = useState<WebsiteEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [rsvpFor, setRsvpFor] = useState<WebsiteEvent | null>(null);
  const [form, setForm] = useState<RsvpForm>({ name: '', email: '', phone: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([getPublishedEvents('upcoming'), getPublishedEvents('past')])
      .then(([next, previous]) => {
        setUpcoming(next.results);
        setPast(previous.results);
      })
      .catch((requestError: unknown) =>
        setError(requestError instanceof Error ? requestError.message : 'Events are unavailable right now.'),
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const types = useMemo(() => {
    const seen = new Map<string, string>();
    [...upcoming, ...past].forEach((event) => seen.set(event.event_type, event.event_type_label));
    return ['All', ...seen.values()];
  }, [upcoming, past]);

  const matches = (event: WebsiteEvent) => selectedType === 'All' || event.event_type_label === selectedType;
  const filteredUpcoming = upcoming.filter(matches);
  const filteredPast = past.filter(matches);
  const featured = filteredUpcoming.find((event) => event.is_featured) || filteredUpcoming[0];
  const rest = featured ? filteredUpcoming.filter((event) => event.id !== featured.id) : [];

  const openRsvp = (event: WebsiteEvent) => {
    setRsvpFor(event);
    setFormError('');
    setDone('');
    setForm({ name: user?.full_name || '', email: user?.email || '', phone: user?.phone_number || '', note: '' });
  };

  const submitRsvp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rsvpFor || submitting) return;
    setSubmitting(true);
    setFormError('');
    try {
      const result = await registerForEvent(rsvpFor.slug, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        note: form.note.trim(),
      });
      setDone(result.detail);
      setUpcoming((rows) =>
        rows.map((row) =>
          row.id === rsvpFor.id ? { ...row, seats_taken: result.seats_taken, is_full: result.is_full } : row,
        ),
      );
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Your registration could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  const addToCalendar = (event: WebsiteEvent) => {
    const start = new Date(event.starts_at);
    if (!Number.isFinite(start.getTime())) return;
    const end = event.ends_at && Number.isFinite(new Date(event.ends_at).getTime())
      ? new Date(event.ends_at)
      : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//VaceUp Digital Academy//EN',
      'BEGIN:VEVENT',
      `UID:${event.slug}@vaceup.ng`,
      `DTSTAMP:${icsStamp(new Date().toISOString())}`,
      `DTSTART:${icsStamp(event.starts_at)}`,
      `DTEND:${icsStamp(end.toISOString())}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${(event.summary || event.description).replace(/\r?\n/g, ' ')}`,
      `LOCATION:${(event.is_online ? 'Online' : event.location).replace(/,/g, '\\,')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.slug}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const registerAction = (event: WebsiteEvent, block = 'w-full') => {
    if (event.registration_url) {
      return (
        <a
          href={event.registration_url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gold-brand px-5 font-bold text-navy-950 hover:bg-gold-hover transition-colors',
            block,
          )}
        >
          Register
        </a>
      );
    }
    if (event.is_past) {
      return (
        <Button variant="outline" disabled className={block}>
          Already held
        </Button>
      );
    }
    if (event.is_full) {
      return (
        <Button variant="outline" disabled className={block}>
          Fully booked
        </Button>
      );
    }
    return (
      <Button
        onClick={() => openRsvp(event)}
        className={cn('bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold', block)}
      >
        Register
      </Button>
    );
  };

  const seatLine = (event: WebsiteEvent) =>
    event.capacity ? `${event.seats_taken}/${event.capacity} seats filled` : `${event.seats_taken} registered`;

  return (
    <div className="min-h-screen bg-white">
      <main>
        <section className="py-20 bg-navy-950">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6">
              Events &amp; Workshops
            </h1>
            <p className="text-lg text-navy-200 max-w-3xl mx-auto">
              Join our community events, workshops, and networking sessions. Learn, connect, and grow with fellow tech enthusiasts.
            </p>
          </div>
        </section>

        {error && (
          <section className="bg-white py-8">
            <div className="mx-auto max-w-7xl px-6">
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                <p className="font-semibold text-red-800">{error}</p>
                <Button onClick={load} className="mt-4 bg-navy-950 text-white hover:bg-navy-900">
                  Try again
                </Button>
              </div>
            </div>
          </section>
        )}

        {!error && loading && (
          <section className="py-12 bg-white">
            <div className="mx-auto max-w-7xl px-6">
              <div className="aspect-[16/9] max-h-[520px] w-full animate-pulse rounded-3xl bg-gray-100" />
            </div>
          </section>
        )}

        {!error && !loading && !featured && (
          <section className="py-20 bg-white">
            <div className="mx-auto max-w-3xl px-6 text-center">
              <LordIconComponent src={LordIcons.calendar} size={40} className="mx-auto text-navy-200" />
              <h2 className="mt-6 text-2xl font-bold text-navy-950">No dates announced yet</h2>
              <p className="mt-2 text-gray-600">
                Open days, workshops and info sessions appear here as soon as the academy publishes them.
              </p>
              <a
                href={`mailto:${SITE.email}`}
                className="mt-6 inline-block rounded-xl bg-gold-brand px-6 py-3 font-bold text-navy-950 hover:bg-gold-hover transition-colors"
              >
                Ask when the next one is
              </a>
            </div>
          </section>
        )}

        {!error && !loading && featured && (
          <>
            <section className="py-12 bg-white">
              <div className="mx-auto max-w-7xl px-6">
                <article className="relative rounded-3xl overflow-hidden">
                  <div className="relative aspect-[16/9] lg:aspect-[21/9]">
                    {featured.image ? (
                      <img src={featured.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-navy-900" aria-hidden="true" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-navy-950/90 via-navy-900/50 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-12">
                      <div className="max-w-3xl">
                        <div className="flex flex-wrap gap-3 mb-4">
                          <Badge variant="secondary" className="text-sm">{featured.event_type_label}</Badge>
                          <Badge className="bg-gold-brand text-navy-950 text-sm">{seatLine(featured)}</Badge>
                        </div>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">{featured.title}</h2>
                        <p className="text-navy-100 text-lg mb-8 max-w-2xl">{featured.summary || featured.description}</p>
                        <div className="flex flex-wrap gap-6 text-navy-200 mb-8">
                          <div className="flex items-center gap-2">
                            <LordIconComponent src={LordIcons.calendar} size={20} />
                            <div>
                              <p className="text-sm">When</p>
                              <p className="font-medium">{formatEventWindow(featured)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <LordIconComponent src={LordIcons.location} size={20} />
                            <div>
                              <p className="text-sm">Where</p>
                              <p className="font-medium">{featured.is_online ? 'Online' : featured.location || 'Venue to be confirmed'}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4">
                          {registerAction(featured, '')}
                          <Button
                            variant="outline"
                            onClick={() => addToCalendar(featured)}
                            className="border-white/30 text-white hover:bg-white/10"
                          >
                            Add to Calendar
                            <LordIconComponent src={LordIcons.calendar} size={20} className="ml-2" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </section>

            <section className="py-8 bg-gray-50 border-y border-gray-100">
              <div className="mx-auto max-w-7xl px-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                    {types.map((type) => (
                      <button
                        key={type}
                        onClick={() => setSelectedType(type)}
                        aria-pressed={selectedType === type}
                        className={cn(
                          'min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                          selectedType === type
                            ? 'bg-navy-950 text-white shadow-md'
                            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-100',
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  {filteredUpcoming.length > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">View:</span>
                      <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-100">
                        <button
                          onClick={() => setView('grid')}
                          aria-pressed={view === 'grid'}
                          aria-label="Grid view"
                          className={cn(
                            'p-2 rounded-lg transition-colors',
                            view === 'grid' ? 'bg-navy-950 text-white' : 'text-gray-500 hover:text-gray-700',
                          )}
                        >
                          <LordIconComponent src={LordIcons.grid} size={20} />
                        </button>
                        <button
                          onClick={() => setView('list')}
                          aria-pressed={view === 'list'}
                          aria-label="List view"
                          className={cn(
                            'p-2 rounded-lg transition-colors',
                            view === 'list' ? 'bg-navy-950 text-white' : 'text-gray-500 hover:text-gray-700',
                          )}
                        >
                          <LordIconComponent src={LordIcons.list} size={20} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="py-12 bg-white" aria-label="More upcoming events">
              <div className="mx-auto max-w-7xl px-6">
                {rest.length === 0 ? (
                  <p className="text-center text-gray-600">This is the only {selectedType === 'All' ? 'event' : selectedType.toLowerCase()} on the calendar right now.</p>
                ) : view === 'grid' ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {rest.map((event) => (
                      <Card key={event.id} className="h-full hover:shadow-xl transition-all duration-300 border-gray-100">
                        <div className="relative aspect-video overflow-hidden rounded-t-xl bg-navy-900">
                          {event.image && <img src={event.image} alt="" className="w-full h-full object-cover" />}
                          <div className="absolute top-3 right-3">
                            <Badge variant="secondary" className="text-xs">{event.event_type_label}</Badge>
                          </div>
                        </div>
                        <CardContent className="p-6">
                          <h3 className="font-bold text-navy-950 mb-2 line-clamp-2">{event.title}</h3>
                          <p className="text-gray-600 mb-4 line-clamp-2">{event.summary || event.description}</p>
                          <div className="space-y-2 text-sm text-navy-700">
                            <div className="flex items-center gap-2">
                              <LordIconComponent src={LordIcons.calendar} size={16} />
                              <span>{formatEventWindow(event)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <LordIconComponent src={LordIcons.location} size={16} />
                              <span>{event.is_online ? 'Online' : event.location || 'Venue to be confirmed'}</span>
                            </div>
                          </div>
                          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                            <span className="font-medium text-navy-900 text-sm">{seatLine(event)}</span>
                            {registerAction(event, '')}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {rest.map((event) => (
                      <Card key={event.id} className="hover:shadow-lg transition-all duration-300 border-gray-100">
                        <CardContent className="p-6">
                          <div className="flex flex-col md:flex-row md:items-center gap-6">
                            <div className="relative w-32 h-32 md:w-40 md:h-40 flex-shrink-0 rounded-xl overflow-hidden bg-navy-900">
                              {event.image && <img src={event.image} alt="" className="w-full h-full object-cover" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap gap-2 mb-2">
                                <Badge variant="outline" className="text-xs text-navy-700 border-navy-200 bg-navy-50">
                                  {event.event_type_label}
                                </Badge>
                                <Badge className="bg-gold-brand text-navy-950 text-xs">{seatLine(event)}</Badge>
                              </div>
                              <h3 className="font-bold text-navy-950 mb-2">{event.title}</h3>
                              <p className="text-gray-600 mb-4 line-clamp-2">{event.summary || event.description}</p>
                              <div className="flex flex-wrap gap-6 text-sm text-navy-700">
                                <div className="flex items-center gap-2">
                                  <LordIconComponent src={LordIcons.calendar} size={16} />
                                  <span>{formatEventWindow(event)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <LordIconComponent src={LordIcons.location} size={16} />
                                  <span>{event.is_online ? 'Online' : event.location || 'Venue to be confirmed'}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex-shrink-0 md:w-48">{registerAction(event)}</div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {!error && !loading && filteredPast.length > 0 && (
          <section className="py-16 bg-navy-950" aria-labelledby="past-events-heading">
            <div className="mx-auto max-w-7xl px-6">
              <div className="text-center mb-12">
                <h2 id="past-events-heading" className="text-3xl sm:text-4xl font-black text-white mb-4">
                  Recently held
                </h2>
                <p className="text-navy-200 max-w-3xl mx-auto">
                  A record of what the community has already taken part in.
                </p>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPast.map((event) => (
                  <Card key={event.id} className="bg-navy-900/50 border-navy-800 h-full">
                    <CardContent className="p-8">
                      <Badge variant="secondary" className="text-xs mb-4">{event.event_type_label}</Badge>
                      <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">{event.title}</h3>
                      <p className="text-navy-200 text-sm mb-4 line-clamp-2">{event.summary || event.description}</p>
                      <div className="flex items-center gap-2 text-navy-300 text-sm">
                        <LordIconComponent src={LordIcons.calendar} size={16} />
                        <span>{formatEventWindow(event)}</span>
                      </div>
                      <p className="mt-4 text-sm text-navy-300">{seatLine(event)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Modal isOpen={!!rsvpFor} onClose={() => setRsvpFor(null)} title="Reserve your seat" size="sm">
        {rsvpFor && (
          done ? (
            <div className="space-y-6">
              <p role="status" className="rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-800">{done}</p>
              <p className="text-sm text-gray-600">{rsvpFor.title} — {formatEventWindow(rsvpFor)}</p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => addToCalendar(rsvpFor)} variant="outline">Add to calendar</Button>
                <Button onClick={() => setRsvpFor(null)} className="bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold">
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={submitRsvp} className="space-y-4">
              <p className="text-sm text-gray-600">{formatEventWindow(rsvpFor)}</p>
              <Input
                label="Full name"
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                autoComplete="name"
              />
              <Input
                label="Email"
                type="email"
                required
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                autoComplete="email"
              />
              <Input
                label="Phone (optional)"
                type="tel"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                autoComplete="tel"
              />
              <div>
                <label htmlFor="event-note" className="block text-sm font-semibold text-navy-900 mb-2">
                  Anything we should know? (optional)
                </label>
                <textarea
                  id="event-note"
                  rows={3}
                  value={form.note}
                  onChange={(event) => setForm({ ...form, note: event.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition-colors resize-y"
                />
              </div>
              {formError && <p role="alert" className="text-sm font-semibold text-red-700">{formError}</p>}
              <Button
                type="submit"
                loading={submitting}
                className="w-full bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold"
              >
                Confirm registration
              </Button>
            </form>
          )
        )}
      </Modal>
    </div>
  );
}
