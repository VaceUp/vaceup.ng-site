'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ConnectionError, ConnectionErrorReason, ConnectionState,
  ConnectionQuality, Room, RoomEvent, Track, type Participant, type TrackPublication,
} from 'livekit-client';
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

export default function LiveRoom({
  access, chrome, refreshAccess,
}: {
  access: RoomAccess;
  chrome: RoomChrome;
  /**
   * Ask the server for a fresh seat credential before dialling again.
   *
   * The token is minted once, when the person presses the button, and it
   * expires. A room that reuses it can never connect, so "Try again" would be a
   * dead control that blames the network for a key that simply went stale.
   */
  refreshAccess?: () => Promise<RoomAccess>;
}) {
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

  return (
    <RoomSession
      key={session}
      access={access}
      chrome={chrome}
      refreshAccess={refreshAccess}
      onLeave={() => setLeft(true)}
    />
  );
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

/**
 * What a refused connection means, in words the person standing in the room can act on.
 *
 * The client knows the difference between the room server refusing the key, the
 * video path timing out and the server being unreachable — but its own sentence
 * is written for whoever runs the server. Blaming the network for all three is
 * how a settings fault turns into a day of guessing, so the reason is
 * translated and the original line is kept underneath it for whoever is asked.
 */
function roomFailure(error: unknown): { next: string; said: string } {
  const said = error instanceof Error ? error.message : String(error ?? 'The room did not answer.');
  if (error instanceof ConnectionError) {
    switch (error.reason) {
      case ConnectionErrorReason.NotAllowed:
        return {
          said,
          next: 'The room server would not accept the key this page was given, so your '
            + 'seat did not open. Press Try again to be given a fresh one.',
        };
      case ConnectionErrorReason.Timeout:
        return {
          said,
          next: 'The room answered but the video path did not open in time, which is what '
            + 'a slow or heavily filtered network looks like. Press Try again.',
        };
      case ConnectionErrorReason.ServerUnreachable:
        return {
          said,
          next: 'This device could not reach the room server at all. Work, school and '
            + 'hotel networks often block video calls — if you are on one of those, '
            + 'switch to mobile data and press Try again.',
        };
      case ConnectionErrorReason.WebSocket:
        return {
          said,
          next: 'The line to the room server closed before the meeting started. Press Try '
            + 'again to open it fresh.',
        };
      case ConnectionErrorReason.InternalError:
      case ConnectionErrorReason.ServiceNotFound:
        return {
          said,
          next: 'The room server refused to open this room. Press Try again, and if it '
            + 'stays, the academy needs to check its LiveKit project.',
        };
      default:
        break;
    }
  }
  return {
    said,
    next: 'The live room could not be reached. Press Try again, and if it stays, tell the '
      + 'academy what is written below.',
  };
}

/**
 * Failures a flaky link causes rather than a bad key or a bad room.
 *
 * These are the ones worth re-dialling without the person doing anything: a name
 * server that answered late, a socket that died while the phone rejoined Wi-Fi,
 * a handshake that ran out of time. Each wait is longer than the last so a
 * network that is coming back gets time to come back.
 */
const AUTO_RETRY_DELAYS_MS = [2_000, 5_000, 12_000];

const worthRetrying = (error: unknown) =>
  error instanceof ConnectionError
  && (
    error.reason === ConnectionErrorReason.ServerUnreachable
    || error.reason === ConnectionErrorReason.Timeout
    || error.reason === ConnectionErrorReason.WebSocket
  );

/**
 * Ask the room's host for its front door, over ordinary https.
 *
 * When the socket fails the client blames the network, but "the network" is
 * three different faults: a name that will not resolve, a device that cannot
 * reach the host at all, or a host that is reachable while the live socket
 * alone is filtered. This tells the last two apart, because a device that can
 * fetch the host's front door has a working route to it.
 *
 * `no-cors` is deliberate: any answer at all, including an error page, means the
 * request reached the server, and the room host does not need to trust this origin.
 */
async function reachesRoomHost(wsUrl: string): Promise<boolean> {
  // AbortController rather than AbortSignal.timeout: the phones this room is
  // opened on can be a few browser versions behind, and a missing helper would
  // turn "could not ask" into a false "cannot reach".
  const stop = new AbortController();
  const timer = window.setTimeout(() => stop.abort(), 8_000);
  try {
    const url = new URL(wsUrl);
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
    url.pathname = '/';
    url.search = '';
    await fetch(url.toString(), { mode: 'no-cors', signal: stop.signal });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

function RoomSession({
  access, chrome, onLeave, refreshAccess,
}: {
  access: RoomAccess;
  chrome: RoomChrome;
  onLeave: () => void;
  refreshAccess?: () => Promise<RoomAccess>;
}) {
  const roomRef = useRef<Room | null>(null);
  // A retry may be dialling a credential the server only just minted, so the
  // live one is held here rather than read from the props again.
  const accessRef = useRef(access);
  const audioOnlyRef = useRef(false);
  // Counts the re-dials this screen has made on its own, so a link that keeps
  // failing ends on the sentence instead of looping forever.
  const autoTries = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<'connecting' | 'live' | 'retrying' | 'failed'>('connecting');
  const [problem, setProblem] = useState('');
  const [serverSaid, setServerSaid] = useState('');
  const [reachNote, setReachNote] = useState('');
  const [weak, setWeak] = useState(false);
  const [audioOnly, setAudioOnly] = useState(false);
  const [soundNeeded, setSoundNeeded] = useState(false);
  const [tick, setTick] = useState(0);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [shareOn, setShareOn] = useState(false);

  useEffect(() => {
    const seat = accessRef.current;
    let stopped = false;
    // The client dials the address with `new URL()`, so an empty or scheme-less
    // one fails as "Failed to construct 'URL'" — a library's own words, which
    // tells the academy nothing. Checked here rather than trusted, because the
    // frontend deploys ahead of the backend and a stale server still hands out
    // whatever its .env held.
    if (!isDialable(seat.ws_url)) {
      setPhase('failed');
      setProblem(
        'This server is not giving out a room address the browser can dial, so the '
        + 'meeting cannot open. The academy needs its LiveKit settings checked.',
      );
      return;
    }

    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    let retryTimer: number | undefined;
    let policyTimer: number | undefined;
    // The browser reports every request its own security policy refused. A
    // policy that forgets the room host blocks the socket and the check after
    // it, and the client then says "Failed to fetch" — words that blame the
    // person's internet for a setting on this site. Recording the refusals lets
    // this screen say which of the two it was.
    const policyBlocks: string[] = [];
    const onPolicyViolation = (event: SecurityPolicyViolationEvent) => {
      if (event.blockedURI) policyBlocks.push(event.blockedURI);
    };
    document.addEventListener('securitypolicyviolation', onPolicyViolation);
    // Resolve the room server's name and open TLS to it while the person is
    // still reading the screen, so the first dial does not pay for both. It is
    // deliberately not awaited and its failure is not reported: the dial below
    // is what decides whether the room opens.
    void room.prepareConnection(seat.ws_url, seat.token).catch(() => {});
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
      if (stopped) return;
      if (next === ConnectionState.Connected) setPhase('live');
      else if (next === ConnectionState.Reconnecting) setPhase('retrying');
      else if (next === ConnectionState.Disconnected) setPhase('failed');
      bump();
    });
    // The room measures the link it is actually carrying, so a struggling
    // person is told before they decide the call is broken.
    room.on(RoomEvent.ConnectionQualityChanged, (quality: ConnectionQuality, person: Participant) => {
      if (person.isLocal) setWeak(quality === ConnectionQuality.Lost);
    });
    // Someone switching their camera on mid-call must not cost a slow attendee
    // the audio they were already hearing.
    room.on(RoomEvent.TrackSubscribed, (track: Track, publication) => {
      if (audioOnlyRef.current && track.kind === Track.Kind.Video) void publication.setSubscribed(false);
      else bump();
    });

    room.connect(seat.ws_url, seat.token, {
      // A slow link needs more than one attempt and more than the default
      // fifteen seconds before the browser gives up on the video path — and a
      // handshake that takes twenty seconds over a poor connection is still a
      // handshake, not a failure.
      maxRetries: 3,
      peerConnectionTimeout: 30_000,
      websocketTimeout: 30_000,
    })
      .then(async () => {
        if (stopped) return;
        autoTries.current = 0;
        setPhase('live');
        try {
          await room.startAudio();
        } catch {
          // Browsers hold sound until a touch on this page; the banner below asks for it.
          setSoundNeeded(true);
        }
      })
      .catch((error: unknown) => {
        if (stopped) return;
        const failure = roomFailure(error);
        setPhase('failed');
        // The client's own words go to the console for whoever fixes the server;
        // the screen gets the reason translated and the line kept, small, so a
        // report arrives with the cause already named.
        console.error('The live room could not connect', error);
        setServerSaid(failure.said);

        let host = '';
        try {
          host = new URL(seat.ws_url).hostname;
        } catch {
          // isDialable already passed; there is no host to match against.
        }
        const policyRefused = () =>
          Boolean(host) && policyBlocks.some((blocked) => blocked.includes(host));
        const policySentence = 'This site\'s own security policy is refusing the room server, '
          + 'so the room cannot open until that setting is fixed. Neither your internet nor '
          + 'this device is at fault — tell the academy the live room is blocked by a site setting.';

        if (policyRefused()) {
          setProblem(policySentence);
          setReachNote('');
        } else {
          // A name server that answered late or Wi-Fi that came back mid-handshake
          // is often gone by the next attempt, so the link gets a few more before
          // the person has to do anything.
          const wait = AUTO_RETRY_DELAYS_MS[autoTries.current];
          if (worthRetrying(error) && wait !== undefined) {
            autoTries.current += 1;
            setProblem(
              `${failure.next} This screen is also dialling again in ${Math.round(wait / 1_000)} seconds.`,
            );
            retryTimer = window.setTimeout(() => {
              if (!stopped) setAttempt((value) => value + 1);
            }, wait);
          } else {
            setProblem(failure.next);
          }
          // Only worth asking when the socket was labelled unreachable: if the
          // device can fetch the host's front door, the route is fine and the
          // live connection alone is what is being filtered.
          if (error instanceof ConnectionError && error.reason === ConnectionErrorReason.ServerUnreachable) {
            // The violation event can land a tick after the socket fails, so the
            // policy is checked once more before the first re-dial: re-dialling
            // cannot fix a policy, and the person should not be sent to their
            // settings app for it.
            policyTimer = window.setTimeout(() => {
              if (stopped || !policyRefused()) return;
              window.clearTimeout(retryTimer);
              setProblem(policySentence);
              setReachNote('');
            }, 500);
            void reachesRoomHost(seat.ws_url).then((reachable) => {
              if (stopped) return;
              setReachNote(reachable
                ? 'Check: this device reaches the room server over ordinary web, so the live connection itself is what is being blocked.'
                : 'Check: this device cannot reach the room server even over ordinary web, so a VPN, an ad-blocking DNS app or a proxy on this device is the likely cause.');
            });
          }
        }
      })
      .finally(bump);

    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(policyTimer);
      document.removeEventListener('securitypolicyviolation', onPolicyViolation);
      room.removeAllListeners();
      void room.disconnect();
      roomRef.current = null;
    };
  }, [attempt]);

  /** Dial again, with a credential the server has just been asked for. */
  const retry = async () => {
    autoTries.current = 0;
    setProblem('');
    setServerSaid('');
    setReachNote('');
    setPhase('connecting');
    if (refreshAccess) {
      try {
        accessRef.current = await refreshAccess();
      } catch (error: unknown) {
        setPhase('failed');
        setProblem(error instanceof Error && error.message
          ? error.message
          : 'Your seat could not be re-checked with the server. Press Try again in a moment.');
        return;
      }
    }
    setAttempt((value) => value + 1);
  };

  /**
   * Drop the pictures and keep the voices, which is the difference between a
   * usable call and none at all on a weak or metered connection.
   */
  const keepAudio = async (on: boolean) => {
    const room = roomRef.current;
    audioOnlyRef.current = on;
    setAudioOnly(on);
    if (!room) return;
    try {
      if (on && room.localParticipant.isCameraEnabled) {
        await room.localParticipant.setCameraEnabled(false);
        setCamOn(false);
      }
      for (const person of room.remoteParticipants.values()) {
        for (const publication of person.videoTrackPublications.values()) {
          await publication.setSubscribed(!on);
        }
      }
    } catch {
      setProblem('The room would not change what it sends. Press the button again.');
    }
    setTick((value) => value + 1);
  };

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
        <div className="flex flex-wrap items-start justify-between gap-3 bg-red-900/50 px-5 py-3">
          <div className="min-w-0 flex-1">
            <p role="alert" className="text-sm font-semibold text-red-50">
              {problem || 'The live room dropped and could not reconnect.'}
            </p>
            {reachNote && (
              <p className="mt-1 break-words text-xs text-red-100">{reachNote}</p>
            )}
            {serverSaid && (
              <p className="mt-1 break-words text-xs text-red-100">What the room reported: {serverSaid}</p>
            )}
          </div>
          {phase === 'failed' && (
            <Button size="sm" variant="outline" className="border-red-100 text-red-50 hover:bg-red-800" onClick={() => void retry()}>
              Try again
            </Button>
          )}
        </div>
      )}

      {weak && phase === 'live' && !audioOnly && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-navy-800 px-5 py-3">
          <p role="status" className="text-sm text-navy-100">
            Your connection to the room is weak, so the picture may freeze or drop out.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="border-navy-500 text-navy-100 hover:bg-navy-700"
            onClick={() => void keepAudio(true)}
          >
            Keep audio only
          </Button>
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
        <Button
          variant={audioOnly ? 'secondary' : 'outline'}
          onClick={() => void keepAudio(!audioOnly)}
          aria-pressed={audioOnly}
          disabled={offline}
          className={audioOnly ? '' : 'border-navy-600 text-navy-100 hover:bg-navy-800'}
        >
          <i className={`bi ${audioOnly ? 'bi-volume-up-fill' : 'bi-camera-reels-fill'}`} aria-hidden="true" />
          {audioOnly ? 'Show video' : 'Keep audio only'}
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
