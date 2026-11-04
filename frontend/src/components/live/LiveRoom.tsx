'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ConnectionError, ConnectionErrorReason, ConnectionState,
  ConnectionQuality, Room, RoomEvent, Track, type Participant, type RemoteParticipant,
} from 'livekit-client';
import { Button } from '@/components/ui/Button';
import { RoomSidePanel, type PanelPerson, type PanelTab } from '@/components/live/RoomSidePanel';
import {
  CHAT_LIMIT, decodeRoomMessage, readRoomMetadata, ROOM_TOPIC, roomId, sendRoomMessage,
  type ChatMessage, type RoomLink,
} from '@/lib/room-channel';
import type { EventAccess } from '@/lib/website-api';

type RoomAccess = Extract<EventAccess, { provider: 'livekit' }>;

type Tile = {
  key: string;
  identity: string;
  name: string;
  isLocal: boolean;
  isHost: boolean;
  speaking: boolean;
  micOn: boolean;
  camOn: boolean;
  sharing: boolean;
  handRaised: boolean;
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
  /** A human name for the call — the event title, the class title, the meeting title. */
  title: string;
  /** Shown after the person steps out, where they decide whether to go back. */
  leftNote: string;
  /** Shown when the room is open but nobody else has walked in yet. */
  waitingNote: string;
  returnHref: string;
  returnLabel: string;
  /** Links this room's workspace offers, such as the event page or the class list. */
  links?: RoomLink[];
};

/** Reactions are looked up from this list, never rendered from a remote string. */
const REACTIONS = [
  { key: 'applause', label: 'Applause', icon: 'bi-hand-thumbs-up-fill' },
  { key: 'love', label: 'Love it', icon: 'bi-heart-fill' },
  { key: 'agreed', label: 'Agreed', icon: 'bi-check2-circle' },
  { key: 'question', label: 'Question', icon: 'bi-question-circle-fill' },
  { key: 'attention', label: 'This', icon: 'bi-hand-index-fill' },
  { key: 'brilliant', label: 'Brilliant', icon: 'bi-star-fill' },
];

type FloatingReaction = { id: string; key: string; name: string };

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
function Pane({
  track, muted, label, fit, mirror,
}: {
  track: MediaStreamTrack | null;
  muted: boolean;
  label: string;
  fit: 'contain' | 'cover';
  mirror?: boolean;
}) {
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
      className={`h-full w-full bg-navy-950 ${fit === 'cover' ? 'object-cover' : 'object-contain'} ${
        mirror ? 'scale-x-[-1]' : ''
      }`}
    />
  );
}

