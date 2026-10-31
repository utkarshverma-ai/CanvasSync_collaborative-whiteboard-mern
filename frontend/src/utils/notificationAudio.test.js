import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotificationAudio, readSoundMuted, saveSoundMuted, SOUND_PREFERENCE_KEY } from './notificationAudio.js';

function fakeAudio() {
  const oscillators = [];
  const gains = [];
  let creations = 0;
  let time = 0;
  const context = {
    state: 'suspended', currentTime: 2, destination: {}, resumes: 0, closes: 0,
    async resume() { this.resumes++; this.state = 'running'; },
    async close() { this.closes++; this.state = 'closed'; },
    createOscillator() {
      const node = {
        frequency: { setValueAtTime(value) { node.hz = value; } },
        connect() {}, disconnect() { this.disconnected = true; },
        start(at) { this.startedAt = at; }, stop(at) { this.stoppedAt = at; }
      };
      oscillators.push(node);
      return node;
    },
    createGain() {
      const values = [];
      const node = {
        values,
        gain: {
          setValueAtTime(value) { values.push(value); },
          linearRampToValueAtTime(value) { values.push(value); },
          exponentialRampToValueAtTime(value) { values.push(value); }
        },
        connect() {}, disconnect() { this.disconnected = true; }
      };
      gains.push(node);
      return node;
    }
  };
  const audio = createNotificationAudio({ createContext: () => { creations++; return context; }, now: () => time });
  return { audio, context, oscillators, gains, creations: () => creations, advance: ms => { time += ms; } };
}

test('audio is lazy and message events never create or resume a context', async () => {
  const fixture = fakeAudio();
  assert.equal(fixture.audio.play('message'), false);
  assert.equal(fixture.creations(), 0);
  assert.equal(await fixture.audio.unlock(), true);
  assert.equal(fixture.creations(), 1);
  assert.equal(fixture.context.resumes, 1);
  await fixture.audio.unlock();
  assert.equal(fixture.creations(), 1);
  assert.equal(fixture.context.resumes, 1);
  fixture.audio.dispose();
});

test('message and join tones are distinct, short and have gentle gain envelopes', async () => {
  const { audio, oscillators, gains, advance } = fakeAudio();
  await audio.unlock();
  assert.equal(audio.play('message'), true);
  const messageNotes = oscillators.map(node => node.hz);
  advance(1200);
  assert.equal(audio.play('join'), true);
  const joinNotes = oscillators.slice(2).map(node => node.hz);
  assert.notDeepEqual(messageNotes, joinNotes);
  assert.equal(messageNotes.length, 2);
  assert.equal(joinNotes.length, 3);
  for (const node of oscillators) {
    assert.equal(node.type, 'sine');
    assert.ok(node.stoppedAt - node.startedAt < 0.25);
    node.onended();
    assert.equal(node.disconnected, true);
  }
  for (const node of gains) {
    assert.ok(Math.max(...node.values) <= 0.022);
    assert.equal(node.values[0], 0);
    assert.equal(node.values.at(-1), 0);
    assert.equal(node.disconnected, true);
  }
  audio.dispose();
});

test('a shared throttle prevents overlapping notification sounds', async () => {
  const { audio, oscillators, advance } = fakeAudio();
  await audio.unlock();
  assert.equal(audio.play('message'), true);
  assert.equal(audio.play('join'), false);
  advance(1199);
  assert.equal(audio.play('message'), false);
  assert.equal(oscillators.length, 2);
  advance(1);
  assert.equal(audio.play('join'), true);
  audio.dispose();
});

test('muting stops active tones immediately and blocks playback and unlocking', async () => {
  const { audio, oscillators } = fakeAudio();
  await audio.unlock();
  audio.play('message');
  audio.setMuted(true);
  assert.equal(audio.play('join'), false);
  assert.equal(await audio.unlock(), false);
  for (const oscillator of oscillators) assert.equal(oscillator.disconnected, true);
  audio.dispose();
  const muted = fakeAudio();
  muted.audio.setMuted(true);
  assert.equal(await muted.audio.unlock(), false);
  assert.equal(muted.creations(), 0);
  muted.audio.setMuted(false);
  assert.equal(await muted.audio.unlock(), true);
  muted.audio.dispose();
});

test('mute preference survives reload and restricted storage fails gracefully', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(readSoundMuted(storage), false);
  saveSoundMuted(storage, true);
  assert.equal(values.get(SOUND_PREFERENCE_KEY), 'true');
  assert.equal(readSoundMuted(storage), true);
  saveSoundMuted(storage, false);
  assert.equal(readSoundMuted(storage), false);
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(readSoundMuted(blocked), false);
  assert.doesNotThrow(() => saveSoundMuted(blocked, true));
  assert.equal(readSoundMuted(null), false);
});

test('blocked resume, unsupported audio and constructor failures never interrupt notifications', async () => {
  const { audio, context } = fakeAudio();
  context.resume = async () => { throw new Error('Autoplay blocked'); };
  assert.equal(await audio.unlock(), false);
  assert.equal(audio.play('message'), false);
  context.resume = async () => { context.state = 'running'; };
  assert.equal(await audio.unlock(), true);
  assert.equal(audio.play('message'), true);
  audio.dispose();
  for (const createContext of [() => null, () => { throw new Error('Unsupported'); }]) {
    const unavailable = createNotificationAudio({ createContext });
    assert.equal(await unavailable.unlock(), false);
    assert.equal(unavailable.play('join'), false);
    unavailable.dispose();
  }
});

test('a suspended context waits for another interaction instead of resuming on an event', async () => {
  const { audio, context } = fakeAudio();
  await audio.unlock();
  context.state = 'suspended';
  assert.equal(audio.play('message'), false);
  assert.equal(context.resumes, 1);
  await audio.unlock();
  assert.equal(context.resumes, 2);
  audio.dispose();
});

test('pending unlocks share one resume, disposal releases resources and prevents later playback', async () => {
  const { audio, context, creations } = fakeAudio();
  let resume;
  context.resume = () => { context.resumes++; return new Promise(resolve => { resume = resolve; }); };
  const first = audio.unlock();
  const second = audio.unlock();
  assert.equal(context.resumes, 1);
  assert.equal(creations(), 1);
  audio.dispose();
  resume();
  assert.deepEqual(await Promise.all([first, second]), [false, false]);
  assert.equal(context.closes, 1);
  assert.equal(audio.play('message'), false);
  assert.equal(await audio.unlock(), false);
  audio.dispose();
  assert.equal(context.closes, 1);
});

test('audio node failures are contained and already-created nodes are disconnected', async () => {
  const { audio, context, oscillators } = fakeAudio();
  await audio.unlock();
  const createOscillator = context.createOscillator.bind(context);
  context.createOscillator = () => {
    const oscillator = createOscillator();
    oscillator.start = () => { throw new Error('Audio device unavailable'); };
    return oscillator;
  };
  assert.equal(audio.play('message'), false);
  assert.equal(oscillators[0].disconnected, true);
  audio.dispose();
});
