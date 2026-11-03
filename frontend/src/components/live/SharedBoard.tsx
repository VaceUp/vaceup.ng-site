'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ConnectionState, Room, RoomEvent } from 'livekit-client';
import {
  boardBatches, decodeRoomMessage, isEarliestParticipant, ROOM_TOPIC, roomId, sendRoomMessage,
  type BoardPoint, type BoardStroke,
} from '@/lib/room-channel';

const FALLBACK = {
  bg: '#000459',
  white: '#e8ebfc',
  gold: '#FFC72C',
  teal: '#008B8B',
};

const WIDTHS = [
  { id: 'thin', label: 'Thin line', width: 0.004 },
  { id: 'medium', label: 'Medium line', width: 0.009 },
  { id: 'thick', label: 'Thick line', width: 0.018 },
];

/** A stroke still being drawn: the stored points plus how much has been sent. */
type LiveStroke = {
  id: string;
  color: string;
  width: number;
  erase?: boolean;
  points: BoardPoint[];
  sent: number;
  lastFlush: number;
};

const readColor = (name: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback;
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

const strokePixels = (stroke: BoardStroke, width: number, height: number) =>
  Math.max(1.5, stroke.width * Math.min(width, height));

function paintStroke(
  ctx: CanvasRenderingContext2D,
  stroke: BoardStroke,
  width: number,
  height: number,
  background: string,
) {
  const points = stroke.points;
  if (!points.length) return;
  ctx.strokeStyle = stroke.erase ? background : stroke.color;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = strokePixels(stroke, width, height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0][0] * width, points[0][1] * height, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0][0] * width, points[0][1] * height);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i][0] * width, points[i][1] * height);
  }
  ctx.stroke();
}

