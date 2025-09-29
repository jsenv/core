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

    // Account for scroll positions in scrollable ancestors
    let scrollableAncestor = domElement.parentElement;
    while (scrollableAncestor && scrollableAncestor !== secondDomElement) {
      if (scrollableAncestor.scrollLeft || scrollableAncestor.scrollTop) {
        left -= scrollableAncestor.scrollLeft;
        top -= scrollableAncestor.scrollTop;
      }
      scrollableAncestor = scrollableAncestor.parentElement;
    }

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

  // Walk up the offsetParent chain and subtract scroll positions
  while (domElementAncestor !== secondDomElement) {
    left += domElementAncestor.offsetLeft;
    top += domElementAncestor.offsetTop;

    // Subtract scroll positions from scrollable ancestors between current and next offsetParent
    let scrollableAncestor = domElementAncestor.parentElement;
    const nextOffsetParent = domElementAncestor.offsetParent;
    while (
      scrollableAncestor &&
      scrollableAncestor !== nextOffsetParent &&
      scrollableAncestor !== secondDomElement
    ) {
      if (scrollableAncestor.scrollLeft || scrollableAncestor.scrollTop) {
        left -= scrollableAncestor.scrollLeft;
        top -= scrollableAncestor.scrollTop;
      }
      scrollableAncestor = scrollableAncestor.parentElement;
    }

    domElementAncestor = domElementAncestor.offsetParent;
  }
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
