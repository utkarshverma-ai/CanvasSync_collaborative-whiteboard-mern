export const SOUND_PREFERENCE_KEY = 'canvassync.notification-sounds-muted';

export function readSoundMuted(storage) {
  try { return storage?.getItem(SOUND_PREFERENCE_KEY) === 'true'; } catch { return false; }
}

export function saveSoundMuted(storage, muted) {
  try { storage?.setItem(SOUND_PREFERENCE_KEY, String(muted)); } catch { /* Keep the preference in memory. */ }
}

/**
 * A lazy Web Audio controller. unlock() must only be called from a user gesture;
 * play() never creates or resumes a context, and never queues a delayed sound.
 */
export function createNotificationAudio({
  createContext = () => {
    const Constructor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    return Constructor ? new Constructor() : null;
  },
  now = () => performance.now()
} = {}) {
  let context = null;
  let muted = false;
  let disposed = false;
  let unlocking = null;
  let lastPlayedAt = -Infinity;
  const activeNodes = new Set();

  function stopActive() {
    for (const { oscillator, gain } of activeNodes) {
      try { oscillator.stop(); } catch { /* Already ended. */ }
      oscillator.disconnect();
      gain.disconnect();
    }
    activeNodes.clear();
  }

  return {
    async unlock() {
      if (disposed || muted) return false;
      try {
        context ??= createContext();
        if (!context) return false;
        if (context.state === 'running') return true;
        if (context.state === 'closed') return false;
        // Repeated pointer/key events share a single pending resume operation.
        if (!unlocking) unlocking = Promise.resolve(context.resume()).catch(() => {}).finally(() => { unlocking = null; });
        await unlocking;
        return !disposed && !muted && context.state === 'running';
      } catch {
        return false;
      }
    },
    setMuted(value) {
      muted = value;
      if (muted) stopActive();
    },
    /** @param {'message' | 'join'} kind */
    play(kind) {
      if (disposed || muted || context?.state !== 'running' || now() - lastPlayedAt < 1200) return false;
      const notes = kind === 'message' ? [659.25, 880] : [440, 554.37, 659.25];
      const start = context.currentTime + 0.01;
      try {
        notes.forEach((frequency, index) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const nodes = { oscillator, gain };
          activeNodes.add(nodes);
          const at = start + index * (kind === 'message' ? 0.12 : 0.09);
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(frequency, at);
          gain.gain.setValueAtTime(0, at);
          gain.gain.linearRampToValueAtTime(0.022, at + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
          gain.gain.setValueAtTime(0, at + 0.2);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.onended = () => {
            oscillator.disconnect();
            gain.disconnect();
            activeNodes.delete(nodes);
          };
          oscillator.start(at);
          oscillator.stop(at + 0.21);
        });
        lastPlayedAt = now();
        return true;
      } catch {
        stopActive();
        return false;
      }
    },
    dispose() {
      disposed = true;
      stopActive();
      if (context && context.state !== 'closed') {
        try { Promise.resolve(context.close()).catch(() => {}); } catch { /* Audio may already be unavailable. */ }
      }
      context = null;
    }
  };
}
