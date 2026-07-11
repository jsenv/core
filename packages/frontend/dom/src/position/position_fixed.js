/**
 * Walks `element` and its ancestors (stopping at, but not including,
 * `document.documentElement`) looking for the first one whose *computed*
 * `position` is `fixed` — i.e. pinned to the viewport, ignoring document
 * scroll, regardless of what `element` itself is positioned relative to.
 *
 * @param {Element} element
 * @returns {[left: number, top: number] | null} The fixed ancestor's own
 *   viewport-relative `getBoundingClientRect()` origin, or `null` if neither
 *   `element` nor any ancestor is fixed (i.e. `element` genuinely scrolls
 *   with the document).
 */
export const findSelfOrAncestorFixedPosition = (element) => {
  let current = element;
  while (true) {
    const computedStyle = window.getComputedStyle(current);
    if (computedStyle.position === "fixed") {
      const { left, top } = current.getBoundingClientRect();
      return [left, top];
    }
    current = current.parentElement;
    if (!current || current === document.documentElement) {
      break;
    }
  }
  return null;
};
