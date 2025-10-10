const { documentElement } = document;

export const getElementScrollableRect = (
  element,
  scrollableParent,
  {
    useNonStickyLeftEvenIfStickyLeft = false,
    useNonStickyTopEvenIfStickyTop = false,
  } = {},
) => {
  const computedStyle = getComputedStyle(element);
  const usePositionSticky = computedStyle.position === "sticky";
  if (usePositionSticky) {
    const isStickyLeft = computedStyle.left !== "auto";
    const isStickyTop = computedStyle.top !== "auto";
    // For CSS position:sticky elements, use scrollable-relative coordinates
    const rect = element.getBoundingClientRect();
    const scrollableParentIsDocument = scrollableParent === documentElement;
    const { scrollLeft, scrollTop } = scrollableParent;

    let left;
    let top;
    if (scrollableParentIsDocument) {
      // For document scrolling: convert to document coordinates
      left = rect.left + scrollLeft;
      top = rect.top + scrollTop;
    } else {
      // For container scrolling: convert to container-relative coordinates
      const scrollableRect = scrollableParent.getBoundingClientRect();
      left = rect.left - scrollableRect.left + scrollLeft;
      top = rect.top - scrollableRect.top + scrollTop;
    }

    return {
      left,
      top,
      right: left + rect.width,
      bottom: top + rect.height,
      width: rect.width,
      height: rect.height,
      fromFixed: false,
      fromStickyLeft: isStickyLeft
        ? { value: parseFloat(computedStyle.left) || 0 }
        : undefined,
      fromStickyTop: isStickyTop
        ? { value: parseFloat(computedStyle.top) || 0 }
        : undefined,
    };
  }
  const usePositionFixed = computedStyle.position === "fixed";
  if (usePositionFixed) {
    // For position:fixed elements, get viewport coordinates and convert to scrollable-relative
    const elementRect = element.getBoundingClientRect();

    // Convert from viewport coordinates to scrollable-parent-relative coordinates
    // Fixed elements are positioned relative to viewport, but we need coordinates
    // relative to the scrollable parent for constraint calculations
    let scrollableParentRect;
    if (scrollableParent === documentElement) {
      // For document scrolling, add document scroll offset
      const { scrollLeft, scrollTop } = documentElement;
      scrollableParentRect = { left: -scrollLeft, top: -scrollTop };
    } else {
      // For container scrolling, get the container's position
      const rect = scrollableParent.getBoundingClientRect();
      const scrollableParentIsDocument = scrollableParent === documentElement;
      const { scrollLeft, scrollTop } = scrollableParent;

      if (scrollableParentIsDocument) {
        // For document scrolling: convert to document coordinates
        const left = rect.left + scrollLeft;
        const top = rect.top + scrollTop;
        scrollableParentRect = {
          left,
          top,
          right: left + rect.width,
          bottom: top + rect.height,
          width: rect.width,
          height: rect.height,
        };
      } else {
        // For container scrolling: convert to container-relative coordinates
        const scrollableRect = scrollableParent.getBoundingClientRect();
        const left = rect.left - scrollableRect.left + scrollLeft;
        const top = rect.top - scrollableRect.top + scrollTop;
        scrollableParentRect = {
          left,
          top,
          right: left + rect.width,
          bottom: top + rect.height,
          width: rect.width,
          height: rect.height,
        };
      }
    }
    const left = elementRect.left - scrollableParentRect.left;
    const top = elementRect.top - scrollableParentRect.top;
    const right = elementRect.right - scrollableParentRect.left;
    const bottom = elementRect.bottom - scrollableParentRect.top;

    return {
      left,
      top,
      right,
      bottom,
      width: elementRect.width,
      height: elementRect.height,
      fromFixed: true,
      fromStickyLeft: undefined,
      fromStickyTop: undefined,
    };
  }

  const hasStickyLeftAttribute = element.hasAttribute("data-sticky-left");
  const hasStickyTopAttribute = element.hasAttribute("data-sticky-top");
  const useStickyAttribute = hasStickyLeftAttribute || hasStickyTopAttribute;
  if (useStickyAttribute) {
    // Handle virtually sticky obstacles (<col> or <tr>) - elements with data-sticky attributes
    // but not CSS position:sticky. Calculate their position based on scroll and sticky behavior
    const rect = element.getBoundingClientRect();
    const scrollableParentIsDocument = scrollableParent === documentElement;
    const { scrollLeft, scrollTop } = scrollableParent;

    let baseLeft;
    let baseTop;
    if (scrollableParentIsDocument) {
      // For document scrolling: convert to document coordinates
      baseLeft = rect.left + scrollLeft;
      baseTop = rect.top + scrollTop;
    } else {
      // For container scrolling: convert to container-relative coordinates
      const scrollableRect = scrollableParent.getBoundingClientRect();
      baseLeft = rect.left - scrollableRect.left + scrollLeft;
      baseTop = rect.top - scrollableRect.top + scrollTop;
    }

    let left = baseLeft;
    let top = baseTop;
    if (hasStickyLeftAttribute) {
      const stickyLeft = parseFloat(computedStyle.left) || 0;
      // For sticky behavior, element should be positioned at its CSS left value relative to scrollable parent
      let parentRect;
      if (scrollableParentIsDocument) {
        parentRect = { left: 0, top: 0 };
      } else {
        const parentBound = scrollableParent.getBoundingClientRect();
        const { scrollLeft, scrollTop } = scrollableParent;
        const scrollableRect = scrollableParent.getBoundingClientRect();
        parentRect = {
          left: parentBound.left - scrollableRect.left + scrollLeft,
          top: parentBound.top - scrollableRect.top + scrollTop,
        };
      }
      left = parentRect.left + stickyLeft;

      if (useNonStickyLeftEvenIfStickyLeft) {
        // When element hasn't crossed visible area, use its actual scroll-adjusted position
        const scrollLeft = scrollableParent.scrollLeft;
        left += scrollLeft;
      }
    }
    if (hasStickyTopAttribute) {
      const stickyTop = parseFloat(computedStyle.top) || 0;
      // For sticky behavior, element should be positioned at its CSS top value relative to scrollable parent
      let parentRect;
      if (scrollableParentIsDocument) {
        parentRect = { left: 0, top: 0 };
      } else {
        const parentBound = scrollableParent.getBoundingClientRect();
        const { scrollLeft, scrollTop } = scrollableParent;
        const scrollableRect = scrollableParent.getBoundingClientRect();
        parentRect = {
          left: parentBound.left - scrollableRect.left + scrollLeft,
          top: parentBound.top - scrollableRect.top + scrollTop,
        };
      }
      top = parentRect.top + stickyTop;

      if (useNonStickyTopEvenIfStickyTop) {
        // When element hasn't crossed visible area, use its actual scroll-adjusted position
        const scrollTop = scrollableParent.scrollTop;
        top += scrollTop;
      }
    }

    return {
      left,
      top,
      right: left + rect.width,
      bottom: top + rect.height,
      width: rect.width,
      height: rect.height,
      fromFixed: false,
      fromStickyLeftAttr: hasStickyLeftAttribute
        ? { value: parseFloat(computedStyle.left) || 0 }
        : undefined,
      fromStickyTopAttr: hasStickyTopAttribute
        ? { value: parseFloat(computedStyle.top) || 0 }
        : undefined,
    };
  }

  // For normal elements, use scrollable-relative coordinates
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
      fromFixed: false,
      fromStickyLeft: undefined,
      fromStickyTop: undefined,
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
    fromFixed: false,
    fromStickyLeft: undefined,
    fromStickyTop: undefined,
  };
};

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
export const elementToScrollableCoords = (rect, scrollableParent) => {
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
 * Compute sticky coordinates for an element's current position
 * Takes an element and computes both left and top sticky values based on its current position
 * @param {Element} element - The element to compute sticky coordinates for
 * @param {Element} scrollableParent - The scrollable container
 * @param {{isStickyLeft: boolean, isStickyTop: boolean}} options - Sticky behavior flags
 * @returns {[number, number]} - [left, top] CSS values for sticky positioning
 */
export const elementToStickyCoords = (
  element,
  scrollableParent,
  { isStickyLeft, isStickyTop },
) => {
  const elementRect = element.getBoundingClientRect();
  const scrollableRect = scrollableParent.getBoundingClientRect();
  const leftRelative = elementRect.left - scrollableRect.left;
  const topRelative = elementRect.top - scrollableRect.top;
  const scrollableParentIsDocument = scrollableParent === documentElement;

  let left = leftRelative;
  let top = topRelative;

  if (isStickyLeft && !scrollableParentIsDocument) {
    left -= scrollableParent.scrollLeft;
  }
  if (isStickyTop && !scrollableParentIsDocument) {
    top -= scrollableParent.scrollTop;
  }

  return [left, top];
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
