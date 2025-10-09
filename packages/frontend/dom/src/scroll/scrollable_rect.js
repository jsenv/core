const { documentElement } = document;

/**
 * Convert mouse event coordinates to the appropriate coordinate space for the scrollable parent
 * @param {MouseEvent} mouseEvent - Mouse event
 * @param {Element} scrollableParent - The scrollable container
 * @returns {[number, number]} - [x, y] in the appropriate coordinate space
 */
export const mouseEventToScrollableCoords = (mouseEvent, scrollableParent) => {
  const scrollableParentIsDocument = scrollableParent === documentElement;

  if (scrollableParentIsDocument) {
    // For document scrolling: convert to document coordinates
    return [
      mouseEvent.clientX + scrollableParent.scrollLeft,
      mouseEvent.clientY + scrollableParent.scrollTop,
    ];
  }

  // For container scrolling: convert to container-relative coordinates
  const scrollableRect = scrollableParent.getBoundingClientRect();
  return [
    mouseEvent.clientX - scrollableRect.left + scrollableParent.scrollLeft,
    mouseEvent.clientY - scrollableRect.top + scrollableParent.scrollTop,
  ];
};

export const getElementScrollableRect = (element, scrollableParent) => {
  const rect = element.getBoundingClientRect();
  const scrollableParentIsDocument = scrollableParent === documentElement;

  if (scrollableParentIsDocument) {
    // For document scrolling: convert to document coordinates
    const left = rect.left + scrollableParent.scrollLeft;
    const top = rect.top + scrollableParent.scrollTop;
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
  const left = rect.left - scrollableRect.left + scrollableParent.scrollLeft;
  const top = rect.top - scrollableRect.top + scrollableParent.scrollTop;
  return {
    left,
    top,
    right: left + rect.width,
    bottom: top + rect.height,
    width: rect.width,
    height: rect.height,
  };
};
