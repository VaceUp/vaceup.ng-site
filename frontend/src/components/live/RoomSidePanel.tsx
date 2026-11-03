'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { ConnectionState, Room, RoomEvent } from 'livekit-client';
import { SharedBoard } from '@/components/live/SharedBoard';
import {
  CHAT_LIMIT, decodeRoomMessage, isEarliestParticipant, NOTES_LIMIT, ROOM_TOPIC,
  sendRoomMessage, type ChatMessage, type RoomLink,
} from '@/lib/room-channel';

export type PanelTab = 'people' | 'chat' | 'workspace';

export type PanelPerson = {
  key: string;
  name: string;
  isLocal: boolean;
  isHost: boolean;
  micOn: boolean;
  camOn: boolean;
  speaking: boolean;
  sharing: boolean;
  handRaised: boolean;
};

type Props = {
  room: Room | null;
  open: boolean;
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  onClose: () => void;
  people: PanelPerson[];
  messages: ChatMessage[];
  unread: number;
  onSendChat: (text: string) => Promise<boolean>;
  chatProblem: string;
  pinnedKey: string | null;
  onPin: (key: string | null) => void;
  canClearBoard: boolean;
  links: RoomLink[];
  audioOnly: boolean;
  onAudioOnly: (on: boolean) => void;
};

const TABS: { id: PanelTab; label: string; icon: string }[] = [
  { id: 'people', label: 'People', icon: 'bi-people-fill' },
  { id: 'chat', label: 'Chat', icon: 'bi-chat-dots-fill' },
  { id: 'workspace', label: 'Workspace', icon: 'bi-journal-text' },
];