/** Paint only what arrived since `from`, so a long stroke costs one segment. */
function paintTail(
  ctx: CanvasRenderingContext2D,
  stroke: BoardStroke,
  from: number,
  width: number,
  height: number,
  background: string,
) {
  const points = stroke.points;
  if (!points.length) return;
  ctx.strokeStyle = stroke.erase ? background : stroke.color;
  ctx.lineWidth = strokePixels(stroke, width, height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (points.length === 1) {
    paintStroke(ctx, stroke, width, height, background);
    return;
  }
  const start = Math.max(0, Math.min(from, points.length - 2));
  ctx.beginPath();
  ctx.moveTo(points[start][0] * width, points[start][1] * height);
  for (let i = start + 1; i < points.length; i += 1) {
    ctx.lineTo(points[i][0] * width, points[i][1] * height);
  }
  ctx.stroke();
}

export function SharedBoard({ room, canClear }: { room: Room | null; canClear: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<BoardStroke[]>([]);
  const byIdRef = useRef<Map<string, BoardStroke>>(new Map());
  const liveRef = useRef<LiveStroke | null>(null);
  const roomRef = useRef(room);
  roomRef.current = room;
  const canClearRef = useRef(canClear);
  canClearRef.current = canClear;

  const [hasInk, setHasInk] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [ink, setInk] = useState('white');
  const [lineWidth, setLineWidth] = useState('medium');

  const colors = useMemo(() => ({
    bg: readColor('--color-navy-950', FALLBACK.bg),
    white: readColor('--color-navy-50', FALLBACK.white),
    gold: readColor('--color-gold-brand', FALLBACK.gold),
    teal: readColor('--color-teal-brand', FALLBACK.teal),
  }), []);

  const inkSwatches = useMemo(() => ([
    { id: 'white', label: 'White pen', color: colors.white },
    { id: 'gold', label: 'Gold pen', color: colors.gold },
    { id: 'teal', label: 'Teal pen', color: colors.teal },
  ]), [colors]);

  /** The canvas context with the display density applied, or null when the
   *  element has no size yet (the panel is closed or the tab is hidden). */
  const ready = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return null;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const wantWidth = Math.round(width * dpr);
    const wantHeight = Math.round(height * dpr);
    if (canvas.width !== wantWidth || canvas.height !== wantHeight) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width, height };
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    for (const stroke of strokesRef.current) paintStroke(ctx, stroke, width, height, colors.bg);
  }, [colors.bg]);

  /** Paint a change without repainting every stroke; a resize forces a full redraw. */
  const drawChange = useCallback((paint: (ctx: CanvasRenderingContext2D, width: number, height: number) => void) => {
    const readyCanvas = ready();
    if (!readyCanvas) {
      redraw();
      return;
    }
    paint(readyCanvas.ctx, readyCanvas.width, readyCanvas.height);
  }, [ready, redraw]);

  // Keep the drawing sharp when the panel resizes, the phone turns, or the
  // workspace tab is opened after the board had no size at all.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => redraw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  // A hidden board has no size, so strokes that arrive while the pane is closed
  // are held without ever being painted. When it comes back into view, repaint
  // and ask the room for the current board again — that covers both the held
  // strokes and anything drawn while this person had the pane shut.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      redraw();
      const live = roomRef.current;
      if (live && live.state === ConnectionState.Connected) {
        void sendRoomMessage(live, { type: 'board:hello', from: live.localParticipant.identity });
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  // A newcomer asks what is on the board; the host (or, if no host is in the
  // room, whoever has been here longest) answers once, in small packets.
  useEffect(() => {
    if (!room) return undefined;
    const greet = () => {
      void sendRoomMessage(room, { type: 'board:hello', from: room.localParticipant.identity });
    };
    if (room.state === ConnectionState.Connected) greet();
    room.on(RoomEvent.Connected, greet);
    return () => { room.off(RoomEvent.Connected, greet); };
  }, [room]);

  useEffect(() => {
    if (!room) return undefined;
    const onData = (payload: Uint8Array, _participant?: unknown, _kind?: unknown, topic?: string) => {
      if (topic !== ROOM_TOPIC) return;
      const message = decodeRoomMessage(payload);
      if (!message) return;

      if (message.type === 'board:seg') {
        const incoming = message.points ?? [];
        if (!incoming.length) return;
        const existing = byIdRef.current.get(message.stroke);
        if (!existing) {
          const stroke: BoardStroke = {
            id: message.stroke,
            color: message.color,
            width: message.width,
            erase: message.erase,
            points: [...incoming],
          };
          strokesRef.current.push(stroke);
          byIdRef.current.set(stroke.id, stroke);
          setHasInk(true);
          drawChange((ctx, width, height) => paintStroke(ctx, stroke, width, height, colors.bg));
        } else {
          const before = existing.points.length;
          existing.points.push(...incoming);
          drawChange((ctx, width, height) => paintTail(ctx, existing, before - 1, width, height, colors.bg));
        }
        return;
      }

      if (message.type === 'board:clear') {
        strokesRef.current = [];
        byIdRef.current.clear();
        setHasInk(false);
        redraw();
        return;
      }

      if (message.type === 'board:hello') {
        const live = roomRef.current;
        if (!live) return;
        const answers = canClearRef.current || isEarliestParticipant(live);
        if (!answers) return;
        // A tick later, so the greeter has finished wiring its own listener.
        window.setTimeout(() => {
          for (const strokes of boardBatches(strokesRef.current)) {
            void sendRoomMessage(live, {
              type: 'board:batch',
              from: live.localParticipant.identity,
              strokes,
            });
          }
        }, 150);
        return;
      }

      if (message.type === 'board:batch') {
        let added = false;
        for (const incoming of message.strokes ?? []) {
          if (!incoming?.id || byIdRef.current.has(incoming.id)) continue;
          const stroke: BoardStroke = { ...incoming, points: [...(incoming.points ?? [])] };
          strokesRef.current.push(stroke);
          byIdRef.current.set(stroke.id, stroke);
          added = true;
        }
        if (added) {
          setHasInk(true);
          redraw();
        }
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => { room.off(RoomEvent.DataReceived, onData); };
  }, [room, drawChange, redraw, colors.bg]);

  useEffect(() => () => {
    liveRef.current = null;
  }, []);

  const pointFrom = (event: ReactPointerEvent<HTMLCanvasElement>): BoardPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    const round = (value: number) => Math.round(value * 10_000) / 10_000;
    const x = rect.width ? (event.clientX - rect.left) / rect.width : 0;
    const y = rect.height ? (event.clientY - rect.top) / rect.height : 0;
    return [round(Math.min(1, Math.max(0, x))), round(Math.min(1, Math.max(0, y)))];
  };

  const flush = (stroke: LiveStroke) => {
    if (stroke.points.length <= stroke.sent) return;
    const points = stroke.points.slice(stroke.sent);
    stroke.sent = stroke.points.length;
    stroke.lastFlush = Date.now();
    const live = roomRef.current;
    if (!live) return;
    void sendRoomMessage(live, {
      type: 'board:seg',
      from: live.localParticipant.identity,
      stroke: stroke.id,
      color: stroke.color,
      width: stroke.width,
      erase: stroke.erase,
      points,
    });
  };

  const startStroke = (point: BoardPoint) => {
    const useEraser = tool === 'eraser';
    const swatch = inkSwatches.find((item) => item.id === ink) ?? inkSwatches[0];
    const width = WIDTHS.find((item) => item.id === lineWidth)?.width ?? WIDTHS[1].width;
    const stroke: BoardStroke = {
      id: roomId('s'),
      color: useEraser ? colors.bg : swatch.color,
      width: useEraser ? WIDTHS[2].width : width,
      erase: useEraser,
      points: [point],
    };
    strokesRef.current.push(stroke);
    byIdRef.current.set(stroke.id, stroke);
    // Its own array, not a shared one: the move handler records each point once
    // in the stored stroke and once in the live one. Sharing the array recorded
    // every point twice, so the tail painted a zero-length segment and the
    // sender watched a dot while everyone else received the whole line.
    const live: LiveStroke = { ...stroke, points: [...stroke.points], sent: 0, lastFlush: 0 };
    liveRef.current = live;
    setHasInk(true);
    drawChange((ctx, w, h) => paintStroke(ctx, stroke, w, h, colors.bg));
    flush(live);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    // A pen or a very quick tap can lift before capture is taken, and browsers
    // throw "No active pointer" rather than ignoring it. The stroke still has to
    // start, so capture is a convenience, never a requirement.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* Pointer already released; draw without capture. */
    }
    startStroke(pointFrom(event));
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const stroke = liveRef.current;
    if (!stroke) return;
    event.preventDefault();
    const point = pointFrom(event);
    const last = stroke.points[stroke.points.length - 1];
    if (Math.abs(point[0] - last[0]) + Math.abs(point[1] - last[1]) < 0.0015) return;
    stroke.points.push(point);
    const stored = byIdRef.current.get(stroke.id);
    if (stored && stored.points !== stroke.points) stored.points.push(point);
    drawChange((ctx, w, h) => paintTail(ctx, stroke, stroke.points.length - 2, w, h, colors.bg));
    if (Date.now() - stroke.lastFlush > 120) flush(stroke);
    // One stroke stays a carryable size: a drawing that never lifts starts a
    // fresh stroke with the same pen instead of one packet the channel refuses.
    if (stroke.points.length >= 400) {
      flush(stroke);
      liveRef.current = null;
      const fresh: BoardStroke = {
        id: roomId('s'),
        color: stroke.color,
        width: stroke.width,
        erase: stroke.erase,
        points: [point],
      };
      strokesRef.current.push(fresh);
      byIdRef.current.set(fresh.id, fresh);
      const restarted: LiveStroke = { ...fresh, points: [...fresh.points], sent: 0, lastFlush: 0 };
      liveRef.current = restarted;
      flush(restarted);
    }
  };

  const endStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const stroke = liveRef.current;
    if (!stroke) return;
    event.preventDefault();
    flush(stroke);
    liveRef.current = null;
  };

  const clearBoard = () => {
    const live = roomRef.current;
    if (live) void sendRoomMessage(live, { type: 'board:clear', from: live.localParticipant.identity });
    strokesRef.current = [];
    byIdRef.current.clear();
    setHasInk(false);
    setConfirmClear(false);
    redraw();
  };

  const download = () => {
    if (!strokesRef.current.length) return;
    const width = 1600;
    const height = 1000;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);
    for (const stroke of strokesRef.current) paintStroke(ctx, stroke, width, height, colors.bg);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'vaceup-board.png';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
    }, 'image/png');
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {inkSwatches.map((swatch) => (
          <button
            key={swatch.id}
            type="button"
            aria-label={swatch.label}
            aria-pressed={tool === 'pen' && ink === swatch.id}
            onClick={() => { setTool('pen'); setInk(swatch.id); }}
            className={`flex size-9 items-center justify-center rounded-full ring-2 transition-colors ${
              tool === 'pen' && ink === swatch.id
                ? 'ring-gold-brand ring-offset-2 ring-offset-navy-900'
                : 'ring-white/15 hover:ring-white/40'
            }`}
          >
            <span className="size-5 rounded-full" style={{ backgroundColor: swatch.color }} aria-hidden="true" />
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-white/10" aria-hidden="true" />
        {WIDTHS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            aria-pressed={lineWidth === item.id}
            onClick={() => { setLineWidth(item.id); setTool('pen'); }}
            className={`flex size-9 items-center justify-center rounded-lg ring-1 transition-colors ${
              lineWidth === item.id ? 'bg-white/15 ring-gold-brand' : 'ring-white/10 hover:bg-white/10'
            }`}
          >
            <span
              className="rounded-full bg-navy-50"
              style={{ width: 4 + item.width * 420, height: 4 + item.width * 420 }}
              aria-hidden="true"
            />
          </button>
        ))}
        <button
          type="button"
          aria-label="Eraser"
          aria-pressed={tool === 'eraser'}
          onClick={() => setTool((value) => (value === 'eraser' ? 'pen' : 'eraser'))}
          className={`flex size-9 items-center justify-center rounded-lg ring-1 transition-colors ${
            tool === 'eraser' ? 'bg-gold-brand text-navy-950 ring-transparent' : 'text-navy-100 ring-white/10 hover:bg-white/10'
          }`}
        >
          <i className="bi bi-eraser-fill" aria-hidden="true" />
        </button>
        <span className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={download}
            disabled={!hasInk}
            className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-navy-100 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-40"
          >
            <i className="bi bi-download" aria-hidden="true" />
            PNG
          </button>
          {canClear && (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={!hasInk}
              className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-navy-100 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-40"
            >
              <i className="bi bi-trash3" aria-hidden="true" />
              Clear
            </button>
          )}
        </span>
      </div>

      {confirmClear && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-red-900/40 p-2 ring-1 ring-red-500/30">
          <p className="min-w-0 flex-1 text-xs font-semibold text-red-50">Clear the board for everyone?</p>
          <button
            type="button"
            onClick={clearBoard}
            className="min-h-8 rounded-lg bg-red-700 px-3 text-xs font-bold text-white hover:bg-red-600"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => setConfirmClear(false)}
            className="min-h-8 rounded-lg px-3 text-xs font-semibold text-red-50 ring-1 ring-red-300/40 hover:bg-red-800/40"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="relative mt-2 min-h-[220px] flex-1 overflow-hidden rounded-xl bg-navy-950 ring-1 ring-white/10">
        <canvas
          ref={canvasRef}
          aria-label="Shared drawing board"
          className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onLostPointerCapture={endStroke}
        />
        {!hasInk && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center">
            <i className="bi bi-pencil-fill text-2xl text-navy-300" aria-hidden="true" />
            <p className="text-sm font-semibold text-navy-100">Draw together</p>
            <p className="max-w-[22rem] text-xs text-navy-300">
              Everyone in the room can use this board. It lives for this call, so download
              it before you leave.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default SharedBoard;
