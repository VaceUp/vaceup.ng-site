'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { formatWorkspaceDate } from '@/lib/workspace-api';
import { openMeetingRoom, type Meeting, type MeetingRoomAccess } from '@/lib/meetings-api';
import type { RoomChrome } from '@/components/live/LiveRoom';
import { Button } from '@/components/ui/Button';

// The room pulls in the WebRTC client, which only exists in a browser.
const LiveRoom = dynamic(() => import('@/components/live/LiveRoom'), {
  ssr: false,
  loading: () => <p role="status" className="p-6 text-sm text-gray-500">Loading the meeting room…</p>,
});

export default function StaffMeetingPage() {
  // A static export has no server render, so the query string needs a boundary.
  return (
    <Suspense fallback={<p role="status" className="p-6 text-sm text-gray-500">Finding your meeting…</p>}>
      <MeetingRoute />
    </Suspense>
  );
}

function MeetingRoute() {
  const params = useSearchParams();
  const raw = params.get('meeting')?.trim() || '';
  const id = Number(raw);
  const valid = Number.isInteger(id) && id > 0;
  const { user, isLoading } = useAuth();
  // Reading the meeting is a plain GET; the room itself is only opened when the
  // person presses the button, so a tutor lands on a page that explains the call
  // before the browser starts asking for camera and microphone.
  const meeting = useWorkspaceResource<Meeting>(user && valid ? `/meetings/${id}/` : null);
  const [access, setAccess] = useState<MeetingRoomAccess | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    setAccess(null);
    setProblem('');
  }, [id]);

  const enter = async () => {
    setBusy(true);
    setProblem('');
    try {
      setAccess(await openMeetingRoom(id));
    } catch (error: unknown) {
      setAccess(null);
      setProblem(error instanceof Error && error.message
        ? error.message
        : 'The room could not be opened. Try again in a moment.');
      // The window may have closed while the page sat open, so re-read it.
      meeting.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return <p role="status" className="p-6 text-sm text-gray-500">Checking your account…</p>;
  }

  if (!user) {
    return (
      <Shell eyebrow="VaceUp staff meeting">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-navy-950">Sign in to open this meeting</h1>
          <p className="mt-3 text-gray-700">
            Your VaceUp account is what holds your place in a staff meeting. There is no
            separate code to enter.
          </p>
          <div className="mt-6">
            <Link
              href={`/login?next=${encodeURIComponent(valid ? `/meeting/?meeting=${id}` : '/dashboard')}`}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gold-brand px-5 font-bold text-navy-950 hover:bg-gold-hover"
            >
              Sign in
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  if (!valid) {
    return <Notice
      title="This link does not name a meeting"
      body="Open the meeting again from Staff meetings in your dashboard." />;
  }

  if (access) {
    const chrome: RoomChrome = {
      title: meeting.data?.title ?? 'Staff meeting',
      leftNote: 'This meeting is still booked. Go back in any time before it closes.',
      waitingNote: 'Nobody else has walked in yet. Your colleagues open this meeting from their own dashboard, and the invitation email leads to the same door.',
      returnHref: user.role === 'admin' ? '/dashboard?tab=meetings' : '/dashboard/meetings',
      returnLabel: 'Back to my meetings',
    };
    return <LiveRoom access={access} chrome={chrome} />;
  }

  const item = meeting.data;
  const closed = item ? item.status !== 'scheduled' : false;

  return (
    <Shell eyebrow="VaceUp staff meeting">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-navy-950">{item?.title ?? 'Your meeting'}</h1>
        {meeting.loading && !item && <p role="status" className="mt-3 text-gray-700">Finding your meeting…</p>}
        {meeting.error && !item && <p role="alert" className="mt-3 text-gray-700">{meeting.error}</p>}
        {item && (
          <>
            <p className="mt-3 text-gray-700">
              Booked by {item.host.full_name || 'a colleague'}
              {item.my_role === 'host' ? ' (you)' : ''} · {item.duration_minutes} minutes ·{' '}
              {formatWorkspaceDate(item.starts_at, true)}
            </p>
            {item.agenda && <p className="mt-3 whitespace-pre-wrap text-gray-700">{item.agenda}</p>}
            <p className="mt-3 text-sm text-gray-500">
              The room is open from {formatWorkspaceDate(item.starts_at, true)} until{' '}
              {formatWorkspaceDate(item.ends_at, true)}.
            </p>
          </>
        )}

        {problem && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{problem}</p>}

        {item && (
          <div className="mt-6 flex flex-col gap-3">
            {closed && (
              <p role="status" className="text-sm text-gray-700">
                {item.status === 'cancelled'
                  ? 'This meeting was called off. Ask the person who booked it what replaced it.'
                  : 'This meeting has finished. The room is closed.'}
              </p>
            )}
            {!closed && item.can_enter && (
              <Button
                onClick={() => void enter()}
                loading={busy}
                className="bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold"
              >
                Open the room
              </Button>
            )}
            {!closed && !item.can_enter && (
              <>
                <p role="status" className="text-sm text-gray-700">{item.entry_reason}</p>
                <Button variant="outline" onClick={meeting.refresh} disabled={meeting.loading}>
                  Check the time again
                </Button>
              </>
            )}
            <Link
              href={user.role === 'admin' ? '/dashboard?tab=meetings' : '/dashboard/meetings'}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-navy-900 px-5 text-sm font-semibold text-navy-900 hover:bg-navy-50"
            >
              Back to my meetings
            </Link>
          </div>
        )}
      </div>
    </Shell>
  );
}

/**
 * The door before the room: one card, held in the middle of the screen, with
 * the wordmark so a tutor who arrives from an email knows where they are.
 */
function Shell({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-16">
      <div className="w-full max-w-xl">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-navy-700">{eyebrow}</p>
        {children}
      </div>
    </main>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <Shell eyebrow="VaceUp staff meeting">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-navy-950">{title}</h1>
        <p className="mt-3 text-gray-700">{body}</p>
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-navy-900 px-5 text-sm font-semibold text-navy-900 hover:bg-navy-50"
          >
            Go to my dashboard
          </Link>
        </div>
      </div>
    </Shell>
  );
}
