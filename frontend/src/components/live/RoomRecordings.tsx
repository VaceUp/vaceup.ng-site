'use client';

import { useCallback, useEffect, useId, useRef, useState, type RefObject, type MutableRefObject } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { AlertCircle, Check, ChevronDown, Circle, Download, FileVideo, Square, Upload, Video } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { captureRoom, type RoomCapture } from '@/lib/capture-room';
import { publishRecording, type RecordingScope } from '@/lib/room-recordings';
import ReplayList from './ReplayList';
import styles from './RoomRecordings.module.css';

type Props = {
  roomRef: RefObject<Room | null>;
  connected: boolean;
  isHost: boolean;
  title: string;
  scope?: RecordingScope;
  leaveGuard: MutableRefObject<(() => boolean) | null>;
};

export default function RoomRecordings({ roomRef, connected, isHost, title, scope, leaveGuard }: Props) {
  const capture = useRef<RoomCapture | null>(null);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [published, setPublished] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [remoteRecording, setRemoteRecording] = useState(false);
  const [supported, setSupported] = useState(false);
  const [open, setOpen] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef(0);
  const panelId = useId();
  const name = `${title.replace(/[^a-z0-9]+/gi, '-').slice(0, 100)}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const fileName = `${name}.${blob?.type.startsWith('video/mp4') ? 'mp4' : 'webm'}`;

  useEffect(() => setSupported(!!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== 'undefined'), []);
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);
  useEffect(() => {
    if (!blob) return;
    const next = URL.createObjectURL(blob); setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  // Track metadata persists the recording notice for people who join late.
  useEffect(() => {
    const room = roomRef.current;
    if (!room) return;
    const update = () => setRemoteRecording(Array.from(room.remoteParticipants.values()).some(person => {
      try { return JSON.parse(person.metadata || '{}').recording === true; } catch { return false; }
    }));
    update();
    room.on(RoomEvent.ParticipantMetadataChanged, update);
    room.on(RoomEvent.ParticipantConnected, update);
    room.on(RoomEvent.ParticipantDisconnected, update);
    return () => { room.off(RoomEvent.ParticipantMetadataChanged, update); room.off(RoomEvent.ParticipantConnected, update); room.off(RoomEvent.ParticipantDisconnected, update); };
  }, [connected, roomRef]);

  const announce = useCallback(async (active: boolean) => {
    const person = roomRef.current?.localParticipant;
    if (!person) return;
    let metadata: Record<string, unknown> = {};
    try { metadata = JSON.parse(person.metadata || '{}'); } catch { /* Keep a valid metadata object. */ }
    await person.setMetadata(JSON.stringify({ ...metadata, recording: active }));
  }, [roomRef]);

  const unsaved = !!blob && !published && !downloaded;
  useEffect(() => {
    const guard = () => {
      if (recording || starting || saving || unsaved) {
        setError(recording ? 'Stop recording, then save before leaving the room.' : 'Wait for publishing or download the device copy before leaving.');
        return false;
      }
      return true;
    };
    leaveGuard.current = guard;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (recording || starting || saving || unsaved) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { leaveGuard.current = null; window.removeEventListener('beforeunload', beforeUnload); };
  }, [leaveGuard, recording, starting, saving, unsaved]);
  useEffect(() => () => { capture.current?.stop(); }, []);

  const publish = async (video: Blob) => {
    if (!scope) return;
    setSaving(true); setProgress(0); setError('');
    try { await publishRecording(scope, video, title, setProgress); setPublished(true); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Publishing failed. Download the device copy, then retry publishing.'); }
    finally { setSaving(false); }
  };

  const start = async () => {
    const room = roomRef.current;
    if (!room || capture.current || starting) return;
    setStarting(true); setError('');
    try {
      const next = await captureRoom(room, () => roomRef.current);
      startedAt.current = Date.now(); setSeconds(0);
      capture.current = next; setRecording(true); setBlob(null); setPublished(false); setDownloaded(false);
      let announced = false;
      void next.finished.then(video => {
        capture.current = null; setRecording(false); setBlob(video);
        void announce(false).catch(() => {});
        if (announced) void publish(video);
      }).catch(failure => { capture.current = null; setRecording(false); setError(failure.message); void announce(false).catch(() => {}); });
      try { await announce(true); announced = true; }
      catch { next.stop(); throw new Error('The recording notice could not reach the room. Reconnect and try recording again.'); }
    } catch (failure) {
      setError(failure instanceof DOMException && failure.name === 'NotAllowedError'
        ? 'Screen capture was cancelled or blocked. Press Record and choose the classroom tab or Excel window.'
        : failure instanceof Error ? failure.message : 'Recording could not start. Try again.');
    } finally { setStarting(false); }
  };

  const active = recording || remoteRecording;
  return <section className={styles.root} data-live-recordings aria-label="Recording controls">
    <div className={styles.toolbar}>
      <div className={styles.status}>
        <span className={styles.statusIcon} aria-hidden="true">{active ? <Circle /> : published ? <Check /> : <Video />}</span>
        <div>
          <p className={styles.statusTitle} role={active || saving || published ? 'status' : undefined}>{active ? 'Recording in progress' : saving ? (progress < 100 ? `Uploading recording: ${progress}%` : 'Verifying recording...') : published ? 'Saved to the platform' : isHost ? 'Session recording' : 'Class recordings'}</p>
          <p className={styles.hint}>{active ? 'Selected screen and unmuted room audio are included.' : published ? 'Ready to rewatch. Download your device copy below.' : isHost ? 'Save the lesson here and to your device.' : 'Rewatch sessions saved by your tutor.'}</p>
        </div>
        {recording && <time className={styles.timer} aria-label="Recording duration">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</time>}
      </div>
      <div className={styles.actions}>
        {isHost && <>
        {recording
          ? <Button leftIcon={<Square aria-hidden="true" />} onClick={() => capture.current?.stop()}>Stop and save recording</Button>
          : (!blob || downloaded) && <Button leftIcon={<Video aria-hidden="true" />} loading={starting} disabled={!connected || !supported || saving} onClick={() => void start()}>{blob ? 'Record another part' : 'Record session'}</Button>}
        {blob && url && <a className={`${styles.download} ${downloaded ? '' : styles.downloadPrimary}`} href={url} download={fileName} onClick={() => setDownloaded(true)}><Download aria-hidden="true" />Download to device</a>}
        {blob && scope && !published && <Button className={styles.secondary} loading={saving} onClick={() => void publish(blob)}>{error ? 'Retry publishing' : 'Publish recording'}</Button>}
        </>}
        {scope && <button className={styles.secondary} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}><FileVideo aria-hidden="true" />Recordings<ChevronDown className={open ? styles.rotated : undefined} aria-hidden="true" /></button>}
      </div>
    </div>
    {isHost && !supported && <p className={styles.feedback}>Recording needs screen capture in a desktop browser. Replays work on other devices.</p>}
    {error && <p className={styles.feedback} role="alert"><AlertCircle aria-hidden="true" />{error}</p>}
    {open && scope && <div className={styles.panel} id={panelId}>
      <div className={styles.panelHeading}><h2>Session recordings</h2><p>Saved privately for this session&apos;s participants.</p></div>
      <ReplayList scope={scope} autoLoad />
      {isHost && !recording && !starting && !saving && <details className={styles.uploadDisclosure}><summary><Upload aria-hidden="true" />Upload a saved recording</summary><label className={styles.import}>Choose a WebM or MP4 video
        <input type="file" disabled={unsaved} accept="video/webm,video/mp4,.webm,.mp4" onChange={event => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (!/\.(webm|mp4)$/i.test(file.name) || file.size === 0 || file.size > 5 * 1024 ** 3) {
            setError('Choose a non-empty WebM or MP4 recording smaller than 5 GB.'); return;
          }
          setBlob(file.slice(0, file.size, /\.mp4$/i.test(file.name) ? 'video/mp4' : 'video/webm'));
          setPublished(false); setDownloaded(true); setError('');
          event.target.value = '';
        }} />
      </label></details>}
    </div>}
  </section>;
}
