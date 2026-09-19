import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appendStrokeToPage } from './appendStrokeToPage.js';

const stroke = id => ({
  id,
  userId: 'alice',
  tool: 'pen',
  color: '#000000',
  width: 5,
  points: [{ x: 0, y: 0 }, { x: 1, y: 1 }]
});

test('appends a stroke only to the requested page', () => {
  const firstPage = { id: 'page-1', strokes: [stroke('first')] };
  const secondPage = { id: 'page-2', strokes: [] };
  const pages = [firstPage, secondPage];
  const updated = appendStrokeToPage(pages, 'page-2', stroke('second'));

  assert.deepEqual(updated.map(page => page.id), ['page-1', 'page-2']);
  assert.strictEqual(updated[0], firstPage);
  assert.notStrictEqual(updated[1], secondPage);
  assert.deepEqual(updated[0].strokes.map(item => item.id), ['first']);
  assert.deepEqual(updated[1].strokes.map(item => item.id), ['second']);
});

test('preserves every page when the page ID is unknown', () => {
  const pages = [{ id: 'page-1', strokes: [] }, { id: 'page-2', strokes: [] }];

  assert.strictEqual(appendStrokeToPage(pages, 'missing-page', stroke('ignored')), pages);
});
