'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ConnectionState, Room, RoomEvent, Track, type Participant } from 'livekit-client';
import { Button } from '@/components/ui/Button';
import type { EventAccess } from '@/lib/website-api';

type RoomAccess = Extract<EventAccess, { provider: 'livekit' }>;

type Tile = {
  key: string;
  name: string;
  isLocal: boolean;
  speaking: boolean;
  micOn: boolean;
  camOn: boolean;
  sharing: boolean;
  videoTrack: MediaStreamTrack | null;
  shareTrack: MediaStreamTrack | null;
};

/**
 * The words and doors around a room, supplied by whoever opened it.
 *
 * The LiveKit room address is deliberately not shown anywhere: for a staff
 * meeting it carries a private code, and printing it on screen would let a
 * screenshot open a room the viewer was never invited to.
 */
export type RoomChrome = {
  /** A human name for the call — the event title or the meeting title. */
  title: string;
  /** Shown after the person steps out, where they decide whether to go back. */
  leftNote: string;
  /** Shown when the room is open but nobody else has walked in yet. */
  waitingNote: string;
  returnHref: string;
  returnLabel: string;
};

const videoTrackOf = (participant: Participant, source: Track.Source): MediaStreamTrack | null => {
  const publication = participant.getTrackPublication(source);
  const track = publication?.track;
  return track && track.kind === Track.Kind.Video ? track.mediaStreamTrack : null;
};

