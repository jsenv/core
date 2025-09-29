/**
 * Gets the visual bounding rectangle of an element relative to another element or its offset parent.
 * Accounts for scroll positions to provide accurate visual positioning.
 *
 * This function provides visual element positioning calculations:
 * - With one element: Returns visual position relative to its offsetParent
 * - With two elements: Returns visual position of first element relative to second element
 * - Special case: Returns viewport coordinates when element is document
 *
 * Use cases:
 * - Position overlays, tooltips, or dropdowns relative to elements
 * - Calculate visual positioning for drag and drop operations
 * - Determine where elements appear visually within containers
 * - Layout calculations that need to account for scrolling
 *
 * @param {Element|Document} domElement - The element to get coordinates for
 * @param {Element} [secondDomElement] - The reference element (defaults to domElement's offsetParent)
 * @returns {Object} Rectangle with visual coordinates relative to the reference element
 */
export const getVisualRect = (domElement, secondDomElement) => {
  if (domElement === document) {
    return domElement.getBoundingClientRect();
  }
  if (secondDomElement === undefined) {
    secondDomElement = domElement.offsetParent;
    let left = domElement.offsetLeft;
    let top = domElement.offsetTop;

    // Accumulate scroll offsets from all scrollable ancestors up to secondDomElement
    let scrollLeft = 0;
    let scrollTop = 0;
    let scrollableAncestor = domElement.parentElement;
    while (scrollableAncestor && scrollableAncestor !== secondDomElement) {
      scrollLeft += scrollableAncestor.scrollLeft;
      scrollTop += scrollableAncestor.scrollTop;
      scrollableAncestor = scrollableAncestor.parentElement;
    }

    // Apply visual positioning (layout position minus scroll offsets)
    left -= scrollLeft;
    top -= scrollTop;

    const { width, height } = domElement.getBoundingClientRect();
    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
    };
  }

  if (!secondDomElement.contains(domElement)) {
    throw new Error("getVisualRect: secondDomElement must contain domElement");
  }
  let left = domElement.offsetLeft;
  let top = domElement.offsetTop;
  let domElementAncestor = domElement.offsetParent;

  // Accumulate layout positions from offsetParent chain
  while (domElementAncestor !== secondDomElement) {
    left += domElementAncestor.offsetLeft;
    top += domElementAncestor.offsetTop;
    domElementAncestor = domElementAncestor.offsetParent;
  }

  // Accumulate scroll offsets from all scrollable ancestors up to and including secondDomElement
  let scrollLeft = 0;
  let scrollTop = 0;
  let scrollableAncestor = domElement.parentElement;
  while (scrollableAncestor) {
    scrollLeft += scrollableAncestor.scrollLeft;
    scrollTop += scrollableAncestor.scrollTop;
    if (scrollableAncestor === secondDomElement) {
      break;
    }
    scrollableAncestor = scrollableAncestor.parentElement;
  }

  // Apply visual positioning (layout position minus scroll offsets)
  left -= scrollLeft;
  top -= scrollTop;
  const clientRect = domElement.getBoundingClientRect();
  const { width, height } = clientRect;
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
};