const initials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`;
  return letters.toUpperCase() || 'V';
};

const timeOf = (at: number) => {
  try {
    return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

/** Turn bare http(s) links in a chat message into links, without trusting HTML. */
function ChatText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((part, index) => (
        /^https?:\/\//.test(part) ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-semibold text-gold-brand underline decoration-gold-brand/50 underline-offset-2 hover:decoration-gold-brand"
          >
            {part}
          </a>
        ) : (
          <span key={index} className="break-words">{part}</span>
        )
      ))}
    </>
  );
}

function MaterialLink({ link }: { link: RoomLink }) {
  const body = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
        <i className="bi bi-folder2-open text-gold-brand" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">{link.label}</span>
        {link.hint && <span className="block truncate text-xs text-navy-300">{link.hint}</span>}
      </span>
      <i className="bi bi-box-arrow-up-right text-xs text-navy-300" aria-hidden="true" />
    </>
  );
  const className = 'flex min-h-11 items-center gap-2.5 rounded-xl bg-white/5 p-2 ring-1 ring-white/10 hover:bg-white/10';
  if (link.href.startsWith('/')) {
    return <Link href={link.href} className={className}>{body}</Link>;
  }
  return (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
      {body}
    </a>
  );
}

function TabButton({
  active, onClick, children, controls,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  controls: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
        active ? 'bg-navy-700 text-white shadow-sm' : 'text-navy-300 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

export function RoomSidePanel({
  room, open, tab, onTab, onClose, people, messages, unread, onSendChat, chatProblem,
  pinnedKey, onPin, canClearBoard, links, audioOnly, onAudioOnly,
}: Props) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const roomRef = useRef(room);
  roomRef.current = room;
  const canClearRef = useRef(canClearBoard);
  canClearRef.current = canClearBoard;

  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pane, setPane] = useState<'board' | 'notes' | 'materials'>('board');
  const [note, setNote] = useState('');
  const noteRef = useRef('');
  const noteTimer = useRef<number | undefined>(undefined);

  // On a phone the panel covers the room, so Escape and a focused Close button
  // are the two ways back without hunting for a 12px target.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      closeRef.current?.focus();
    }
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // The note is held by the browsers and synchronised over the room's data
  // channel. There is no server copy, so it is labelled as call-only.
  useEffect(() => {
    if (!room) return undefined;
    const onData = (payload: Uint8Array, _participant?: unknown, _kind?: unknown, topic?: string) => {
      if (topic !== ROOM_TOPIC) return;
      const message = decodeRoomMessage(payload);
      if (!message) return;
      if (message.type === 'notes:update') {
        noteRef.current = message.text;
        setNote(message.text);
        return;
      }
      if (message.type === 'notes:batch') {
        noteRef.current = message.text;
        setNote(message.text);
        return;
      }
      if (message.type === 'notes:hello') {
        const live = roomRef.current;
        if (!live || !noteRef.current.trim()) return;
        if (!(canClearRef.current || isEarliestParticipant(live))) return;
        void sendRoomMessage(live, {
          type: 'notes:batch',
          from: live.localParticipant.identity,
          text: noteRef.current,
          at: Date.now(),
        });
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => { room.off(RoomEvent.DataReceived, onData); };
  }, [room]);

  useEffect(() => {
    if (!room) return undefined;
    const greet = () => {
      void sendRoomMessage(room, { type: 'notes:hello', from: room.localParticipant.identity });
    };
    if (room.state === ConnectionState.Connected) greet();
    room.on(RoomEvent.Connected, greet);
    return () => { room.off(RoomEvent.Connected, greet); };
  }, [room]);

  useEffect(() => () => { window.clearTimeout(noteTimer.current); }, []);

  useEffect(() => {
    if (open && tab === 'chat') chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [open, tab, messages.length]);

  const changeNote = (value: string) => {
    const next = value.slice(0, NOTES_LIMIT);
    noteRef.current = next;
    setNote(next);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => {
      const live = roomRef.current;
      if (!live) return;
      void sendRoomMessage(live, {
        type: 'notes:update',
        from: live.localParticipant.identity,
        text: next,
        at: Date.now(),
      });
    }, 400);
  };

  const submitChat = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const sent = await onSendChat(text);
    if (sent) setDraft('');
    setSending(false);
  };

  const needle = query.trim().toLowerCase();
  const visiblePeople = needle
    ? people.filter((person) => person.name.toLowerCase().includes(needle))
    : people;
  const handCount = people.filter((person) => person.handRaised).length;

  return (
    <aside
      aria-label="Room tools"
      className={open
        ? 'fixed inset-x-0 top-0 z-40 flex h-dvh flex-col bg-navy-900 lg:static lg:z-auto lg:h-auto lg:w-96 lg:shrink-0 lg:border-l lg:border-white/10'
        : 'hidden'}
    >
      <div className="shrink-0 border-b border-white/10 px-3 pb-3 pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-navy-300">Room tools</p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close room tools"
            className="flex size-8 items-center justify-center rounded-lg text-navy-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-brand"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
        <div role="tablist" aria-label="Room tools" className="mt-3 flex gap-1 rounded-xl bg-navy-950/70 p-1">
          {TABS.map((item) => (
            <TabButton
              key={item.id}
              active={tab === item.id}
              onClick={() => onTab(item.id)}
              controls={`room-panel-${item.id}`}
            >
              <i className={`bi ${item.icon}`} aria-hidden="true" />
              {item.label}
              {item.id === 'chat' && unread > 0 && (
                <span className="rounded-full bg-gold-brand px-1.5 text-[10px] font-bold leading-4 text-navy-950">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </TabButton>
          ))}
        </div>
      </div>

      <div
        role="tabpanel"
        id="room-panel-people"
        aria-label="People"
        hidden={tab !== 'people'}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="shrink-0 p-3 pb-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-white">
              {people.length} {people.length === 1 ? 'person' : 'people'}
            </p>
            {handCount > 0 && (
              <p className="text-xs font-semibold text-gold-brand">
                {handCount} {handCount === 1 ? 'hand raised' : 'hands raised'}
              </p>
            )}
          </div>
          <div className="relative mt-2">
            <i className="bi bi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-300" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              placeholder="Search people"
              aria-label="Search people in the room"
              className="min-h-10 w-full rounded-xl bg-navy-950 pl-9 pr-3 text-sm text-white ring-1 ring-white/10 placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-gold-brand"
            />
          </div>
        </div>
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {visiblePeople.map((person) => {
            const pinned = pinnedKey === person.key;
            return (
              <li key={person.key} className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-white/5">
                <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-navy-100 ring-1 ring-white/10">
                  {initials(person.name)}
                  {person.handRaised && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-gold-brand text-[9px] text-navy-950">
                      <i className="bi bi-hand-index-fill" aria-hidden="true" />
                      <span className="sr-only">Hand raised</span>
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-white">{person.name}</span>
                    {person.isLocal && (
                      <span className="rounded bg-white/10 px-1 py-0.5 text-[10px] font-bold text-navy-100">You</span>
                    )}
                    {person.isHost && (
                      <span className="rounded bg-gold-brand px-1 py-0.5 text-[10px] font-bold text-navy-950">Host</span>
                    )}
                  </span>
                  <span className="block truncate text-[11px] text-navy-300">
                    {person.handRaised
                      ? 'Hand raised'
                      : person.speaking
                        ? 'Speaking'
                        : person.micOn ? 'Microphone on' : 'Microphone off'}
                    {person.sharing ? ' · Sharing screen' : ''}
                  </span>
                </span>
                <i
                  className={`bi ${person.micOn ? 'bi-mic-fill' : 'bi-mic-mute-fill'} text-xs ${
                    person.micOn ? 'text-teal-300' : 'text-navy-400'
                  }`}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => onPin(pinned ? null : person.key)}
                  aria-pressed={pinned}
                  aria-label={pinned ? `Stop spotlighting ${person.name}` : `Spotlight ${person.name}`}
                  title={pinned ? 'Stop spotlighting' : 'Spotlight'}
                  className={`flex size-8 items-center justify-center rounded-lg ring-1 transition-colors ${
                    pinned
                      ? 'bg-gold-brand text-navy-950 ring-transparent'
                      : 'text-navy-200 ring-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <i className={`bi ${pinned ? 'bi-pin-angle-fill' : 'bi-pin-angle'} text-xs`} aria-hidden="true" />
                </button>
              </li>
            );
          })}
          {visiblePeople.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-navy-300">
              No one in the room matches “{query.trim()}”.
            </li>
          )}
        </ul>
        <div className="shrink-0 border-t border-white/10 p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-navy-300">Your connection</p>
          <button
            type="button"
            aria-pressed={audioOnly}
            onClick={() => onAudioOnly(!audioOnly)}
            className="mt-2 flex w-full items-center gap-3 rounded-xl bg-white/5 p-3 text-left ring-1 ring-white/10 hover:bg-white/10"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">Audio only</span>
              <span className="block text-xs text-navy-300">
                Hides video to save data on a weak or metered connection.
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                audioOnly ? 'bg-gold-brand' : 'bg-white/20'
              }`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${
                  audioOnly ? 'left-[1.375rem]' : 'left-0.5'
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      <div
        role="tabpanel"
        id="room-panel-chat"
        aria-label="Chat"
        hidden={tab !== 'chat'}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
              <i className="bi bi-chat-dots-fill text-2xl text-navy-300" aria-hidden="true" />
              <p className="text-sm font-semibold text-navy-100">Say hello</p>
              <p className="text-xs text-navy-300">
                Everyone in the room sees this. Messages last for this call only.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {messages.map((message) => (
                <li key={message.id} className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      message.mine
                        ? 'rounded-br-md bg-navy-700 text-white'
                        : 'rounded-bl-md bg-white/5 text-navy-100 ring-1 ring-white/5'
                    }`}
                  >
                    {!message.mine && (
                      <p className="text-[11px] font-bold text-gold-brand">{message.name}</p>
                    )}
                    <p className="text-sm leading-relaxed"><ChatText text={message.text} /></p>
                    <p className="mt-0.5 text-right text-[10px] text-navy-300">{timeOf(message.at)}</p>
                  </div>
                </li>
              ))}
              <li aria-hidden="true"><div ref={chatEndRef} /></li>
            </ul>
          )}
        </div>
        <form onSubmit={(event) => void submitChat(event)} className="shrink-0 border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <label htmlFor="room-chat-input" className="sr-only">Message everyone in the room</label>
          <div className="flex items-end gap-2">
            <input
              id="room-chat-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, CHAT_LIMIT))}
              maxLength={CHAT_LIMIT}
              autoComplete="off"
              placeholder="Message everyone"
              className="min-h-11 min-w-0 flex-1 rounded-xl bg-navy-950 px-3 text-sm text-white ring-1 ring-white/10 placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-gold-brand"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              aria-label="Send message"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold-brand text-navy-950 hover:bg-gold-hover disabled:opacity-40"
            >
              <i className="bi bi-send-fill" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-navy-300">
            <span>Messages last for this call only.</span>
            {draft.length > CHAT_LIMIT - 50 && <span>{draft.length}/{CHAT_LIMIT}</span>}
          </div>
          {chatProblem && <p role="alert" className="mt-1 text-xs font-semibold text-red-300">{chatProblem}</p>}
        </form>
      </div>

      <div
        role="tabpanel"
        id="room-panel-workspace"
        aria-label="Workspace"
        hidden={tab !== 'workspace'}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div role="tablist" aria-label="Workspace tools" className="flex shrink-0 gap-1 p-3 pb-2">
          {([
            { id: 'board', label: 'Board', icon: 'bi-easel2-fill' },
            { id: 'notes', label: 'Notes', icon: 'bi-journal-text' },
            { id: 'materials', label: 'Materials', icon: 'bi-folder2-open' },
          ] as const).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={pane === item.id}
              onClick={() => setPane(item.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                pane === item.id ? 'bg-navy-700 text-white' : 'text-navy-300 hover:text-white'
              }`}
            >
              <i className={`bi ${item.icon}`} aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </div>
        <div hidden={pane !== 'board'} className="min-h-0 flex-1 p-3 pt-1">
          <SharedBoard room={room} canClear={canClearBoard} />
        </div>
        <div hidden={pane !== 'notes'} className="flex min-h-0 flex-1 flex-col gap-2 p-3 pt-1">
          <p className="text-xs text-navy-300">Everyone edits the same note. It lasts for this call.</p>
          <textarea
            value={note}
            onChange={(event) => changeNote(event.target.value)}
            maxLength={NOTES_LIMIT}
            placeholder="Type the minutes, decisions or questions here…"
            aria-label="Shared notes"
            className="min-h-[200px] flex-1 resize-none rounded-xl bg-navy-950 p-3 text-sm leading-relaxed text-navy-50 ring-1 ring-white/10 placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-gold-brand"
          />
          <div className="flex items-center justify-between text-[11px] text-navy-300">
            <span>Shared with everyone in the room</span>
            <span>{note.length}/{NOTES_LIMIT}</span>
          </div>
        </div>
        <div hidden={pane !== 'materials'} className="min-h-0 flex-1 overflow-y-auto p-3 pt-1">
          {links.length > 0 ? (
            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link.href}><MaterialLink link={link} /></li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-white/5 p-3 text-xs text-navy-300 ring-1 ring-white/10">
              This room has no pinned links. Paste a link into the chat to share it with everyone.
            </p>
          )}
          <div className="mt-3 rounded-xl bg-white/5 p-3 text-xs leading-relaxed text-navy-300 ring-1 ring-white/10">
            The board and the notes live in this call, not on the server. Download the board
            or copy the notes before the last person leaves.
          </div>
        </div>
      </div>
    </aside>
  );
}

export default RoomSidePanel;
