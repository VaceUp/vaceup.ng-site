import type { Participant, Room } from 'livekit-client';

/**
 * Everything the room's own tools send rides this one LiveKit data topic.
 *
 * LiveKit carries arbitrary small messages alongside the media streams, so
 * chat, raised hands, reactions, the shared board and the shared note need no
 * extra server and no database. The trade is that they live only as long as
 * the call: a message sent before you walked in is not replayed to you.
 */
export const ROOM_TOPIC = 'vaceup.room';

export type BoardPoint = [number, number];

export type BoardStroke = {
  id: string;
  color: string;
  /** Line width as a fraction of the board's shorter side, so every screen
   *  draws the same stroke at the same weight. */
  width: number;
  erase?: boolean;
  points: BoardPoint[];
};

export type RoomLink = { label: string; href: string; hint?: string };

export type ChatMessage = {
  id: string;
  from: string;
  name: string;
  text: string;
  at: number;
  /** True only for the message this device typed, so it can be right-aligned. */
  mine: boolean;
};

export type RoomMessage =
  | { type: 'chat'; id: string; from: string; name: string; text: string; at: number }
  | { type: 'hand'; from: string; name: string; raised: boolean; at: number }
  | { type: 'reaction'; from: string; name: string; key: string; at: number }
  | {
      type: 'board:seg';
      from: string;
      stroke: string;
      color: string;
      width: number;
      erase?: boolean;
      points: BoardPoint[];
    }
  | { type: 'board:clear'; from: string }
  | { type: 'board:hello'; from: string }
  | { type: 'board:batch'; from: string; strokes: BoardStroke[] }
  | { type: 'notes:update'; from: string; text: string; at: number }
  | { type: 'notes:hello'; from: string }
  | { type: 'notes:batch'; from: string; text: string; at: number };

/** What a raised hand is stored as, so someone joining late still sees it. */
export type RoomMetadata = { hand?: boolean; handAt?: number; recording?: boolean };

export const CHAT_LIMIT = 500;
export const NOTES_LIMIT = 5_000;

const MESSAGE_TYPES = new Set([
  'chat', 'hand', 'reaction',
  'board:seg', 'board:clear', 'board:hello', 'board:batch',
  'notes:update', 'notes:hello', 'notes:batch',
]);

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Send one message to everyone else in the room.
 *
 * Resolves false rather than throwing when the room has gone away, so a chat
 * box can say "that did not reach the room" instead of dying silently.
 */
export async function sendRoomMessage(room: Room, message: RoomMessage): Promise<boolean> {
  try {
    await room.localParticipant.publishData(encoder.encode(JSON.stringify(message)), {
      reliable: true,
      topic: ROOM_TOPIC,
    });
    return true;
  } catch {
    return false;
  }
}

/** Turn a received packet back into a message we recognise, or null. */
export function decodeRoomMessage(payload: Uint8Array): RoomMessage | null {
  try {
    const parsed: unknown = JSON.parse(decoder.decode(payload));
    if (!parsed || typeof parsed !== 'object') return null;
    const type = (parsed as { type?: unknown }).type;
    if (typeof type !== 'string' || !MESSAGE_TYPES.has(type)) return null;
    return parsed as RoomMessage;
  } catch {
    return null;
  }
}

/**
 * Ceilings and raised hands live in the participant's metadata, which LiveKit
 * carries to everyone who joins later — unlike a one-off message.
 */
export function readRoomMetadata(metadata?: string): RoomMetadata {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata) as { hand?: unknown; handAt?: unknown; recording?: unknown };
    return {
      hand: parsed.hand === true,
      handAt: typeof parsed.handAt === 'number' ? parsed.handAt : undefined,
      recording: parsed.recording === true,
    };
  } catch {
    return {};
  }
}

/**
 * True for the person who has been in the room longest.
 *
 * The board and the note are held by the browsers, not a server, so somebody
 * has to answer a newcomer's "what is on it?" without all hundred people
 * answering at once. The host answers first; when no host is present the
 * earliest participant does, and the room still works.
 */
export function isEarliestParticipant(room: Room): boolean {
  const people: Participant[] = [room.localParticipant, ...Array.from(room.remoteParticipants.values())];
  let earliest: Participant = room.localParticipant;
  for (const person of people) {
    const candidate = person.joinedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const current = earliest.joinedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (candidate < current || (candidate === current && person.identity < earliest.identity)) {
      earliest = person;
    }
  }
  return earliest === room.localParticipant;
}

/**
 * Split a board into packets the data channel will actually carry.
 *
 * The live channel refuses a payload over roughly 15 KB, and one message that
 * size would also arrive as a single unresponsive blob. Grouping by strokes
 * keeps each packet small and lets the receiver draw as they land.
 */
export function boardBatches(strokes: BoardStroke[], budget = 8_000): BoardStroke[][] {
  const batches: BoardStroke[][] = [];
  let current: BoardStroke[] = [];
  let size = 0;
  for (const stroke of strokes) {
    const bytes = JSON.stringify(stroke).length + 1;
    if (current.length && size + bytes > budget) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(stroke);
    size += bytes;
  }
  if (current.length) batches.push(current);
  return batches;
}

/** A short, collision-resistant id for a message or a stroke. */
export function roomId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}