function TileCard({ tile, stage = false, pinned = false }: { tile: Tile; stage?: boolean; pinned?: boolean }) {
  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-navy-900 ${
        stage ? 'rounded-2xl' : 'rounded-xl sm:rounded-2xl'
      } ${pinned || tile.speaking ? 'ring-2 ring-gold-brand' : 'ring-1 ring-white/10'}`}
    >
      {tile.videoTrack || tile.shareTrack ? (
        <>
          <Pane track={tile.shareTrack} muted={tile.isLocal} label={`${tile.name} screen share`} fit="contain" />
          {!tile.shareTrack && (
            <Pane
              track={tile.videoTrack}
              muted={tile.isLocal}
              label={`${tile.name} camera`}
              fit="cover"
              mirror={tile.isLocal}
            />
          )}
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-navy-800 to-navy-950">
          <span
            className={`flex items-center justify-center rounded-full bg-navy-800 font-bold text-navy-100 ring-1 ring-white/10 ${
              stage ? 'size-20 text-2xl' : 'size-12 text-sm'
            }`}
            aria-hidden="true"
          >
            {initialsOf(tile.name)}
          </span>
        </div>
      )}

      {tile.sharing && (
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-gold-brand px-1.5 py-0.5 text-[10px] font-bold text-navy-950">
          <i className="bi bi-display" aria-hidden="true" />
          Sharing
        </span>
      )}
      {pinned && (
        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-navy-950/80 px-1.5 py-0.5 text-[10px] font-bold text-gold-brand ring-1 ring-white/15">
          <i className="bi bi-pin-angle-fill" aria-hidden="true" />
          Spotlight
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-navy-950/90 to-transparent px-2.5 pb-1.5 pt-6">
        <span className={`truncate font-semibold text-white ${stage ? 'text-sm' : 'text-xs'}`}>
          {tile.isLocal ? 'You' : tile.name}
        </span>
        {tile.handRaised && <i className="bi bi-hand-index-fill text-xs text-gold-brand" aria-hidden="true" />}
        {!tile.micOn && <i className="bi bi-mic-mute-fill text-xs text-gold-brand" aria-hidden="true" />}
        <span className="sr-only">
          {tile.micOn ? 'Microphone on' : 'Microphone off'}
          {tile.handRaised ? ', hand raised' : ''}
        </span>
      </div>
    </div>
  );
}

/** One control in the room's footer: a round target and a label that survives on desktop. */
function ControlButton({
  label, icon, active = false, danger = false, badge, onClick, disabled = false, hint,
}: {
  label: string;
  icon: string;
  active?: boolean;
  danger?: boolean;
  badge?: number;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={hint ?? label}
      className={`group flex w-12 shrink-0 flex-col items-center gap-1 focus-visible:outline-none sm:w-16 ${
        disabled ? 'opacity-40' : ''
      }`}
    >
      <span
        className={`relative flex size-11 items-center justify-center rounded-full ring-1 transition-colors group-focus-visible:ring-2 group-focus-visible:ring-gold-brand group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-navy-950 sm:size-12 ${
          danger
            ? 'bg-action-destructive text-white ring-transparent hover:bg-action-destructive-hover'
            : active
              ? 'bg-gold-brand text-navy-950 ring-transparent hover:bg-gold-hover'
              : 'bg-white/10 text-white ring-white/15 group-hover:bg-white/15'
        }`}
      >
        <i className={`bi ${icon} text-lg`} aria-hidden="true" />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-gold-brand px-1 text-[10px] font-bold leading-4 text-navy-950">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      <span className="hidden max-w-full truncate text-[11px] font-semibold text-navy-200 sm:block">{label}</span>
    </button>
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

const formatClock = (seconds: number) => {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const rest = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  }
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

/**
 * The library reports playback as started once startAudio() settles, even when
 * the browser kept the audio graph suspended — which is exactly the silent call
 * people report as "camera works, voice does not". The graph's own state is the
 * honest answer, so ask it before believing the room.
 */
function soundIsBlocked(live: Room) {
  const graph = (live as unknown as { audioContext?: AudioContext }).audioContext;
  if (graph && graph.state !== 'running') return true;
  return !live.canPlaybackAudio;
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
  const [view, setView] = useState<'grid' | 'stage'>('grid');
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(12);
  const [menu, setMenu] = useState<'none' | 'reactions'>('none');
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>('people');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [chatProblem, setChatProblem] = useState('');
  const [hands, setHands] = useState<Record<string, boolean>>({});
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [clock, setClock] = useState(() => Date.now());
  const startedAt = useRef<number | null>(null);
  const reactionTimers = useRef<number[]>([]);
  const panelRef = useRef<{ open: boolean; tab: PanelTab }>({ open: false, tab: 'people' });
  const lastShareRef = useRef<string | null>(null);
  // Screen capture is a desktop capability: phones and tablets answer
  // ``getDisplayMedia`` by failing. Asking first lets the button say so instead
  // of offering a control that always throws.
  const [canShare] = useState(() =>
    typeof navigator !== 'undefined'
    && typeof navigator.mediaDevices?.getDisplayMedia === 'function');

  const pushReaction = useCallback((key: string, name: string) => {
    if (!REACTIONS.some((item) => item.key === key)) return;
    const entry: FloatingReaction = { id: roomId('r'), key, name: name || 'Someone' };
    setReactions((value) => [...value, entry].slice(-6));
    const timer = window.setTimeout(() => {
      setReactions((value) => value.filter((item) => item.id !== entry.id));
      reactionTimers.current = reactionTimers.current.filter((id) => id !== timer);
    }, 3_200);
    reactionTimers.current.push(timer);
  }, []);

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
    // The library carries a remote voice track but never plays it. Without an
    // element per voice the microphone publishes, the meters move, and the room
    // stays silent — the report that reads "mic is on but nobody hears me".
    // Each subscribed audio track gets its own hidden <audio>; it is removed
    // when that person leaves, and replayed once the browser unlocks sound.
    const voiceHost = document.createElement('div');
    voiceHost.hidden = true;
    voiceHost.setAttribute('aria-hidden', 'true');
    document.body.appendChild(voiceHost);
    const voices = new Map<Track, HTMLAudioElement>();
    const playVoices = () => {
      voices.forEach((element) => { void element.play().catch(() => {}); });
    };
    const attachVoice = (track: Track) => {
      if (track.kind !== Track.Kind.Audio || voices.has(track)) return;
      const element = track.attach() as HTMLAudioElement;
      element.autoplay = true;
      element.setAttribute('playsinline', '');
      element.style.display = 'none';
      voiceHost.appendChild(element);
      voices.set(track, element);
      void element.play().catch(() => {});
    };
    const detachVoice = (track: Track) => {
      const element = voices.get(track);
      if (element) {
        element.remove();
        voices.delete(track);
      }
      track.detach().forEach((attached) => attached.remove());
    };
    /** A reconnect can hand back tracks that subscribed before this listener ran. */
    const attachVoicesAlreadyHere = () => {
      room.remoteParticipants.forEach((person) => {
        person.audioTrackPublications.forEach((publication) => {
          if (publication.isSubscribed && publication.track) attachVoice(publication.track);
        });
      });
    };
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
    // Hearing the others is a permission the browser grants, not one the room
    // can assume. When it is withheld the picture still arrives and the call
    // reads as "camera works, voice does not" — so the room's own playback
    // state, not just a thrown error, decides whether to ask for a tap.
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      if (stopped) return;
      setSoundNeeded(soundIsBlocked(room));
      // Sound may have just been unlocked by the tap that started playback.
      playVoices();
    });
    // A tap anywhere on the page is enough for most browsers to start sound.
    // Waiting only for the banner is how a person watches a silent call.
    const unlockSound = () => {
      void room.startAudio()
        .then(() => {
          if (stopped) return;
          setSoundNeeded(soundIsBlocked(room));
          playVoices();
        })
        .catch(() => {});
    };
    document.addEventListener('pointerdown', unlockSound, { once: true });
    document.addEventListener('keydown', unlockSound, { once: true });
    // Someone switching their camera on mid-call must not cost a slow attendee
    // the audio they were already hearing.
    room.on(RoomEvent.TrackSubscribed, (track: Track, publication) => {
      if (track.kind === Track.Kind.Audio) attachVoice(track);
      if (audioOnlyRef.current && track.kind === Track.Kind.Video) void publication.setSubscribed(false);
      else bump();
    });
    room.on(RoomEvent.TrackUnsubscribed, (track: Track) => detachVoice(track));
    room.on(RoomEvent.ParticipantDisconnected, (person: RemoteParticipant) => {
      person.audioTrackPublications.forEach((publication) => {
        if (publication.track) detachVoice(publication.track);
      });
    });
    room.on(RoomEvent.TrackUnpublished, (publication) => {
      if (publication.track) detachVoice(publication.track);
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
        // startAudio() resolving is not proof that sound is running: the audio
        // graph, not the room's flag, is what decides whether the banner belongs.
        try {
          await room.startAudio();
        } catch {
          // The banner below asks for the tap the browser wants.
        }
        if (!stopped) {
          setSoundNeeded(soundIsBlocked(room));
          // Voices that arrived while the handshake was settling still need an
          // element before they can be heard.
          attachVoicesAlreadyHere();
          playVoices();
          // A re-dial builds a new room, so the controls must show what this
          // room is actually sending instead of the previous one's buttons.
          setMicOn(room.localParticipant.isMicrophoneEnabled);
          setCamOn(room.localParticipant.isCameraEnabled);
          setShareOn(room.localParticipant.isScreenShareEnabled);
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
      document.removeEventListener('pointerdown', unlockSound);
      document.removeEventListener('keydown', unlockSound);
      voices.forEach((element, track) => {
        element.remove();
        track.detach().forEach((attached) => attached.remove());
      });
      voices.clear();
      voiceHost.remove();
      room.removeAllListeners();
      void room.disconnect();
      roomRef.current = null;
    };
  }, [attempt]);

  // Chat, raised hands and reactions arrive on the room's data channel; the
  // board and the note listen for their own message types inside their panels.
  useEffect(() => {
    const room = roomRef.current;
    if (!room) return undefined;
    const onData = (payload: Uint8Array, _participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic !== ROOM_TOPIC) return;
      const message = decodeRoomMessage(payload);
      if (!message) return;
      if (message.type === 'chat') {
        const entry: ChatMessage = {
          id: message.id,
          from: message.from,
          name: message.name,
          text: message.text,
          at: message.at,
          mine: false,
        };
        setMessages((value) => (value.some((item) => item.id === entry.id) ? value : [...value, entry].slice(-200)));
        if (!panelRef.current.open || panelRef.current.tab !== 'chat') setUnread((value) => value + 1);
      } else if (message.type === 'hand') {
        setHands((value) => ({ ...value, [message.from]: message.raised }));
      } else if (message.type === 'reaction') {
        pushReaction(message.key, message.name);
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => { room.off(RoomEvent.DataReceived, onData); };
  }, [attempt, pushReaction]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (phase === 'live' && startedAt.current === null) startedAt.current = Date.now();
  }, [phase]);

  useEffect(() => () => {
    reactionTimers.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  // A phone shows six tiles at a time, a laptop twelve, so a hundred-seat room
  // stays readable instead of shrinking every face to a postage stamp.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const query = window.matchMedia('(min-width: 1024px)');
    const apply = () => {
      setPerPage(query.matches ? 12 : 6);
      setPage(0);
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

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
    const rows = people.map((person) => ({
      key: person.sid || person.identity,
      identity: person.identity,
      name: person.name || person.identity || (person.isLocal ? 'You' : 'Guest'),
      isLocal: person.isLocal,
      isHost: person.isLocal ? access.is_host : false,
      speaking: person.isSpeaking,
      micOn: person.isMicrophoneEnabled,
      camOn: person.isCameraEnabled,
      sharing: person.isScreenShareEnabled,
      handRaised: hands[person.identity] ?? readRoomMetadata(person.metadata).hand ?? false,
      videoTrack: videoTrackOf(person, Track.Source.Camera),
      shareTrack: videoTrackOf(person, Track.Source.ScreenShare),
    }));
    // The person holding the screen sits first in the gallery, then people keep
    // a stable alphabetical order so a hundred tiles do not shuffle on every
    // speaker change.
    rows.sort((a, b) => {
      const aLocal = Number(a.isLocal);
      const bLocal = Number(b.isLocal);
      if (aLocal !== bLocal) return bLocal - aLocal;
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [tick, phase, hands, access.is_host]);

  const sharingTile = tiles.find((tile) => tile.shareTrack);
  const sharingKey = sharingTile?.key ?? null;
  const stageTile = tiles.find((tile) => tile.key === pinnedKey)
    ?? sharingTile
    ?? tiles.find((tile) => tile.speaking)
    ?? tiles[0]
    ?? null;

  // A screen share is the thing everyone came to see, so it takes the stage
  // without anyone hunting for it. The person can still return to the grid.
  useEffect(() => {
    if (sharingKey && sharingKey !== lastShareRef.current) {
      setPinnedKey(sharingKey);
      setView('stage');
    }
    lastShareRef.current = sharingKey;
  }, [sharingKey]);

  const pageCount = Math.max(1, Math.ceil(tiles.length / perPage));
  const safePage = Math.min(page, pageCount - 1);
  const visible = tiles.slice(safePage * perPage, safePage * perPage + perPage);
  const firstShown = tiles.length ? safePage * perPage + 1 : 0;
  const lastShown = Math.min(tiles.length, safePage * perPage + perPage);

  const panelPeople = useMemo<PanelPerson[]>(() => {
    const rows = tiles.map((tile) => ({
      key: tile.key,
      name: tile.name,
      isLocal: tile.isLocal,
      isHost: tile.isHost,
      micOn: tile.micOn,
      camOn: tile.camOn,
      speaking: tile.speaking,
      sharing: tile.sharing,
      handRaised: tile.handRaised,
    }));
    rows.sort((a, b) =>
      Number(b.handRaised) - Number(a.handRaised)
      || Number(b.isLocal) - Number(a.isLocal)
      || Number(b.isHost) - Number(a.isHost)
      || a.name.localeCompare(b.name));
    return rows;
  }, [tiles]);

  const myHand = hands[access.identity] ?? readRoomMetadata(roomRef.current?.localParticipant.metadata).hand ?? false;
  const handCount = tiles.filter((tile) => tile.handRaised).length;
  const offline = phase === 'connecting' || phase === 'failed';
  const elapsed = startedAt.current ? Math.max(0, Math.floor((clock - startedAt.current) / 1_000)) : 0;

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
      // Read the room back instead of trusting the click: a browser can grant
      // the request and still publish nothing, and the button must say so.
      setMicOn(room.localParticipant.isMicrophoneEnabled);
      setCamOn(room.localParticipant.isCameraEnabled);
      setShareOn(room.localParticipant.isScreenShareEnabled);
    } catch {
      setProblem(kind === 'share'
        ? 'This device would not let the room capture a screen. Phones and tablets cannot share one; on a laptop or desktop, choose the screen or window in the picker and try again.'
        : `Your browser blocked the ${kind === 'mic' ? 'microphone' : 'camera'}. Allow it in the address bar, then press the button again.`);
    }
  };

  const toggleHand = () => {
    const room = roomRef.current;
    if (!room) return;
    const raised = !myHand;
    setHands((value) => ({ ...value, [access.identity]: raised }));
    void sendRoomMessage(room, {
      type: 'hand',
      from: access.identity,
      name: access.display_name,
      raised,
      at: Date.now(),
    });
    // Metadata is what a late joiner can still see, so the hand is written
    // there too; the message above makes it appear instantly for everyone.
    const metadata = { ...readRoomMetadata(room.localParticipant.metadata), hand: raised, handAt: Date.now() };
    void room.localParticipant.setMetadata(JSON.stringify(metadata)).catch(() => {});
  };

  const sendReaction = (key: string) => {
    const room = roomRef.current;
    setMenu('none');
    pushReaction(key, access.display_name);
    if (!room) return;
    void sendRoomMessage(room, {
      type: 'reaction',
      from: access.identity,
      name: access.display_name,
      key,
      at: Date.now(),
    });
  };

  const sendChat = async (text: string): Promise<boolean> => {
    const room = roomRef.current;
    const clean = text.trim().slice(0, CHAT_LIMIT);
    if (!clean) return false;
    if (!room) {
      setChatProblem('The room is not open yet. Try again in a moment.');
      return false;
    }
    const message = {
      type: 'chat' as const,
      id: roomId('c'),
      from: access.identity,
      name: access.display_name,
      text: clean,
      at: Date.now(),
    };
    const sent = await sendRoomMessage(room, message);
    if (!sent) {
      setChatProblem('That message did not reach the room. Check your connection and try again.');
      return false;
    }
    setChatProblem('');
    setMessages((value) => [...value, { ...message, mine: true }].slice(-200));
    return true;
  };

  const chooseTab = (next: PanelTab) => {
    setPanelTab(next);
    panelRef.current = { open: true, tab: next };
    if (next === 'chat') setUnread(0);
  };

  const openPanel = (next: PanelTab) => {
    setMenu('none');
    if (panelOpen && panelTab === next) {
      setPanelOpen(false);
      panelRef.current = { open: false, tab: next };
      return;
    }
    setPanelOpen(true);
    chooseTab(next);
  };

  const closePanel = () => {
    setPanelOpen(false);
    panelRef.current = { open: false, tab: panelRef.current.tab };
  };

  const spotlight = (tile: Tile) => {
    setPinnedKey(tile.key);
    setView('stage');
    setMenu('none');
  };

  /** A pin chosen inside the People panel should be visible, which means the
   *  full-screen phone sheet has to step out of the way. */
  const pinFromPanel = (key: string | null) => {
    setPinnedKey(key);
    if (key) setView('stage');
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      closePanel();
    }
  };

  const leave = () => {
    void roomRef.current?.disconnect();
    onLeave();
  };

  const statusText = (() => {
    if (phase === 'connecting') return 'Opening the room…';
    if (phase === 'retrying') return 'Connection dropped — reconnecting…';
    if (phase === 'failed') return 'Not connected';
    const head = access.is_host ? 'Hosting' : 'In the room';
    return `${head} · ${tiles.length} ${tiles.length === 1 ? 'person' : 'people'} · ${formatClock(elapsed)}`;
  })();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-navy-950 text-white">
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-3 py-2.5 sm:px-5 sm:py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gold-brand text-sm font-extrabold text-navy-950" aria-hidden="true">
          V
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold text-white sm:text-base">{chrome.title}</h1>
          <p role="status" className="truncate text-[11px] text-navy-300 sm:text-xs">
            {statusText}
            {phase === 'live' && handCount > 0 && ` · ${handCount} ${handCount === 1 ? 'hand' : 'hands'} up`}
          </p>
        </div>
      </header>

      {soundNeeded && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 bg-navy-800 px-4 py-2.5 sm:px-5">
          <p role="alert" className="text-sm text-navy-100">
            Your browser has paused the room&apos;s sound, so you can see people but not
            hear them. Press Enable sound.
          </p>
          <Button
            size="sm"
            className="bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold"
            onClick={() => {
              const room = roomRef.current;
              void room?.startAudio()
                .then(() => { if (room) setSoundNeeded(soundIsBlocked(room)); })
                .catch(() => setProblem('Sound did not start. Press Enable sound again.'));
            }}
          >
            Enable sound
          </Button>
        </div>
      )}

      {(problem || phase === 'failed') && (
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 bg-red-900/50 px-4 py-2.5 sm:px-5">
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
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 bg-navy-800 px-4 py-2.5 sm:px-5">
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

      <div className="relative flex min-h-0 flex-1">
        <main className="relative flex min-w-0 flex-1 flex-col">
          {phase === 'connecting' && (
            <>
              <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-hidden p-2 sm:grid-cols-3 sm:gap-3 sm:p-4 xl:grid-cols-4" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="aspect-video animate-pulse rounded-xl bg-navy-900 ring-1 ring-white/5" />
                ))}
              </div>
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold text-navy-200">
                Opening the room…
              </p>
            </>
          )}

          {phase !== 'connecting' && tiles.length === 0 && (
            <div className="m-auto max-w-sm px-6 text-center">
              <p className="text-sm text-navy-200">
                {phase === 'failed'
                  ? 'The room is not open on this screen.'
                  : chrome.waitingNote}
              </p>
              {phase === 'failed' && (
                <Button
                  onClick={() => void retry()}
                  className="mt-4 bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold"
                >
                  Try again
                </Button>
              )}
            </div>
          )}

          {phase !== 'connecting' && tiles.length > 0 && view === 'grid' && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 sm:p-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
                  {visible.map((tile) => (
                    <button
                      key={tile.key}
                      type="button"
                      onClick={() => spotlight(tile)}
                      aria-label={tile.isLocal ? 'Spotlight your own video' : `Spotlight ${tile.name}`}
                      className="group relative block aspect-video w-full overflow-hidden rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-brand focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950 sm:rounded-2xl"
                    >
                      <TileCard tile={tile} pinned={pinnedKey === tile.key} />
                      <span className="pointer-events-none absolute inset-0 rounded-xl ring-inset ring-transparent transition group-hover:ring-2 group-hover:ring-gold-brand/60 sm:rounded-2xl" aria-hidden="true" />
                    </button>
                  ))}
                </div>
                {tiles.length === 1 && (
                  <p className="mx-auto mt-4 max-w-md px-4 text-center text-sm text-navy-300">{chrome.waitingNote}</p>
                )}
              </div>
              {pageCount > 1 && (
                <div className="flex shrink-0 items-center justify-center gap-3 border-t border-white/5 px-4 py-2">
                  <button
                    type="button"
                    onClick={() => setPage(Math.max(0, safePage - 1))}
                    disabled={safePage === 0}
                    aria-label="Show the previous people"
                    className="flex size-9 items-center justify-center rounded-lg text-navy-100 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-30"
                  >
                    <i className="bi bi-chevron-left" aria-hidden="true" />
                  </button>
                  <p className="text-xs font-semibold text-navy-200" role="status">
                    {firstShown}–{lastShown} of {tiles.length}
                  </p>
                  <button
                    type="button"
                    onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
                    disabled={safePage >= pageCount - 1}
                    aria-label="Show the next people"
                    className="flex size-9 items-center justify-center rounded-lg text-navy-100 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-30"
                  >
                    <i className="bi bi-chevron-right" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          )}

          {phase !== 'connecting' && tiles.length > 0 && view === 'stage' && stageTile && (
            <div className="flex min-h-0 flex-1 flex-col gap-2 p-2 sm:gap-3 sm:p-3">
              <div className="min-h-0 flex-1">
                <TileCard tile={stageTile} stage pinned={pinnedKey === stageTile.key} />
              </div>
              <div className="flex shrink-0 items-center gap-2 overflow-x-auto pb-0.5">
                {/* First, not last: with a hundred people the filmstrip scrolls,
                    and the way back to the grid must never be scrolled away. */}
                <button
                  type="button"
                  onClick={() => setView('grid')}
                  className="flex h-16 w-24 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg bg-white/5 text-xs font-semibold text-navy-100 ring-1 ring-white/10 hover:bg-white/10 sm:h-20 sm:w-28"
                >
                  <i className="bi bi-grid-3x3-gap-fill text-base" aria-hidden="true" />
                  Show everyone
                </button>
                {tiles
                  .filter((tile) => tile.key !== stageTile.key)
                  .slice(0, 12)
                  .map((tile) => (
                    <button
                      key={tile.key}
                      type="button"
                      onClick={() => spotlight(tile)}
                      aria-label={tile.isLocal ? 'Spotlight your own video' : `Spotlight ${tile.name}`}
                      className="relative block h-16 w-28 shrink-0 overflow-hidden rounded-lg text-left ring-1 ring-white/10 hover:ring-gold-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-brand sm:h-20 sm:w-36"
                    >
                      <TileCard tile={tile} />
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex flex-wrap justify-center gap-2 px-4">
            {reactions.map((reaction) => {
              const meta = REACTIONS.find((item) => item.key === reaction.key);
              if (!meta) return null;
              return (
                <span
                  key={reaction.id}
                  className="flex animate-room-reaction items-center gap-2 rounded-full bg-navy-800/95 px-3 py-2 text-sm font-semibold text-white shadow-lg ring-1 ring-white/15 motion-reduce:animate-none"
                >
                  <i className={`bi ${meta.icon} text-gold-brand`} aria-hidden="true" />
                  <span className="max-w-[9rem] truncate">{reaction.name}</span>
                  <span className="sr-only">sent {meta.label}</span>
                </span>
              );
            })}
          </div>
        </main>

        <RoomSidePanel
          room={roomRef.current}
          open={panelOpen}
          tab={panelTab}
          onTab={chooseTab}
          onClose={closePanel}
          people={panelPeople}
          messages={messages}
          unread={unread}
          onSendChat={sendChat}
          chatProblem={chatProblem}
          pinnedKey={pinnedKey}
          onPin={pinFromPanel}
          canClearBoard={access.is_host}
          links={chrome.links ?? []}
          audioOnly={audioOnly}
          onAudioOnly={(on) => void keepAudio(on)}
        />
      </div>

      <footer className="shrink-0 border-t border-white/10 bg-navy-950 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-1 sm:flex-row sm:justify-between sm:gap-4">
          <div className="flex items-start gap-1 sm:gap-2">
            <ControlButton
              label={micOn ? 'Mute' : 'Unmute'}
              icon={micOn ? 'bi-mic-fill' : 'bi-mic-mute-fill'}
              danger={!micOn}
              onClick={() => void toggle('mic')}
              disabled={offline}
              hint={micOn ? 'Mute your microphone' : 'Unmute your microphone'}
            />
            <ControlButton
              label={camOn ? 'Camera off' : 'Camera on'}
              icon={camOn ? 'bi-camera-video-fill' : 'bi-camera-video-off-fill'}
              danger={!camOn}
              onClick={() => void toggle('cam')}
              disabled={offline}
              hint={camOn ? 'Turn your camera off' : 'Turn your camera on'}
            />
            <ControlButton
              label={shareOn ? 'Stop share' : 'Share'}
              icon="bi-display"
              active={shareOn}
              onClick={() => void toggle('share')}
              disabled={offline || !canShare}
              hint={canShare
                ? (shareOn ? 'Stop sharing your screen' : 'Share your screen')
                : 'This browser cannot capture a screen. Use a laptop or desktop browser to share.'}
            />
            <div className="sm:hidden">
              <ControlButton
                label="Leave"
                icon="bi-box-arrow-right"
                danger
                onClick={leave}
              />
            </div>
          </div>

          <span className="hidden h-10 w-px self-center bg-white/10 sm:block" aria-hidden="true" />

          <div className="flex items-start gap-1 sm:gap-2">
            <ControlButton
              label="React"
              icon="bi-hand-thumbs-up-fill"
              active={menu === 'reactions'}
              onClick={() => setMenu(menu === 'reactions' ? 'none' : 'reactions')}
              disabled={offline}
              hint="Send a reaction to the room"
            />
            <ControlButton
              label={myHand ? 'Lower hand' : 'Raise hand'}
              icon="bi-hand-index-fill"
              active={myHand}
              onClick={toggleHand}
              disabled={offline}
              hint={myHand ? 'Lower your hand' : 'Raise your hand so the host can see'}
            />
            <ControlButton
              label="Chat"
              icon="bi-chat-dots-fill"
              active={panelOpen && panelTab === 'chat'}
              badge={unread}
              onClick={() => openPanel('chat')}
              disabled={offline}
              hint="Messages for everyone in the room"
            />
            <ControlButton
              label="People"
              icon="bi-people-fill"
              active={panelOpen && panelTab === 'people'}
              onClick={() => openPanel('people')}
              disabled={offline}
              hint="Who is here, raised hands and spotlight"
            />
            <ControlButton
              label="Workspace"
              icon="bi-easel2-fill"
              active={panelOpen && panelTab === 'workspace'}
              onClick={() => openPanel('workspace')}
              disabled={offline}
              hint="Shared board, notes and materials"
            />
            <div className="hidden sm:block">
              <ControlButton
                label="Leave"
                icon="bi-box-arrow-right"
                danger
                onClick={leave}
              />
            </div>
          </div>
        </div>
      </footer>

      {menu === 'reactions' && (
        <>
          <button
            type="button"
            aria-label="Close reactions"
            onClick={() => setMenu('none')}
            className="fixed inset-0 z-30 cursor-default bg-navy-950/50"
          />
          <div
            role="dialog"
            aria-label="Send a reaction"
            className="fixed bottom-32 left-1/2 z-40 w-[min(21rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl bg-navy-900 p-3 shadow-2xl ring-1 ring-white/10 sm:bottom-28"
          >
            <div className="grid grid-cols-3 gap-2">
              {REACTIONS.map((reaction) => (
                <button
                  key={reaction.key}
                  type="button"
                  onClick={() => sendReaction(reaction.key)}
                  className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl bg-white/5 px-2 py-2 text-navy-100 ring-1 ring-white/10 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-brand"
                >
                  <i className={`bi ${reaction.icon} text-xl text-gold-brand`} aria-hidden="true" />
                  <span className="text-[11px] font-semibold">{reaction.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
