import assert from 'node:assert/strict';
import test from 'node:test';
import { appendPage } from './appendPage.js';

test('appends a new authoritative page in server-provided order', () => {
  const firstPage = { id: 'page-1', strokes: [] };
  const secondPage = { id: 'page-2', strokes: [] };

  assert.deepEqual(appendPage([firstPage], secondPage), [firstPage, secondPage]);
});

test('does not duplicate an already-known authoritative page', () => {
  const firstPage = { id: 'page-1', strokes: [] };
  const pages = [firstPage];

  assert.equal(appendPage(pages, firstPage), pages);
});
