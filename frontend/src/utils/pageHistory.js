/**
 * Removes one stroke from one page while preserving every other page reference.
 * Unknown pages or stroke IDs return the original page array unchanged.
 *
 * @param {import('../types').BoardPage[]} pages
 * @param {string} pageId
 * @param {string} strokeId
 * @returns {import('../types').BoardPage[]}
 */
export function removeStrokeFromPage(pages, pageId, strokeId) {
  const page = pages.find(candidate => candidate.id === pageId);
  if (!page || !page.strokes.some(stroke => stroke.id === strokeId)) return pages;

  return pages.map(candidate => (
    candidate.id === pageId
      ? { ...candidate, strokes: candidate.strokes.filter(stroke => stroke.id !== strokeId) }
      : candidate
  ));
}

/**
 * Restores one server-confirmed stroke to one page without changing other pages.
 * Unknown pages and duplicate strokes return the original page array unchanged.
 *
 * @param {import('../types').BoardPage[]} pages
 * @param {string} pageId
 * @param {import('../types').Stroke} stroke
 * @returns {import('../types').BoardPage[]}
 */
export function restoreStrokeToPage(pages, pageId, stroke) {
  const page = pages.find(candidate => candidate.id === pageId);
  if (!page || page.strokes.some(activeStroke => activeStroke.id === stroke.id)) return pages;

  return pages.map(candidate => (
    candidate.id === pageId
      ? { ...candidate, strokes: [...candidate.strokes, stroke] }
      : candidate
  ));
}
