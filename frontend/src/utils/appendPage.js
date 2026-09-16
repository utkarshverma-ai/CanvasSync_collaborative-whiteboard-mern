/**
 * Appends one server-confirmed page while preserving page order and avoiding duplicates.
 *
 * @param {import('../types').BoardPage[]} pages
 * @param {import('../types').BoardPage} page
 * @returns {import('../types').BoardPage[]}
 */
export function appendPage(pages, page) {
  return pages.some(existingPage => existingPage.id === page.id)
    ? pages
    : [...pages, page];
}
