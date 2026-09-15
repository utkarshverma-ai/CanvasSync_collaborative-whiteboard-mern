import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findLatestOwnedStroke } from './findLatestOwnedStroke.js';

const stroke = (id, userId) => ({
  id,
  userId,
  tool: 'pen',
  color: '#000000',
  width: 5,
  points: [{ x: 0, y: 0 }, { x: 1, y: 1 }]
});

test('returns no stroke for an empty board or a user with no strokes', () => {
  assert.equal(findLatestOwnedStroke([], 'alice'), undefined);
  assert.equal(findLatestOwnedStroke([stroke('b1', 'bob')], 'alice'), undefined);
});

test('returns an owned stroke when it is the latest stroke', () => {
  const aliceStroke = stroke('a1', 'alice');
  assert.equal(findLatestOwnedStroke([aliceStroke], 'alice'), aliceStroke);
});

test('skips another user’s latest stroke to find the latest owned stroke', () => {
  const aliceStroke = stroke('a1', 'alice');
  const strokes = [aliceStroke, stroke('b1', 'bob')];

  assert.equal(findLatestOwnedStroke(strokes, 'alice'), aliceStroke);
});

test('returns the newest owned stroke among interleaved collaborator strokes', () => {
  const aliceFirst = stroke('a1', 'alice');
  const aliceSecond = stroke('a2', 'alice');
  const strokes = [aliceFirst, stroke('b1', 'bob'), aliceSecond, stroke('b2', 'bob')];

  assert.equal(findLatestOwnedStroke(strokes, 'alice'), aliceSecond);
  assert.equal(findLatestOwnedStroke(strokes, 'bob').id, 'b2');
});
