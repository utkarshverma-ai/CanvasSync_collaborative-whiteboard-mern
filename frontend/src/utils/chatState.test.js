import assert from 'node:assert/strict';
import test from 'node:test';
import { chatReducer, createChatState, isNearChatBottom, shouldSendOnEnter } from './chatState.js';

const message = (id, senderId = 'other') => ({ id, senderId, roomId: 'room', clientMessageId: id, text: `Message ${id}`, senderName: 'Participant', senderColor: '#357a72', timestamp: new Date().toISOString() });
const receive = (state, value) => chatReducer(state, { type: 'message', message: value, ownIds: ['me', 'old-me'] });
const snapshot = (state, messages) => chatReducer(state, { type: 'snapshot', messages, ownIds: ['me', 'old-me'] });

test('initial room history does not create unread notifications', () => {
  const state = snapshot(createChatState(), [message('1'), message('2')]);
  assert.equal(state.loaded, true);
  assert.equal(state.messages.length, 2);
  assert.equal(state.unread, 0);
});

test('broadcast and acknowledgement insert once, including unread count', () => {
  const incoming = message('1');
  const state = receive(createChatState(), incoming);
  assert.equal(state.unread, 1);
  assert.equal(receive(state, incoming), state);
  assert.equal(receive(state, message('2', 'me')).unread, 1);
  assert.equal(receive(state, message('3', 'old-me')).unread, 1);
});

test('opening clears unread, messages while open remain read, closing resumes unread', () => {
  const unread = receive(createChatState(), message('1'));
  const open = chatReducer(unread, { type: 'open', open: true });
  assert.equal(open.unread, 0);
  assert.equal(receive(open, message('2')).unread, 0);
  const closed = chatReducer(open, { type: 'open', open: false });
  assert.equal(receive(closed, message('3')).unread, 1);
});

test('reconnect snapshots replace history and count only missed remote messages once', () => {
  const original = snapshot(createChatState(), [message('1')]);
  const restored = snapshot(original, [message('1'), message('2'), message('3', 'old-me')]);
  assert.equal(restored.messages.length, 3);
  assert.equal(restored.unread, 1);
  assert.equal(snapshot(restored, restored.messages).unread, 1);
  assert.equal(snapshot(restored, []).messages.length, 0);
  assert.equal(snapshot(restored, []).unread, 0);
});

test('history and snapshots remain bounded and deduplicated', () => {
  let state = createChatState();
  for (let index = 0; index < 120; index++) state = receive(state, message(String(index)));
  assert.equal(state.messages.length, 100);
  assert.equal(state.messages[0].id, '20');
  assert.equal(state.unread, 100);
  const restored = snapshot(state, [...state.messages, ...state.messages]);
  assert.equal(restored.messages.length, 100);
});

test('Enter sends, Shift+Enter and IME composition preserve input', () => {
  const event = { key: 'Enter', shiftKey: false, nativeEvent: { isComposing: false } };
  assert.equal(shouldSendOnEnter(event), true);
  assert.equal(shouldSendOnEnter({ ...event, shiftKey: true }), false);
  assert.equal(shouldSendOnEnter({ ...event, nativeEvent: { isComposing: true } }), false);
  assert.equal(shouldSendOnEnter({ ...event, key: 'a' }), false);
});

test('scrolling through older messages prevents automatic scrolling', () => {
  assert.equal(isNearChatBottom({ scrollHeight: 1200, scrollTop: 200, clientHeight: 400 }), false);
  assert.equal(isNearChatBottom({ scrollHeight: 1200, scrollTop: 750, clientHeight: 400 }), true);
});
