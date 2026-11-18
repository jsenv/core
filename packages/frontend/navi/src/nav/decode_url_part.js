/**
 * The text a part of an address stands for — a path segment, a search key or
 * value, a fragment — or null when it stands for none.
 *
 * An address arrives as it was typed or cut, and the browser keeps it that way:
 * a `%` not followed by two hex digits (`?utm=-50%`), a link cut inside
 * `%C3%A9`, a Latin-1 `%E9`. Such a part names no text, and whoever reads it
 * decides what it is worth there: a path segment naming nothing matches no
 * route, a search key or value or a fragment is kept as written.
 *
 * @param {string} part
 * @returns {string|null}
 */
export const decodeUrlPart = (part) => {
  try {
    return decodeURIComponent(part);
  } catch {
    return null;
  }
};
