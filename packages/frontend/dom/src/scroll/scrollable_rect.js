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
    const coords = viewportCoordsToScrollableCoords(
      rect.left,
      rect.top,
      scrollableParent,
    );

    return createScrollableRectResult(coords.left, coords.top, rect, {
      fromStickyLeft: isStickyLeft
        ? { value: parseFloat(computedStyle.left) || 0 }
        : undefined,
      fromStickyTop: isStickyTop
        ? { value: parseFloat(computedStyle.top) || 0 }
        : undefined,
    });
  }
  const usePositionFixed = computedStyle.position === "fixed";
  if (usePositionFixed) {
    // For position:fixed elements, get viewport coordinates and convert to scrollable-relative
    const elementRect = element.getBoundingClientRect();
    if (scrollableParent === documentElement) {
      // For document scrolling, use the helper to convert fixed coordinates to document coordinates
      const [left, top] = fixedCoordsToScrollableCoords(
        elementRect.left,
        elementRect.top,
      );

      return createScrollableRectResult(left, top, elementRect, {
        fromFixed: true,
      });
    }

    // For container scrolling, we need to convert relative to the container
    // Fixed elements are positioned relative to viewport, but we need coordinates
    // relative to the scrollable parent for constraint calculations
    const scrollableParentRect = scrollableParent.getBoundingClientRect();
    const left = elementRect.left - scrollableParentRect.left;
    const top = elementRect.top - scrollableParentRect.top;

    return createScrollableRectResult(left, top, elementRect, {
      fromFixed: true,
    });
  }

  const hasStickyLeftAttribute = element.hasAttribute("data-sticky-left");
  const hasStickyTopAttribute = element.hasAttribute("data-sticky-top");
  const useStickyAttribute = hasStickyLeftAttribute || hasStickyTopAttribute;
  if (useStickyAttribute) {
    // Handle virtually sticky obstacles (<col> or <tr>) - elements with data-sticky attributes
    // but not CSS position:sticky. Calculate their position based on scroll and sticky behavior
    const rect = element.getBoundingClientRect();
    const baseCoords = viewportCoordsToScrollableCoords(
      rect.left,
      rect.top,
      scrollableParent,
    );

    let left = baseCoords.left;
    let top = baseCoords.top;
    if (hasStickyLeftAttribute) {
      const stickyLeft = parseFloat(computedStyle.left) || 0;
      // For sticky behavior, element should be positioned at its CSS left value relative to scrollable parent
      const parentLeft =
        scrollableParent === documentElement ? 0 : baseCoords.left;
      left = parentLeft + stickyLeft;

      if (useNonStickyLeftEvenIfStickyLeft) {
        // When element hasn't crossed visible area, use its actual scroll-adjusted position
        const scrollLeft = scrollableParent.scrollLeft;
        left += scrollLeft;
      }
    }
    if (hasStickyTopAttribute) {
      const stickyTop = parseFloat(computedStyle.top) || 0;
      // For sticky behavior, element should be positioned at its CSS top value relative to scrollable parent
      const parentTop =
        scrollableParent === documentElement ? 0 : baseCoords.top;
      top = parentTop + stickyTop;

      if (useNonStickyTopEvenIfStickyTop) {
        // When element hasn't crossed visible area, use its actual scroll-adjusted position
        const scrollTop = scrollableParent.scrollTop;
        top += scrollTop;
      }
    }

    return createScrollableRectResult(left, top, rect, {
      fromStickyLeftAttr: hasStickyLeftAttribute
        ? { value: parseFloat(computedStyle.left) || 0 }
        : undefined,
      fromStickyTopAttr: hasStickyTopAttribute
        ? { value: parseFloat(computedStyle.top) || 0 }
        : undefined,
    });
  }

  // For normal elements, use scrollable-relative coordinates
  const rect = element.getBoundingClientRect();
  const coords = viewportCoordsToScrollableCoords(
    rect.left,
    rect.top,
    scrollableParent,
  );

  return createScrollableRectResult(coords.left, coords.top, rect);
};

// Local helper to convert viewport coordinates to scrollable-parent-relative coordinates
const viewportCoordsToScrollableCoords = (left, top, scrollableParent) => {
  const scrollableParentIsDocument = scrollableParent === documentElement;
  const { scrollLeft, scrollTop } = scrollableParent;

  if (scrollableParentIsDocument) {
    // For document scrolling: convert to document coordinates
    return {
      left: left + scrollLeft,
      top: top + scrollTop,
    };
  }

  // For container scrolling: convert to container-relative coordinates
  const scrollableRect = scrollableParent.getBoundingClientRect();
  return {
    left: left - scrollableRect.left + scrollLeft,
    top: top - scrollableRect.top + scrollTop,
  };
};

// Local helper to create the standard return object structure
const createScrollableRectResult = (left, top, rect, positioning = {}) => {
  return {
    left,
    top,
    right: left + rect.width,
    bottom: top + rect.height,
    width: rect.width,
    height: rect.height,
    fromFixed: positioning.fromFixed || false,
    fromStickyLeft: positioning.fromStickyLeft,
    fromStickyTop: positioning.fromStickyTop,
    fromStickyLeftAttr: positioning.fromStickyLeftAttr,
    fromStickyTopAttr: positioning.fromStickyTopAttr,
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
  const coords = viewportCoordsToScrollableCoords(
    rect.left,
    rect.top,
    scrollableParent,
  );
  return [coords.left, coords.top];
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
