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
export const getElementVisualCoords = (
  domElement,
  secondDomElement,
  { isStickyLeft, isStickyTop, isFixed } = {},
) => {
  if (domElement === document) {
    const { left, top } = domElement.getBoundingClientRect();
    return [left, top];
  }
  if (secondDomElement === undefined) {
    secondDomElement = domElement.offsetParent;
  } else if (!secondDomElement.contains(domElement)) {
    throw new Error("getVisualRect: secondDomElement must contain domElement");
  }

  let left = domElement.offsetLeft;
  let top = domElement.offsetTop;
  let domElementAncestor = domElement.offsetParent;
  // Accumulate layout positions from offsetParent chain
  while (domElementAncestor && domElementAncestor !== secondDomElement) {
    left += domElementAncestor.offsetLeft;
    top += domElementAncestor.offsetTop;
    if (domElementAncestor.contains(secondDomElement)) {
      break;
    }
    domElementAncestor = domElementAncestor.offsetParent;
  }

  // Accumulate scroll offsets from all scrollable ancestors up to and including secondDomElement
  const computedStyle = getComputedStyle(domElement);
  if (isFixed === undefined) {
    isFixed = computedStyle.position === "fixed";
  }
  if (isStickyLeft === undefined) {
    isStickyLeft =
      domElement.hasAttribute("data-sticky-left") ||
      (computedStyle.position === "sticky" && computedStyle.left !== "auto");
  }
  if (isStickyTop === undefined) {
    isStickyTop =
      domElement.hasAttribute("data-sticky-top") ||
      (computedStyle.position === "sticky" && computedStyle.top !== "auto");
  }
  if (!isStickyLeft && !isStickyTop) {
    let scrollLeft = 0;
    let scrollTop = 0;
    let scrollableAncestor = domElement.parentElement;
    while (scrollableAncestor) {
      if (scrollableAncestor === document.body) {
        scrollLeft += document.documentElement.scrollLeft;
        scrollTop += document.documentElement.scrollTop;
        break;
      }
      scrollLeft += scrollableAncestor.scrollLeft;
      scrollTop += scrollableAncestor.scrollTop;
      if (scrollableAncestor === secondDomElement) {
        break;
      }
      scrollableAncestor = scrollableAncestor.parentElement;
    }
    if (!isStickyLeft) {
      left -= scrollLeft;
    }
    if (!isStickyTop) {
      top -= scrollTop;
    }
  }

  return [left, top];
};
