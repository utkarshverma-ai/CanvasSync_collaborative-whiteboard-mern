/**
 * Appends a stroke to one known page without changing any other page reference.
 * Unknown page IDs return the original array unchanged.
 *
 * @param {import('../types').BoardPage[]} pages
 * @param {string} pageId
 * @param {import('../types').Stroke} stroke
 * @returns {import('../types').BoardPage[]}
 */
export function appendStrokeToPage(pages, pageId, stroke) {
  const pageIndex = pages.findIndex(page => page.id === pageId);
  if (pageIndex === -1) return pages;

  return pages.map((page, index) => (
    index === pageIndex
      ? { ...page, strokes: [...page.strokes, stroke] }
      : page
  ));
}
