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
