import { useCallback, useEffect, useRef, useState } from 'react';
import { RoomNotice } from '../types';
import { createNotificationAudio, readSoundMuted, saveSoundMuted, SOUND_PREFERENCE_KEY } from '../utils/notificationAudio';
import { appendRoomNotice } from '../utils/roomNotifications';

function localStorageOrNull() {
  try { return window.localStorage; } catch { return null; }
}

export function useRoomNotifications() {
  const [notices, setNotices] = useState<RoomNotice[]>([]);
  const [announcement, setAnnouncement] = useState<RoomNotice | null>(null);
  const [soundMuted, setSoundMuted] = useState(() => readSoundMuted(localStorageOrNull()));
  const mutedRef = useRef(soundMuted);
  const audioRef = useRef<ReturnType<typeof createNotificationAudio> | null>(null);

  useEffect(() => {
    const audio = createNotificationAudio();
    audio.setMuted(mutedRef.current);
    audioRef.current = audio;
    const unlock = () => { void audio.unlock(); };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SOUND_PREFERENCE_KEY && event.key !== null) return;
      const muted = readSoundMuted(localStorageOrNull());
      mutedRef.current = muted;
      setSoundMuted(muted);
      audio.setMuted(muted);
    };
    window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    window.addEventListener('keydown', unlock, { capture: true });
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('storage', onStorage);
      audio.dispose();
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, []);

  const toggleSound = useCallback(() => {
    const muted = !mutedRef.current;
    mutedRef.current = muted;
    setSoundMuted(muted);
    saveSoundMuted(localStorageOrNull(), muted);
    audioRef.current?.setMuted(muted);
    // Keyboard activation and pointer clicks are both valid unlock gestures.
    if (!muted) void audioRef.current?.unlock();
  }, []);

  const notify = useCallback((notice: RoomNotice) => {
    const focusedId = document.activeElement?.closest<HTMLElement>('[data-room-notice-id]')?.dataset.roomNoticeId;
    setNotices(previous => appendRoomNotice(previous, notice, focusedId));
    // Keep announcements independent of dismissals, which must not reannounce an
    // older notification when the newest card is removed from the visible stack.
    setAnnouncement(notice);
    audioRef.current?.play(notice.kind);
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotices(previous => previous.filter(notice => notice.id !== id));
  }, []);

  const dismissMessages = useCallback(() => {
    setNotices(previous => previous.filter(notice => notice.kind !== 'message'));
  }, []);

  return { notices, announcement, notify, dismiss, dismissMessages, soundMuted, toggleSound };
}
