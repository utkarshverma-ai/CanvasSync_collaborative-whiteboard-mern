import assert from 'node:assert/strict';
import test from 'node:test';
import { isLocalPageCreation } from './pageCreation.js';

const payload = {
  page: { id: 'server-page-id', strokes: [] },
  requestId: 'request-a',
  createdBy: 'socket-a'
};

test('matches only the originating client page request', () => {
  assert.equal(isLocalPageCreation('request-a', payload, 'socket-a'), true);
});

test('does not match collaborators, stale requests, or absent pending requests', () => {
  assert.equal(isLocalPageCreation('request-a', payload, 'socket-b'), false);
  assert.equal(isLocalPageCreation('request-b', payload, 'socket-a'), false);
  assert.equal(isLocalPageCreation(null, payload, 'socket-a'), false);
});
