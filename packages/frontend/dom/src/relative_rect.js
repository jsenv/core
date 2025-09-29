/**
 * Gets the bounding rectangle of an element relative to another element or its offset parent.
 *
 * This function provides flexible element positioning calculations:
 * - With one element: Returns position relative to its offsetParent
 * - With two elements: Returns position of first element relative to second element
 * - Special case: Returns viewport coordinates when element is document
 *
 * Use cases:
 * - Calculate element positions within their positioning context
 * - Determine relative positioning between nested elements
 * - Layout calculations for drag and drop operations
 * - Positioning elements relative to their containers
 *
 * @param {Element|Document} domElement - The element to get coordinates for
 * @param {Element} [secondDomElement] - The reference element (defaults to domElement's offsetParent)
 * @returns {Object} Rectangle with coordinates relative to the reference element
 */
export const getRelativeRect = (domElement, secondDomElement) => {
  if (domElement === document) {
    return domElement.getBoundingClientRect();
  }
  if (secondDomElement === undefined) {
    secondDomElement = domElement.offsetParent;
    const left = domElement.offsetLeft;
    const top = domElement.offsetTop;
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
    throw new Error(
      "getRelativeRect: secondDomElement must contain domElement",
    );
  }
  let left = domElement.offsetLeft;
  let top = domElement.offsetTop;
  let domElementAncestor = domElement.offsetParent;
  while (domElementAncestor !== secondDomElement) {
    left += domElementAncestor.offsetLeft;
    top += domElementAncestor.offsetTop;
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
