/**
 * @typedef {import('../types').Stroke} Stroke
 */

/**
 * Returns the newest active stroke owned by a connected user.
 *
 * @param {Stroke[]} strokes
 * @param {string} userId
 * @returns {Stroke | undefined}
 */
export function findLatestOwnedStroke(strokes, userId) {
  for (let index = strokes.length - 1; index >= 0; index -= 1) {
    const stroke = strokes[index];
    if (stroke.userId === userId) {
      return stroke;
    }
  }
}
