const { documentElement } = document;

/**
 * Convert mouse event coordinates to the appropriate coordinate space for the scrollable parent
 * @param {MouseEvent} mouseEvent - Mouse event
 * @param {Element} scrollableParent - The scrollable container
 * @returns {[number, number]} - [x, y] in the appropriate coordinate space
 */
export const mouseEventToScrollableCoords = (mouseEvent, scrollableParent) => {
  const scrollableParentIsDocument = scrollableParent === documentElement;
  const { scrollLeft, scrollTop } = scrollableParent;

  if (scrollableParentIsDocument) {
    // For document scrolling: convert to document coordinates
    return [mouseEvent.clientX + scrollLeft, mouseEvent.clientY + scrollTop];
  }

  // For container scrolling: convert to container-relative coordinates
  const scrollableRect = scrollableParent.getBoundingClientRect();
  return [
    mouseEvent.clientX - scrollableRect.left + scrollLeft,
    mouseEvent.clientY - scrollableRect.top + scrollTop,
  ];
};

export const getElementScrollableRect = (element, scrollableParent) => {
  const rect = element.getBoundingClientRect();
  const scrollableParentIsDocument = scrollableParent === documentElement;
  const { scrollLeft, scrollTop } = scrollableParent;

  if (scrollableParentIsDocument) {
    // For document scrolling: convert to document coordinates
    const left = rect.left + scrollLeft;
    const top = rect.top + scrollTop;
    return {
      left,
      top,
      right: left + rect.width,
      bottom: top + rect.height,
      width: rect.width,
      height: rect.height,
    };
  }

  // For container scrolling: convert to container-relative coordinates
  const scrollableRect = scrollableParent.getBoundingClientRect();
  const left = rect.left - scrollableRect.left + scrollLeft;
  const top = rect.top - scrollableRect.top + scrollTop;
  return {
    left,
    top,
    right: left + rect.width,
    bottom: top + rect.height,
    width: rect.width,
    height: rect.height,
  };
};

/**
 * Convert coordinates from scrollable-parent-relative space to viewport coordinates
 * @param {number} x - X coordinate in scrollable-parent-relative space
 * @param {number} y - Y coordinate in scrollable-parent-relative space
 * @param {Element} scrollableParent - The scrollable container
 * @returns {[number, number]} - [x, y] in viewport coordinates
 */
export const scrollableCoordsToViewport = (x, y, scrollableParent) => {
  const scrollableParentIsDocument = scrollableParent === documentElement;
  const { scrollLeft, scrollTop } = scrollableParent;

  if (scrollableParentIsDocument) {
    // For document scrolling: convert from document coordinates to viewport
    return [x - scrollLeft, y - scrollTop];
  }

  // For container scrolling: convert from container-relative coordinates to viewport
  const scrollableRect = scrollableParent.getBoundingClientRect();
  return [
    scrollableRect.left + x - scrollLeft,
    scrollableRect.top + y - scrollTop,
  ];
};

/**
 * Convert element getBoundingClientRect coordinates to scrollable-parent-relative coordinates
 * This is useful when you need to pass element coordinates to drag gesture functions that expect
 * coordinates in the scrollable parent's coordinate space.
 * @param {DOMRect|{left: number, top: number}} rect - Result from getBoundingClientRect()
 * @param {Element} scrollableParent - The scrollable container
 * @returns {[number, number]} - [x, y] in scrollable-parent-relative space
 */
export const elementRectToScrollableCoords = (rect, scrollableParent) => {
  const scrollableParentIsDocument = scrollableParent === documentElement;
  const { scrollLeft, scrollTop } = scrollableParent;

  if (scrollableParentIsDocument) {
    // For document scrolling: convert viewport coordinates to document coordinates
    return [rect.left + scrollLeft, rect.top + scrollTop];
  }

  // For container scrolling: convert viewport coordinates to container-relative coordinates
  const scrollableRect = scrollableParent.getBoundingClientRect();
  return [
    rect.left - scrollableRect.left + scrollLeft,
    rect.top - scrollableRect.top + scrollTop,
  ];
};

/**
 * Convert fixed position coordinates to scrollable-parent-relative coordinates
 * Fixed elements are always positioned relative to the viewport, so we always convert to document coordinates.
 * @param {number} x - X coordinate in fixed positioning space (viewport-relative)
 * @param {number} y - Y coordinate in fixed positioning space (viewport-relative)
 * @returns {[number, number]} - [x, y] in document coordinates
 */
export const fixedCoordsToScrollableCoords = (x, y) => {
  // Fixed elements are always relative to viewport, so convert to document coordinates
  const { scrollLeft, scrollTop } = documentElement;
  return [x + scrollLeft, y + scrollTop];
};

