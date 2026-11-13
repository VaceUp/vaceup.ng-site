import { Room, RoomEvent, type Participant } from 'livekit-client';

export type RoomCapture = { stop: () => void; finished: Promise<Blob> };

/** Mix subscribed room audio directly, avoiding reliance on browser system-audio support. */
export async function captureRoom(room: Room, currentRoom: () => Room | null = () => room): Promise<RoomCapture> {
  if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('Recording needs screen capture. Open this room in a supported desktop browser.');
  }
  const mimeType = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) throw new Error('This browser cannot record a supported video format. Use a current desktop Chrome or Edge browser.');
  // This call must precede any network request to preserve the click's user activation.
  const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  let audio: AudioContext | undefined;
  let release: (() => void) | undefined;
  try {
    audio = new AudioContext();
    await audio.resume();
    const mixed = audio.createMediaStreamDestination();
    const sources = new Map<string, MediaStreamAudioSourceNode>();
    const syncAudio = () => {
      const tracks = new Map<string, MediaStreamTrack>();
      const activeRoom = currentRoom();
      const people: Participant[] = activeRoom ? [activeRoom.localParticipant, ...Array.from(activeRoom.remoteParticipants.values())] : [];
      for (const person of people) {
        for (const publication of Array.from(person.audioTrackPublications.values())) {
          const track = publication.track?.mediaStreamTrack;
          if (track && track.readyState === 'live' && !publication.isMuted) tracks.set(track.id, track);
        }
      }
      for (const [id, source] of Array.from(sources)) {
        if (!tracks.has(id)) { source.disconnect(); sources.delete(id); }
      }
      for (const [id, track] of Array.from(tracks)) {
        if (sources.has(id)) continue;
        const source = audio!.createMediaStreamSource(new MediaStream([track]));
        source.connect(mixed);
        sources.set(id, source);
      }
    };
    syncAudio();
    const events = [RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.Reconnected];
    const stream = new MediaStream([...screen.getVideoTracks(), ...mixed.stream.getAudioTracks()]);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_500_000 });
    for (const event of events) room.on(event, syncAudio);
    // An explicit reconnect can replace the Room instance. Keep mixing its new tracks.
    const syncTimer = window.setInterval(syncAudio, 500);
    const chunks: Blob[] = [];
    const cleanup = () => {
      window.clearInterval(syncTimer);
      for (const event of events) room.off(event, syncAudio);
      for (const source of Array.from(sources.values())) source.disconnect();
      screen.getTracks().forEach(track => track.stop());
      mixed.stream.getTracks().forEach(track => track.stop());
      void audio!.close();
    };
    release = cleanup;
    const stop = () => { if (recorder.state !== 'inactive') recorder.stop(); };
    const finished = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => {
        // onstop follows the final data event, allowing recovery of any captured bytes.
        stop();
      };
      recorder.onstop = () => {
        cleanup();
        if (chunks.length) resolve(new Blob(chunks, { type: recorder.mimeType }));
        else reject(new Error('No video was captured. Choose the classroom tab or Excel window and try recording again.'));
      };
    });
    screen.getVideoTracks()[0].addEventListener('ended', stop, { once: true });
    recorder.start(1000);
    return { stop, finished };
  } catch (error) {
    release?.();
    screen.getTracks().forEach(track => track.stop());
    if (audio && audio.state !== 'closed') void audio.close();
    throw error;
  }
}
