'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { webUrl } from '@/lib/workspace-api';
import type { EventAccess } from '@/lib/website-api';

type RoomAccess = Extract<EventAccess, { provider: 'jitsi' }>;

type JitsiApi = {
  on: (event: string, handler: () => void) => void;
  dispose?: () => void;
};

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => JitsiApi;
  }
}

/**
 * The Jitsi room an attendee is sent into. Jitsi brings its own controls, so
 * this page mounts the room, keeps a way out for a browser that blocks the
 * embed, and never prints the room address — that name is the only thing
 * guarding the meeting.
 */
export default function JitsiRoom({ access, eventSlug }: { access: RoomAccess; eventSlug: string }) {
  const holder = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<'loading' | 'in' | 'blocked' | 'left'>('loading');
  const [session, setSession] = useState(0);
  const roomUrl = webUrl(access.url);

  useEffect(() => {
    const mount = holder.current;
    if (!mount) {
      setPhase('blocked');
      return undefined;
    }
    let cancelled = false;
    let api: JitsiApi | null = null;

    const boot = () => {
      if (cancelled) return;
      const Library = window.JitsiMeetExternalAPI;
      if (!Library) {
        setPhase('blocked');
        return;
      }
      api = new Library(access.domain, {
        roomName: access.room,
        parentNode: mount,
        userInfo: { displayName: access.display_name },
        width: '100%',
        height: '100%',
      });
      // The embed script leaves the frame at the browser's default 300x150 on
      // some builds, so the room is pinned to the page here instead.
      const frame = mount.querySelector('iframe');
      if (frame) {
        frame.title = 'VaceUp live room';
        frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0';
      }
      api.on('readyToClose', () => setPhase('left'));
      setPhase('in');
    };

    if (window.JitsiMeetExternalAPI) {
      boot();
    } else {
      const script = document.createElement('script');
      script.src = `https://${access.domain}/external_api.js`;
      script.async = true;
      script.onload = boot;
      script.onerror = () => {
        if (!cancelled) setPhase('blocked');
      };
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      api?.dispose?.();
      mount.replaceChildren();
    };
  }, [access.domain, access.room, access.display_name, session]);

  const reopen = () => {
    setPhase('loading');
    setSession((value) => value + 1);
  };

  if (phase === 'left') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950 px-6 py-12">
        <div className="w-full max-w-md rounded-3xl bg-navy-900 p-8 text-center">
          <h1 className="text-xl font-bold text-white">You left the room</h1>
          <p className="mt-3 text-sm text-navy-200">
            Your seat is still held. Come back any time until the event ends.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Button
              onClick={reopen}
              className="bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold"
            >
              Go back in
            </Button>
            <Link
              href={`/events/?slug=${encodeURIComponent(eventSlug)}`}
              className="min-h-[44px] inline-flex items-center justify-center rounded-xl border-2 border-navy-600 px-5 text-sm font-semibold text-navy-100 hover:border-navy-400"
            >
              Back to the event page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-navy-950">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-800 px-5 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">VaceUp Live Room</p>
          <p role="status" className="text-xs text-navy-300">
            {phase === 'loading' && 'Opening the live room…'}
            {phase === 'in' && `You are in as ${access.display_name || 'a guest'}.`}
            {phase === 'blocked' && 'The room is not showing inside this page.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {access.is_host && (
            <span className="rounded-full border border-gold-brand px-3 py-1 text-xs font-semibold text-gold-brand">
              Previewing
            </span>
          )}
          <a
            href={roomUrl ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!roomUrl}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-navy-600 px-4 text-sm font-semibold text-navy-100 hover:border-navy-400"
          >
            Open in another tab
          </a>
        </div>
      </header>

      {access.is_host && phase !== 'loading' && (
        <p className="border-b border-navy-800 bg-navy-900 px-5 py-3 text-sm text-navy-100">
          The free Jitsi server has no moderator, so everyone who reaches this room
          can speak and share their screen. The LiveKit room is the one that gives
          you control over the floor.
        </p>
      )}

      {phase === 'blocked' && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-red-900/50 px-5 py-3">
          <p role="alert" className="text-sm font-semibold text-red-50">
            Your browser would not show the room inside this page. It usually opens
            in its own tab.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="border-red-100 text-red-50 hover:bg-red-800"
            onClick={reopen}
          >
            Try again
          </Button>
        </div>
      )}

      <main className="flex flex-1 flex-col">
        <div ref={holder} className="relative min-h-[70vh] flex-1" />
      </main>
    </div>
  );
}
