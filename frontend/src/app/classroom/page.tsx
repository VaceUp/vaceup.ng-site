'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { api, ApiError, type LiveClassEntry } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { formatWorkspaceDate, webUrl, type WorkspaceClass } from '@/lib/workspace-api';
import type { RoomChrome } from '@/components/live/LiveRoom';
import { Button } from '@/components/ui/Button';

// The room pulls in the WebRTC client, which only exists in a browser.
const LiveRoom = dynamic(() => import('@/components/live/LiveRoom'), {
  ssr: false,
  loading: () => <p role="status" className="p-6 text-sm text-gray-500">Loading the classroom…</p>,
});

export default function ClassroomPage() {
  // A static export has no server render, so the query string needs a boundary.
  return (
    <Suspense fallback={<p role="status" className="p-6 text-sm text-gray-500">Finding your class…</p>}>
      <ClassroomRoute />
    </Suspense>
  );
}

function ClassroomRoute() {
  const params = useSearchParams();
  const raw = params.get('class')?.trim() || '';
  const id = Number(raw);
  const valid = Number.isInteger(id) && id > 0;
  const { user, isLoading } = useAuth();
  // Reading the class is a plain GET. The room is only opened when the person
  // presses the button, so arriving here does not start the camera.
  const session = useWorkspaceResource<WorkspaceClass>(user && valid ? `/live-classes/${id}/` : null);
  const [access, setAccess] = useState<Extract<LiveClassEntry, { provider: 'livekit' }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    setAccess(null);
    setProblem('');
  }, [id]);

  // The room asks for this again whenever the person presses Try again: the
  // credential expires, so a page left open cannot reconnect with it.
  const freshSeat = async () => {
    const result = await api.joinLiveClass(String(id));
    if (result.provider !== 'livekit') {
      throw new Error('This class is no longer running in the VaceUp Live Room. Reload this page.');
    }
    return result;
  };

  const enter = async () => {
    setBusy(true);
    setProblem('');
    try {
      const result = await api.joinLiveClass(String(id));
      if (result.provider === 'external') {
        const url = webUrl(result.url);
        if (!url) {
          setProblem('This class names a meeting link that cannot be used. Ask your tutor to check the link.');
          return;
        }
        // A full page move beats a popup: the outside meeting takes the screen.
        window.location.replace(url);
        return;
      }
      setAccess(result);
    } catch (error: unknown) {
      setAccess(null);
      setProblem(error instanceof ApiError && error.status < 500 && error.message
        ? error.message
        : 'The classroom could not be opened. Check your connection and try again.');
      // A class can close between opening this page and pressing the button.
      session.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return <p role="status" className="p-6 text-sm text-gray-500">Checking your account…</p>;
  }

  if (!user) {
    return (
      <Shell eyebrow="VaceUp classroom">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-navy-950">Sign in to enter this class</h1>
          <p className="mt-3 text-gray-700">
            Your VaceUp account is what holds your place in a live class. There is no
            separate code to enter.
          </p>
          <div className="mt-6">
            <Link
              href={`/login?next=${encodeURIComponent(valid ? `/classroom/?class=${id}` : '/dashboard/live-classes')}`}
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
      title="This link does not name a class"
      body="Open the class again from Live classes in your dashboard." />;
  }

  if (access) {
    const chrome: RoomChrome = {
      recordingScope: { kind: 'class', id: String(id) },
      title: session.data?.title ?? 'Live class',
      leftNote: 'Your place is still held while this class is open. Come back any time before it ends.',
      waitingNote: 'Nobody else has walked in yet. Everyone enrolled opens this class from their own dashboard.',
      returnHref: '/dashboard/live-classes',
      returnLabel: 'Back to live classes',
      links: [
        {
          label: 'My live classes',
          href: '/dashboard/live-classes',
          hint: 'The schedule and recordings for this class',
        },
        ...(session.data
          ? [{
              label: 'Course materials',
              href: '/dashboard/learn',
              hint: `Lessons and resources for ${session.data.course_title}`,
            }]
          : []),
      ],
    };
    return <LiveRoom access={access} chrome={chrome} refreshAccess={freshSeat} />;
  }

  const item = session.data;
  const closed = item ? ['ended', 'cancelled'].includes(item.status) : false;
  const joinable = Boolean(item?.joinable);

  return (
    <Shell eyebrow="VaceUp classroom">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-navy-950">{item?.title ?? 'Your live class'}</h1>
        {session.loading && !item && <p role="status" className="mt-3 text-gray-700">Finding your class…</p>}
        {session.error && !item && <p role="alert" className="mt-3 text-gray-700">{session.error}</p>}
        {item && (
          <>
            <p className="mt-3 text-gray-700">
              {item.course_title} · {item.duration_minutes} minutes ·{' '}
              {formatWorkspaceDate(item.scheduled_start, true)}
            </p>
            {item.description && <p className="mt-3 whitespace-pre-wrap text-gray-700">{item.description}</p>}
            <p className="mt-3 text-sm text-gray-500">
              The classroom carries your microphone, camera and screen share. Everyone
              in the class can use all three.
            </p>
          </>
        )}

        {problem && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{problem}</p>}

        {item && (
          <div className="mt-6 flex flex-col gap-3">
            {closed && (
              <p role="status" className="text-sm text-gray-700">
                {item.status === 'cancelled'
                  ? 'This class was called off. Ask your tutor what replaced it.'
                  : 'This class has finished. Its recording appears in the schedule when it is ready.'}
              </p>
            )}
            {!closed && joinable && (
              <Button
                onClick={() => void enter()}
                loading={busy}
                className="bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold"
              >
                Enter classroom
              </Button>
            )}
            {!closed && !joinable && (
              <>
                <p role="status" className="text-sm text-gray-700">
                  Joining opens shortly before the start time. Come back then, or check again now.
                </p>
                <Button variant="outline" onClick={session.refresh} disabled={session.loading}>
                  Check again
                </Button>
              </>
            )}
            <Link
              href="/dashboard/live-classes"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-navy-900 px-5 text-sm font-semibold text-navy-900 hover:bg-navy-50"
            >
              Back to live classes
            </Link>
          </div>
        )}
      </div>
    </Shell>
  );
}

/**
 * The door before the room: one card, held in the middle of the screen, with
 * the wordmark so a learner who arrives from the dashboard knows where they are.
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
    <Shell eyebrow="VaceUp classroom">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-navy-950">{title}</h1>
        <p className="mt-3 text-gray-700">{body}</p>
        <div className="mt-6">
          <Link
            href="/dashboard/live-classes"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-navy-900 px-5 text-sm font-semibold text-navy-900 hover:bg-navy-50"
          >
            Go to live classes
          </Link>
        </div>
      </div>
    </Shell>
  );
}
