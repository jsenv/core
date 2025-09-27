/**
 * Gets the bounding rectangle of an element relative to the document origin,
 * providing coordinates that remain stable regardless of viewport scroll position.
 * 
 * This is useful when you need to:
 * - Position absolutely positioned elements relative to document.body
 * - Create overlays, tooltips, or dropdowns that need precise positioning
 * - Implement drag and drop with elements appended to document.body
 * - Calculate distances between elements on the page
 * - Position elements that persist across scroll events
 * 
 * Unlike getBoundingClientRect() which returns viewport coordinates,
 * this function returns document coordinates that don't change when scrolling.
 * 
 * @param {Element} domElement - The DOM element to get coordinates for
 * @returns {Object} Rectangle with document coordinates and viewport reference
 */
export const getBoundingDocumentRect = (domElement) => {
  let left = domElement.offsetLeft;
  let top = domElement.offsetTop;
  let domElementAncestor = domElement.offsetParent;
  while (domElementAncestor) {
    left += domElementAncestor.offsetLeft;
    top += domElementAncestor.offsetTop;
    domElementAncestor = domElementAncestor.offsetParent;
  }
  const boundingClientRect = domElement.getBoundingClientRect();
  const width = boundingClientRect.width;
  const height = boundingClientRect.height;
  return {
    boundingClientRect, // viewport coordinates for reference
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
};