const initialsOf = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`;
  return letters.toUpperCase() || 'VaceUp';
};

/** One live video pane. The local pane is silenced so nobody hears themselves. */
function Pane({ track, muted, label }: { track: MediaStreamTrack | null; muted: boolean; label: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    if (!track) {
      element.srcObject = null;
      return undefined;
    }
    element.srcObject = new MediaStream([track]);
    return () => {
      element.srcObject = null;
    };
  }, [track]);

  if (!track) return null;
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      aria-label={label}
      className="h-full w-full bg-navy-950 object-contain"
    />
  );
}

function TileCard({ tile, large }: { tile: Tile; large?: boolean }) {
  return (
    <div
      className={
        large
          ? 'relative aspect-video w-full overflow-hidden rounded-2xl bg-navy-900 ring-2 ring-navy-700'
          : `relative aspect-video w-full overflow-hidden rounded-xl bg-navy-900 ${
              tile.speaking ? 'ring-2 ring-gold-brand' : 'ring-1 ring-navy-700'
            }`
      }
    >
      {tile.videoTrack || tile.shareTrack ? (
        <>
          <Pane track={tile.shareTrack} muted={tile.isLocal} label={`${tile.name} screen share`} />
          {!tile.shareTrack && (
            <Pane track={tile.videoTrack} muted={tile.isLocal} label={`${tile.name} camera`} />
          )}
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span
            className={
              large
                ? 'flex size-24 items-center justify-center rounded-full bg-navy-800 text-2xl font-bold text-navy-100'
                : 'flex size-12 items-center justify-center rounded-full bg-navy-800 text-sm font-bold text-navy-100'
            }
            aria-hidden="true"
          >
            {initialsOf(tile.name)}
          </span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-navy-950/70 px-3 py-1.5">
        <span className="truncate text-xs font-semibold text-white">
          {tile.isLocal ? 'You' : tile.name}
        </span>
        {!tile.micOn && <i className="bi bi-mic-mute-fill text-xs text-gold-brand" aria-hidden="true" />}
        <span className="sr-only">{tile.micOn ? 'Microphone on' : 'Microphone off'}</span>
      </div>
    </div>
  );
}

export default function LiveRoom({ access, chrome }: { access: RoomAccess; chrome: RoomChrome }) {
  const [session, setSession] = useState(0);
  const [left, setLeft] = useState(false);

  if (left) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950 px-6 py-12">
        <div className="w-full max-w-md rounded-3xl bg-navy-900 p-8 text-center">
          <h1 className="text-xl font-bold text-white">You left the room</h1>
          <p className="mt-3 text-sm text-navy-200">{chrome.leftNote}</p>
          <div className="mt-6 flex flex-col gap-3">
            <Button
              onClick={() => { setLeft(false); setSession((value) => value + 1); }}
              className="bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold"
            >
              Go back in
            </Button>
            <Link
              href={chrome.returnHref}
              className="min-h-[44px] inline-flex items-center justify-center rounded-xl border-2 border-navy-600 px-5 text-sm font-semibold text-navy-100 hover:border-navy-400"
            >
              {chrome.returnLabel}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <RoomSession key={session} access={access} chrome={chrome} onLeave={() => setLeft(true)} onReconnect={() => setSession((value) => value + 1)} />;
}

/** Whether the browser can actually dial this address as a LiveKit socket. */
function isDialable(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
  } catch {
    return false;
  }
}

function RoomSession({ access, chrome, onLeave, onReconnect }: { access: RoomAccess; chrome: RoomChrome; onLeave: () => void; onReconnect: () => void }) {
  const roomRef = useRef<Room | null>(null);
  const [phase, setPhase] = useState<'connecting' | 'live' | 'retrying' | 'failed'>('connecting');
  const [problem, setProblem] = useState('');
  const [soundNeeded, setSoundNeeded] = useState(false);
  const [tick, setTick] = useState(0);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [shareOn, setShareOn] = useState(false);

  useEffect(() => {
    // The client dials the address with `new URL()`, so an empty or scheme-less
    // one fails as "Failed to construct 'URL'" — a library's own words, which
    // tells the academy nothing. Checked here rather than trusted, because the
    // frontend deploys ahead of the backend and a stale server still hands out
    // whatever its .env held.
    if (!isDialable(access.ws_url)) {
      setPhase('failed');
      setProblem(
        'This server is not giving out a room address the browser can dial, so the '
        + 'meeting cannot open. The academy needs its LiveKit settings checked.',
      );
      return;
    }

    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    const bump = () => setTick((value) => value + 1);
    const events = [
      RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected,
      RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackMuted, RoomEvent.TrackUnmuted,
      RoomEvent.ActiveSpeakersChanged, RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished, RoomEvent.ParticipantMetadataChanged,
    ] as const;
    events.forEach((name) => room.on(name, bump));
    room.on(RoomEvent.ConnectionStateChanged, (next: ConnectionState) => {
      if (next === ConnectionState.Connected) setPhase('live');
      else if (next === ConnectionState.Reconnecting) setPhase('retrying');
      else if (next === ConnectionState.Disconnected) setPhase('failed');
      bump();
    });

    room.connect(access.ws_url, access.token)
      .then(async () => {
        setPhase('live');
        try {
          await room.startAudio();
        } catch {
          // Browsers hold sound until a touch on this page; the banner below asks for it.
          setSoundNeeded(true);
        }
      })
      .catch((error: unknown) => {
        setPhase('failed');
        // The client's own words are for whoever fixes the server, not for the
        // person standing in the doorway, so they go to the console and the
        // screen gets the one thing they can do next.
        console.error('The live room could not connect', error);
        setProblem('The live room could not be reached. Check your connection, then press Try again.');
      })
      .finally(bump);

    return () => {
      room.removeAllListeners();
      void room.disconnect();
      roomRef.current = null;
    };
  }, [access.ws_url, access.token]);

  const tiles = useMemo<Tile[]>(() => {
    const room = roomRef.current;
    if (!room) return [];
    const people: Participant[] = [room.localParticipant, ...Array.from(room.remoteParticipants.values())];
    return people.map((person) => ({
      key: person.sid || person.identity,
      name: person.name || person.identity || (person.isLocal ? 'You' : 'Guest'),
      isLocal: person.isLocal,
      speaking: person.isSpeaking,
      micOn: person.isMicrophoneEnabled,
      camOn: person.isCameraEnabled,
      sharing: person.isScreenShareEnabled,
      videoTrack: videoTrackOf(person, Track.Source.Camera),
      shareTrack: videoTrackOf(person, Track.Source.ScreenShare),
    }));
  }, [tick, phase]);

  const shared = tiles.find((tile) => tile.shareTrack);
  const talking = tiles.find((tile) => tile.speaking && tile.videoTrack);
  const onCamera = tiles.find((tile) => tile.videoTrack && !tile.isLocal)
    ?? tiles.find((tile) => tile.videoTrack);
  const stage = shared ?? talking ?? onCamera ?? tiles.find((tile) => tile.isLocal) ?? null;
  const strip = tiles.filter((tile) => tile.key !== stage?.key);
  const others = Math.max(0, tiles.length - 1);
  const offline = phase === 'connecting' || phase === 'failed';

  const toggle = async (kind: 'mic' | 'cam' | 'share') => {
    const room = roomRef.current;
    if (!room) return;
    setProblem('');
    const next = kind === 'mic' ? !micOn : kind === 'cam' ? !camOn : !shareOn;
    try {
      if (soundNeeded) {
        await room.startAudio();
        setSoundNeeded(false);
      }
      if (kind === 'mic') await room.localParticipant.setMicrophoneEnabled(next);
      if (kind === 'cam') await room.localParticipant.setCameraEnabled(next);
      if (kind === 'share') await room.localParticipant.setScreenShareEnabled(next);
      if (kind === 'mic') setMicOn(next);
      if (kind === 'cam') setCamOn(next);
      if (kind === 'share') setShareOn(next);
    } catch {
      setProblem(kind === 'share'
        ? 'Your browser would not let us capture the screen. Close other captures and try again.'
        : `Your browser blocked the ${kind === 'mic' ? 'microphone' : 'camera'}. Allow it in the address bar, then press the button again.`);
    }
  };

  const leave = () => {
    void roomRef.current?.disconnect();
    onLeave();
  };

  return (
    <div className="flex min-h-screen flex-col bg-navy-950">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-800 px-5 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{chrome.title}</p>
          <p role="status" className="text-xs text-navy-300">
            {phase === 'connecting' && 'Opening the room…'}
            {phase === 'live' &&
              `${access.is_host ? 'Hosting' : 'In the room'} · ${tiles.length} ${tiles.length === 1 ? 'person' : 'people'}`}
            {phase === 'retrying' && 'Connection dropped — reconnecting…'}
            {phase === 'failed' && 'Not connected.'}
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={leave}>Leave</Button>
      </header>

      {soundNeeded && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-navy-800 px-5 py-3">
          <p className="text-sm text-navy-100">Your browser is waiting for you before it plays sound.</p>
          <Button
            size="sm"
            className="bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold"
            onClick={() => {
              void roomRef.current?.startAudio().then(() => setSoundNeeded(false)).catch(() => setProblem('Sound did not start. Press again.'));
            }}
          >
            Enable sound
          </Button>
        </div>
      )}

      {(problem || phase === 'failed') && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-red-900/50 px-5 py-3">
          <p role="alert" className="text-sm font-semibold text-red-50">
            {problem || 'The live room dropped and could not reconnect.'}
          </p>
          {phase === 'failed' && (
            <Button size="sm" variant="outline" className="border-red-100 text-red-50 hover:bg-red-800" onClick={onReconnect}>
              Try again
            </Button>
          )}
        </div>
      )}

      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {phase === 'connecting' ? (
          <p role="status" className="m-auto text-sm text-navy-300">Opening the room…</p>
        ) : stage ? (
          <div className="mx-auto w-full max-w-5xl">
            <TileCard tile={stage} large />
            {others > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {strip.map((tile) => <TileCard key={tile.key} tile={tile} />)}
              </div>
            )}
          </div>
        ) : (
          <p className="m-auto max-w-sm text-center text-sm text-navy-300">
            {chrome.waitingNote}
          </p>
        )}
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-3 border-t border-navy-800 px-5 py-4">
        <Button
          variant={micOn ? 'secondary' : 'outline'}
          onClick={() => void toggle('mic')}
          aria-pressed={micOn}
          disabled={offline}
          className={micOn ? '' : 'border-navy-600 text-navy-100 hover:bg-navy-800'}
        >
          <i className={`bi ${micOn ? 'bi-mic-fill' : 'bi-mic-mute-fill'}`} aria-hidden="true" />
          {micOn ? 'Mute' : 'Unmute'}
        </Button>
        <Button
          variant={camOn ? 'secondary' : 'outline'}
          onClick={() => void toggle('cam')}
          aria-pressed={camOn}
          disabled={offline}
          className={camOn ? '' : 'border-navy-600 text-navy-100 hover:bg-navy-800'}
        >
          <i className={`bi ${camOn ? 'bi-camera-video-fill' : 'bi-camera-video-off-fill'}`} aria-hidden="true" />
          {camOn ? 'Camera off' : 'Camera on'}
        </Button>
        {access.is_host && (
          <Button
            variant={shareOn ? 'secondary' : 'outline'}
            onClick={() => void toggle('share')}
            aria-pressed={shareOn}
            disabled={offline}
            className={shareOn ? '' : 'border-navy-600 text-navy-100 hover:bg-navy-800'}
          >
            <i className="bi bi-display" aria-hidden="true" />
            {shareOn ? 'Stop sharing' : 'Share screen'}
          </Button>
        )}
      </footer>
    </div>
  );
}