/**
 * Convert sticky left CSS value to scrollable-parent-relative coordinate
 * @param {number} leftValue - CSS left value for sticky positioning
 * @param {Element} scrollableParent - The scrollable container
 * @returns {number} - Left coordinate in scrollable-parent-relative space
 */
export const stickyLeftToScrollableLeft = (leftValue, scrollableParent) => {
  const scrollableParentIsDocument = scrollableParent === documentElement;

  if (scrollableParentIsDocument) {
    // For document scrolling: use sticky value directly
    return leftValue;
  }

  // For container scrolling: adjust sticky value with current scroll position
  return leftValue + scrollableParent.scrollLeft;
};

/**
 * Convert sticky top CSS value to scrollable-parent-relative coordinate
 * @param {number} topValue - CSS top value for sticky positioning
 * @param {Element} scrollableParent - The scrollable container
 * @returns {number} - Top coordinate in scrollable-parent-relative space
 */
export const stickyTopToScrollableTop = (topValue, scrollableParent) => {
  const scrollableParentIsDocument = scrollableParent === documentElement;

  if (scrollableParentIsDocument) {
    // For document scrolling: use sticky value directly
    return topValue;
  }

  // For container scrolling: adjust sticky value with current scroll position
  return topValue + scrollableParent.scrollTop;
};

/**
 * Convert scrollable-parent-relative coordinates back to fixed position coordinates
 * This is the reverse of fixedCoordsToScrollableCoords.
 * @param {number} x - X coordinate in scrollable-parent-relative space (document coordinates)
 * @param {number} y - Y coordinate in scrollable-parent-relative space (document coordinates)
 * @returns {[number, number]} - [x, y] in fixed positioning space (viewport-relative)
 */
export const scrollableCoordsToFixedCoords = (x, y) => {
  // Convert from document coordinates back to viewport coordinates
  const { scrollLeft, scrollTop } = documentElement;
  return [x - scrollLeft, y - scrollTop];
};

/**
 * Convert scrollable-parent-relative coordinate back to sticky left CSS value
 * This is the reverse of stickyLeftToScrollableLeft.
 * @param {number} leftScrollable - Left coordinate in scrollable-parent-relative space
 * @param {Element} scrollableParent - The scrollable container
 * @returns {number} - CSS left value for sticky positioning
 */
export const scrollableLeftToStickyLeft = (
  leftScrollable,
  scrollableParent,
) => {
  const scrollableParentIsDocument = scrollableParent === documentElement;

  if (scrollableParentIsDocument) {
    // For document scrolling: use scrollable value directly
    return leftScrollable;
  }

  // For container scrolling: subtract current scroll position to get CSS value
  return leftScrollable - scrollableParent.scrollLeft;
};

/**
 * Convert scrollable-parent-relative coordinate back to sticky top CSS value
 * This is the reverse of stickyTopToScrollableTop.
 * @param {number} topScrollable - Top coordinate in scrollable-parent-relative space
 * @param {Element} scrollableParent - The scrollable container
 * @returns {number} - CSS top value for sticky positioning
 */
export const scrollableTopToStickyTop = (topScrollable, scrollableParent) => {
  const scrollableParentIsDocument = scrollableParent === documentElement;

  if (scrollableParentIsDocument) {
    // For document scrolling: use scrollable value directly
    return topScrollable;
  }

  // For container scrolling: subtract current scroll position to get CSS value
  return topScrollable - scrollableParent.scrollTop;
};

/**
 * Compute sticky coordinates for an element's current position
 * Takes an element and computes both left and top sticky values based on its current position
 * @param {Element} element - The element to compute sticky coordinates for
 * @param {Element} scrollableParent - The scrollable container
 * @returns {{left: number, top: number}} - CSS values for sticky positioning
 */
export const scrollableCoordsToStickyCoords = (element, scrollableParent) => {
  const elementRect = element.getBoundingClientRect();
  const scrollableRect = scrollableParent.getBoundingClientRect();
  const leftRelative = elementRect.left - scrollableRect.left;
  const topRelative = elementRect.top - scrollableRect.top;

  const stickyLeft = scrollableLeftToStickyLeft(leftRelative, scrollableParent);
  const stickyTop = scrollableTopToStickyTop(topRelative, scrollableParent);

  return { left: stickyLeft, top: stickyTop };
};

/**
 * Get current element position and convert to fixed coordinates for positioning
 * Takes an element and returns its current position as fixed coordinates
 * @param {Element} element - The element to get fixed coordinates for
 * @returns {[number, number]} - [x, y] in fixed positioning space (viewport-relative)
 */
export const elementToFixedCoords = (element) => {
  const rect = element.getBoundingClientRect();
  // getBoundingClientRect already gives viewport coordinates, which is what fixed positioning uses
  return [rect.left, rect.top];
};
