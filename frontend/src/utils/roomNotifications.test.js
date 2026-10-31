import assert from 'node:assert/strict';
import test from 'node:test';
import { createRoomNotificationTracker, upsertCollaborator } from './roomNotifications.js';

const message = (id, overrides = {}) => ({ id, roomId: 'room-a', clientMessageId: id, senderId: 'bob-socket', senderName: 'Bob', senderColor: '#357a72', text: 'Hello\n team!', timestamp: new Date().toISOString(), ...overrides });
const join = (overrides = {}) => ({ roomId: 'room-a', userId: 'bob-socket', participantId: 'bob-session', userName: 'Bob', userColor: '#357a72', ...overrides });
const user = { id: 'me-socket', participantId: 'me-session', name: 'Alice', color: '#357a72', isMe: true };
function tracker() {
  const tracker = createRoomNotificationTracker('room-a');
  tracker.load({ users: [user], messages: [] });
  return tracker;
}

test('incoming messages create a sender notification and a short plain text preview', () => {
  const notices = tracker();
  assert.deepEqual(notices.message(message('1'), ['me-socket'], false), {
    id: 'message:1', kind: 'message', title: 'Bob', color: '#357a72', preview: 'Hello team!'
  });
  assert.equal(notices.message(message('2', { text: 'x'.repeat(500) }), [], false).preview.length, 97);
});

test('self messages are suppressed by socket identity, including pre-reconnect IDs', () => {
  const notices = tracker();
  assert.equal(notices.message(message('1', { senderId: 'old-me' }), ['old-me', 'me-socket'], false), null);
  assert.equal(notices.message(message('2', { senderId: 'me-socket' }), ['me-socket'], false), null);
  assert.ok(notices.message(message('3', { senderName: 'Alice' }), ['me-socket'], false));
});

test('visible chat suppresses notices and marks messages seen; hidden chat can notify', () => {
  const notices = tracker();
  assert.equal(notices.message(message('1'), [], true), null);
  assert.equal(notices.message(message('1'), [], false), null);
  assert.ok(notices.message(message('2'), [], false));
});

test('message retries produce only one notification, including after reconnect', () => {
  const notices = tracker();
  assert.ok(notices.message(message('1'), [], false));
  assert.equal(notices.message(message('1'), [], false), null);
  notices.disconnect();
  notices.load({ users: [user], messages: [message('1')] });
  assert.equal(notices.message(message('1'), [], false), null);
});

test('snapshots and pre-snapshot events never produce notifications', () => {
  const notices = createRoomNotificationTracker('room-a');
  assert.equal(notices.message(message('0'), [], false), null);
  assert.equal(notices.joined(join(), [], 'me-session'), null);
  assert.equal(notices.load({ users: [user, { ...user, id: 'bob-socket', participantId: 'bob-session' }], messages: [message('1')] }), undefined);
  assert.equal(notices.message(message('1'), [], false), null);
  assert.equal(notices.joined(join(), [], 'me-session'), null);
  notices.disconnect();
  assert.equal(notices.message(message('2'), [], false), null);
  notices.load({ users: [user], messages: [message('2')] });
  assert.equal(notices.message(message('2'), [], false), null);
});

test('new collaborators notify once per session identity, even with identical names', () => {
  const notices = tracker();
  assert.deepEqual(notices.joined(join(), ['me-socket'], 'me-session'), {
    id: 'join:bob-session', kind: 'join', title: 'Bob joined the room', color: '#357a72'
  });
  assert.equal(notices.joined(join(), ['me-socket'], 'me-session'), null);
  assert.ok(notices.joined(join({ userId: 'second-bob', participantId: 'second-session' }), ['me-socket'], 'me-session'));
});

test('own joins are suppressed by socket or stable participant identity', () => {
  const notices = tracker();
  assert.equal(notices.joined(join({ userId: 'me-socket', participantId: 'new-session' }), ['me-socket'], 'me-session'), null);
  assert.equal(notices.joined(join({ userId: 'new-me', participantId: 'me-session' }), ['me-socket'], 'me-session'), null);
});

test('collaborator reconnections use stable IDs, never display names', () => {
  const notices = tracker();
  assert.ok(notices.joined(join(), [], 'me-session'));
  assert.equal(notices.joined(join({ userId: 'reconnected-bob', userName: 'Renamed' }), [], 'me-session'), null);
  notices.disconnect();
  notices.load({ users: [user], messages: [] });
  assert.equal(notices.joined(join({ userId: 'another-socket' }), [], 'me-session'), null);
});

test('cross-room chat and presence cannot notify or pollute the current room cache', () => {
  const notices = tracker();
  assert.equal(notices.message(message('1', { roomId: 'room-b' }), [], false), null);
  assert.equal(notices.joined(join({ roomId: 'room-b' }), [], 'me-session'), null);
  assert.ok(notices.message(message('1'), [], false));
  assert.ok(notices.joined(join(), [], 'me-session'));
  const otherRoom = createRoomNotificationTracker('room-b');
  otherRoom.load({ users: [], messages: [] });
  assert.ok(otherRoom.message(message('1', { roomId: 'room-b' }), [], false));
});

test('presence upserts sockets so repeated join events do not inflate counts', () => {
  let users = [user];
  users = upsertCollaborator(users, join());
  users = upsertCollaborator(users, join({ userName: 'Updated Bob' }));
  assert.equal(users.length, 2);
  assert.equal(users[1].name, 'Updated Bob');
  users = upsertCollaborator(users, join({ userId: user.id, participantId: user.participantId }));
  assert.equal(users.length, 2);
  assert.equal(users[0].isMe, true);
});

test('toast bursts stay bounded and repeated IDs cannot create duplicate cards', async () => {
  const { appendRoomNotice } = await import('./roomNotifications.js');
  let queue = [];
  for (let index = 0; index < 20; index++) {
    queue = appendRoomNotice(queue, { id: String(index), kind: 'message', title: 'Sender', color: '#357a72' });
  }
  assert.deepEqual(queue.map(item => item.id), ['17', '18', '19']);
  queue = appendRoomNotice(queue, queue[2]);
  assert.equal(queue.length, 3);
  assert.equal(new Set(queue.map(item => item.id)).size, 3);
});

test('a burst preserves a focused notification within the three-card limit', async () => {
  const { appendRoomNotice } = await import('./roomNotifications.js');
  const notice = id => ({ id, kind: 'join', title: 'Joined', color: '#357a72' });
  const queue = appendRoomNotice(['a', 'b', 'c'].map(notice), notice('d'), 'a');
  assert.deepEqual(queue.map(item => item.id), ['a', 'c', 'd']);
});
