import assert from 'node:assert/strict';
import test from 'node:test';
import { removeStrokeFromPage, restoreStrokeToPage } from './pageHistory.js';

const strokeOne = { id: 'stroke-1', userId: 'alice', tool: 'pen', color: '#000000', width: 5, points: [{ x: 1, y: 1 }] };
const strokeTwo = { id: 'stroke-2', userId: 'bob', tool: 'pen', color: '#ef4444', width: 5, points: [{ x: 2, y: 2 }] };
const pages = [
  { id: 'page-1', strokes: [strokeOne] },
  { id: 'page-2', strokes: [strokeTwo] }
];

test('removes a stroke only from its requested page', () => {
  const updated = removeStrokeFromPage(pages, 'page-1', strokeOne.id);

  assert.deepEqual(updated.map(page => page.strokes.map(stroke => stroke.id)), [[], [strokeTwo.id]]);
  assert.notEqual(updated[0], pages[0]);
  assert.equal(updated[1], pages[1]);
});

test('safely ignores unknown pages and strokes when removing history', () => {
  assert.equal(removeStrokeFromPage(pages, 'missing-page', strokeOne.id), pages);
  assert.equal(removeStrokeFromPage(pages, 'page-1', 'missing-stroke'), pages);
});

test('restores a stroke only to its requested page in server event order', () => {
  const withoutFirst = removeStrokeFromPage(pages, 'page-1', strokeOne.id);
  const restored = restoreStrokeToPage(withoutFirst, 'page-1', strokeOne);

  assert.deepEqual(restored.map(page => page.strokes.map(stroke => stroke.id)), [[strokeOne.id], [strokeTwo.id]]);
  assert.equal(restored[1], withoutFirst[1]);
});

test('safely ignores unknown pages and duplicate restores', () => {
  assert.equal(restoreStrokeToPage(pages, 'missing-page', strokeOne), pages);
  assert.equal(restoreStrokeToPage(pages, 'page-1', strokeOne), pages);
});
