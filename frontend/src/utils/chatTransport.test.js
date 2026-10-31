import assert from 'node:assert/strict';
import test from 'node:test';
import { sendChatWithRetry } from './chatTransport.js';

const payload = { roomId: 'room', text: 'Hello', clientMessageId: 'request-1' };
const accepted = { ok: true, message: { id: 'server-message' } };
function fakeSocket(respond) {
  const calls = [];
  const socket = {
    connected: true, id: 'original',
    timeout(ms) { assert.equal(ms, 4000); return this; },
    async emitWithAck(event, data) { calls.push({ event, data }); return respond(calls.length, socket); }
  };
  return { socket, calls };
}

test('sends through the existing connection with a stable request ID and returns the acknowledgement', async () => {
  const { socket, calls } = fakeSocket(() => accepted);
  assert.deepEqual(await sendChatWithRetry(socket, payload, () => true), accepted);
  assert.deepEqual(calls, [{ event: 'send-chat-message', data: payload }]);
});

test('retries lost acknowledgements once with the identical payload', async () => {
  const { socket, calls } = fakeSocket(attempt => {
    if (attempt === 1) throw new Error('timeout');
    return accepted;
  });
  assert.deepEqual(await sendChatWithRetry(socket, payload, () => true), accepted);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].data, calls[1].data);
});

test('returns bounded timeout feedback after two failed attempts', async () => {
  const { socket, calls } = fakeSocket(() => { throw new Error('timeout'); });
  assert.equal((await sendChatWithRetry(socket, payload, () => true)).error.code, 'TIMEOUT');
  assert.equal(calls.length, 2);
});

test('structured validation and rate-limit errors are returned without retries', async () => {
  for (const code of ['INVALID_PAYLOAD', 'RATE_LIMITED', 'NOT_JOINED', 'ID_CONFLICT']) {
    const rejected = { ok: false, error: { code, message: 'Rejected' } };
    const { socket, calls } = fakeSocket(() => rejected);
    assert.deepEqual(await sendChatWithRetry(socket, payload, () => true), rejected);
    assert.equal(calls.length, 1);
  }
});

test('offline and not-yet-loaded rooms never queue sends', async () => {
  const { socket, calls } = fakeSocket(() => accepted);
  socket.connected = false;
  assert.equal((await sendChatWithRetry(socket, payload, () => true)).error.code, 'DISCONNECTED');
  socket.connected = true;
  assert.equal((await sendChatWithRetry(socket, payload, () => false)).error.code, 'DISCONNECTED');
  assert.equal((await sendChatWithRetry(null, payload, () => true)).error.code, 'DISCONNECTED');
  assert.equal(calls.length, 0);
});

test('disconnect, changed identity, and room teardown prevent a retry', async () => {
  for (const change of ['disconnect', 'identity', 'room']) {
    let ready = true;
    const { socket, calls } = fakeSocket((_, current) => {
      if (change === 'disconnect') current.connected = false;
      if (change === 'identity') current.id = 'new-connection';
      if (change === 'room') ready = false;
      throw new Error('ack lost');
    });
    assert.equal((await sendChatWithRetry(socket, payload, () => ready)).error.code, 'DISCONNECTED');
    assert.equal(calls.length, 1);
  }
});
