'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getEvent, joinEvent, resendJoinLink, type EventAccess } from '@/lib/website-api';
import { webUrl } from '@/lib/workspace-api';

// The room pulls in the WebRTC client, which only exists in a browser.
const LiveRoom = dynamic(() => import('@/components/live/LiveRoom'), {
  ssr: false,
  loading: () => <p role="status" className="p-6 text-sm text-gray-500">Loading the live room…</p>,
});
// Jitsi is mounted by its own embed script, which also only exists in a browser.
const JitsiRoom = dynamic(() => import('@/components/live/JitsiRoom'), {
  ssr: false,
  loading: () => <p role="status" className="p-6 text-sm text-gray-500">Loading the live room…</p>,
});

export default function LiveEventPage() {
  // A static export has no server render, so the query string needs a boundary.
  return (
    <Suspense fallback={<p role="status" className="p-6 text-sm text-gray-500">Checking your seat…</p>}>
      <LiveRoute />
    </Suspense>
  );
}

function LiveRoute() {
  const params = useSearchParams();
  const slug = params.get('event')?.trim() || '';
  const token = params.get('token')?.trim() || '';
  const { user, isLoading } = useAuth();
  const isStaff = user?.role === 'admin';
  const [access, setAccess] = useState<EventAccess | null>(null);
  const [eventName, setEventName] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'checking' | 'blocked' | 'waiting' | 'open'>('checking');

  useEffect(() => {
    if (!slug) {
      setState('blocked');
      setMessage('This link does not name an event. Open the Events page and use the link in your confirmation email.');
      return;
    }
    // The academy runs the room from the Events screen, so a signed-in admin
    // needs no seat link; everyone else proves the seat with their token.
    if (isLoading) {
      setState('checking');
      return;
    }
    if (!token && !isStaff) {
      setState('blocked');
      setMessage('Use the personal link in your confirmation email — it is what holds your seat. We can send it to you again below.');
      return;
    }
    let cancelled = false;
    setState('checking');
    setMessage('');
    joinEvent(slug, token)
      .then((result) => {
        if (cancelled) return;
        setAccess(result);
        setState(result.provider === 'external' ? 'waiting' : 'open');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAccess(null);
        setState('blocked');
        setMessage(error instanceof Error && error.message
          ? error.message
          : 'The room could not be opened right now. Try again in a moment.');
      });
    return () => { cancelled = true; };
  }, [slug, token, isLoading, isStaff]);

  const externalUrl = access?.provider === 'external' ? webUrl(access.url) : null;

  // A full page move beats a popup here: nothing to allow, and the meeting
  // takes the whole screen the way an attendee expects.
  useEffect(() => {
    if (externalUrl) window.location.replace(externalUrl);
  }, [externalUrl]);

  // The room header names the event rather than the LiveKit room address. A
  // draft event has no public record to read, so the plain label is the fallback.
  useEffect(() => {
    if (!slug) return undefined;
    let cancelled = false;
    getEvent(slug)
      .then((event) => { if (!cancelled) setEventName(event.title); })
      .catch(() => { if (!cancelled) setEventName(''); });
    return () => { cancelled = true; };
  }, [slug]);

  const chrome = {
    title: eventName || 'VaceUp Live Room',
    leftNote: 'Your seat is still held. Come back any time until the event ends.',
    waitingNote: 'You are the only one here so far. The room stays open and everyone you invited can walk in with their own link.',
    returnHref: `/events/?slug=${encodeURIComponent(slug)}`,
    returnLabel: 'Back to the event page',
  };

  if (access?.provider === 'livekit') {
    // The room re-asks for the seat when the person presses Try again, because
    // the credential it was handed is minted for one dial and goes stale.
    const freshSeat = async () => {
      const result = await joinEvent(slug, token);
      if (result.provider !== 'livekit') {
        throw new Error('This event is no longer running in the VaceUp Live Room. Reload this page.');
      }
      return result;
    };
    return <LiveRoom access={access} chrome={chrome} refreshAccess={freshSeat} />;
  }

  if (access?.provider === 'jitsi') {
    return <JitsiRoom access={access} eventSlug={slug} />;
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-navy-950">
          {access?.provider === 'external' ? 'Taking you to the meeting' : 'Your seat'}
        </h1>

        {access?.provider === 'external' ? (
          <>
            <p className="mt-3 text-gray-700">
              Hello {access.display_name}. If the meeting did not open, use the button below.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {externalUrl && (
                <a
                  href={externalUrl}
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gold-brand px-5 font-bold text-navy-950 hover:bg-gold-hover"
                >
                  Open the meeting
                </a>
              )}
              <Link
                href={`/events/?slug=${encodeURIComponent(slug)}`}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-navy-900 px-5 text-sm font-semibold text-navy-900 hover:bg-navy-50"
              >
                Back to the event page
              </Link>
            </div>
          </>
        ) : state === 'checking' ? (
          <p role="status" className="mt-3 text-gray-700">Checking your seat…</p>
        ) : (
          <>
            <p role="alert" className="mt-3 text-gray-700">{message}</p>
            {slug && <SeatLink slug={slug} />}
            <div className="mt-6">
              <Link
                href={`/events/?slug=${encodeURIComponent(slug || '')}`}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-navy-900 px-5 text-sm font-semibold text-navy-900 hover:bg-navy-50"
              >
                {slug ? 'Back to the event page' : 'See upcoming events'}
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

/** Recovery for the attendee whose email is buried — the seat is proved by receiving the mail. */
function SeatLink({ slug }: { slug: string }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await resendJoinLink(slug, email.trim());
      setSent(result.detail);
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 429
        ? 'Too many requests just now. Wait a minute and press the button again.'
        : 'We could not send the link. Check the email address and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-3 border-t border-gray-200 pt-6">
      <p className="text-sm font-semibold text-navy-900">Cannot find the email?</p>
      <Input
        label="Email you registered with"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        placeholder="you@example.com"
      />
      {sent && <p role="status" className="text-sm font-semibold text-green-700">{sent}</p>}
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
      <Button
        type="submit"
        loading={busy}
        disabled={!email.trim()}
        className="bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold"
      >
        Send my joining link
      </Button>
    </form>
  );
}
