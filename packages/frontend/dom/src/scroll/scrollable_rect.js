import { getScrollableParent } from "./parent_scroll.js";

const { documentElement } = document;

export const getElementScrollableRect = (
  element,
  scrollableParent = getScrollableParent(element),
  { useOriginalPositionEvenIfSticky = false } = {},
) => {
  const { left, top, width, height } = element.getBoundingClientRect();
  let fromFixed = false;
  let fromStickyLeft;
  let fromStickyTop;
  let fromStickyLeftAttr;
  let fromStickyTopAttr;
  const createScrollableRectResult = (leftScrollable, topScrollable) => {
    return {
      left: leftScrollable,
      top: topScrollable,
      right: leftScrollable + width,
      bottom: topScrollable + height,
      width,
      height,
      fromFixed,
      fromStickyLeft,
      fromStickyTop,
      fromStickyLeftAttr,
      fromStickyTopAttr,
    };
  };

  const computedStyle = getComputedStyle(element);
  const usePositionSticky = computedStyle.position === "sticky";
  const scrollableParentIsDocument = scrollableParent === documentElement;
  if (usePositionSticky) {
    // For CSS position:sticky elements, use scrollable-relative coordinates
    const [leftScrollable, topScrollable] = viewportCoordsToScrollableCoords(
      left,
      top,
      scrollableParent,
    );
    const isStickyLeft = computedStyle.left !== "auto";
    const isStickyTop = computedStyle.top !== "auto";
    fromStickyLeft = isStickyLeft
      ? { value: parseFloat(computedStyle.left) || 0 }
      : undefined;
    fromStickyTop = isStickyTop
      ? { value: parseFloat(computedStyle.top) || 0 }
      : undefined;
    return createScrollableRectResult(leftScrollable, topScrollable);
  }
  const usePositionFixed = computedStyle.position === "fixed";
  if (usePositionFixed) {
    fromFixed = true;
    // For position:fixed elements, get viewport coordinates and convert to scrollable-relative
    if (scrollableParentIsDocument) {
      const [leftScrollable, topScrollable] = fixedCoordsToScrollableCoords(
        left,
        top,
      );
      return createScrollableRectResult(leftScrollable, topScrollable);
    }
    // For container scrolling, we need to convert relative to the container
    // Fixed elements are positioned relative to viewport, but we need coordinates
    // relative to the scrollable parent for constraint calculations
    const scrollableParentRect = scrollableParent.getBoundingClientRect();
    const leftScrollable = left - scrollableParentRect.left;
    const topScrollable = top - scrollableParentRect.top;
    return createScrollableRectResult(leftScrollable, topScrollable);
  }

  const hasStickyLeftAttribute = element.hasAttribute("data-sticky-left");
  const hasStickyTopAttribute = element.hasAttribute("data-sticky-top");
  const useStickyAttribute = hasStickyLeftAttribute || hasStickyTopAttribute;
  if (useStickyAttribute) {
    // Handle virtually sticky obstacles (<col> or <tr>) - elements with data-sticky attributes
    // but not CSS position:sticky. Calculate their position based on scroll and sticky behavior
    let [leftScrollable, topScrollable] = viewportCoordsToScrollableCoords(
      left,
      top,
      scrollableParent,
    );
    if (hasStickyLeftAttribute) {
      const leftCssValue = parseFloat(computedStyle.left) || 0;
      fromStickyLeftAttr = { value: leftCssValue };

      const originalPosition = leftScrollable; // Natural position in scrollable coordinates

      if (useOriginalPositionEvenIfSticky) {
        // For obstacles: use original position only (ignore sticky behavior)
        leftScrollable = originalPosition;
      } else if (scrollableParentIsDocument) {
        // For frontiers with document scrolling: element sticks when scroll passes its natural position
        const scrollLeft = scrollableParent.scrollLeft;
        const stickyPosition = scrollLeft + leftCssValue;
        if (stickyPosition > originalPosition) {
          leftScrollable = stickyPosition; // Element is stuck
        } else {
          leftScrollable = originalPosition; // Element in natural position
        }
      } else {
        // For frontiers with container scrolling: element sticks relative to container scroll
        const scrollLeft = scrollableParent.scrollLeft;
        const stickyPosition = scrollLeft + leftCssValue;
        if (stickyPosition > originalPosition) {
          leftScrollable = stickyPosition; // Element is stuck
        } else {
          leftScrollable = originalPosition; // Element in natural position
        }
      }
    }
    if (hasStickyTopAttribute) {
      const topCssValue = parseFloat(computedStyle.top) || 0;
      fromStickyTopAttr = { value: topCssValue };

      const originalPosition = topScrollable; // Natural position in scrollable coordinates

      if (useOriginalPositionEvenIfSticky) {
        // For obstacles: use original position only (ignore sticky behavior)
        topScrollable = originalPosition;
      } else if (scrollableParentIsDocument) {
        // For frontiers with document scrolling: element sticks when scroll passes its natural position
        const scrollTop = scrollableParent.scrollTop;
        const stickyPosition = scrollTop + topCssValue;
        if (stickyPosition > originalPosition) {
          topScrollable = stickyPosition; // Element is stuck
        } else {
          topScrollable = originalPosition; // Element in natural position
        }
      } else {
        // For frontiers with container scrolling: element sticks relative to container scroll
        const scrollTop = scrollableParent.scrollTop;
        const stickyPosition = scrollTop + topCssValue;
        if (stickyPosition > originalPosition) {
          topScrollable = stickyPosition; // Element is stuck
        } else {
          topScrollable = originalPosition; // Element in natural position
        }
      }
    }
    return createScrollableRectResult(leftScrollable, topScrollable);
  }

  // For normal elements, use scrollable-relative coordinates
  const [leftScrollable, topScrollable] = viewportCoordsToScrollableCoords(
    left,
    top,
    scrollableParent,
  );
  return createScrollableRectResult(leftScrollable, topScrollable);
};

// Local helper to convert viewport coordinates to scrollable-parent-relative coordinates
const viewportCoordsToScrollableCoords = (left, top, scrollableParent) => {
  const scrollableParentIsDocument = scrollableParent === documentElement;
  const { scrollLeft, scrollTop } = scrollableParent;

  if (scrollableParentIsDocument) {
    // For document scrolling: convert to document coordinates
    return [left + scrollLeft, top + scrollTop];
  }

  // For container scrolling: convert to container-relative coordinates
  const scrollableRect = scrollableParent.getBoundingClientRect();
  return [
    left - scrollableRect.left + scrollLeft,
    top - scrollableRect.top + scrollTop,
  ];
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

/**
 * Convert scrollable-parent-relative coordinates to positioned-parent-relative coordinates
 * This is useful for drag operations where you need to position an element using CSS left/top
 * relative to its positioned parent (offsetParent), but you have coordinates in scrollable space.
 *
 * @param {number} leftScrollable - Left coordinate in scrollable-parent-relative space
 * @param {number} topScrollable - Top coordinate in scrollable-parent-relative space
 * @param {Element} elementToPosition - The element that will be positioned (used to find its offsetParent)
 * @param {Element} scrollableParent - The scrollable container
 * @returns {[number, number]} - [left, top] coordinates for CSS positioning relative to offsetParent
 */
export const scrollableCoordsToPositionedParentCoords = (
  leftScrollable,
  topScrollable,
  element,
  scrollableParent = getScrollableParent(element),
) => {
  const scrollableParentIsDocument = scrollableParent === documentElement;

  if (scrollableParentIsDocument) {
    // For document-level positioning, convert from document coordinates to positioned-parent coordinates
    const positionedParent = element.offsetParent || document.body;
    const positionedParentRect = positionedParent.getBoundingClientRect();
    const { scrollLeft, scrollTop } = documentElement;
    // Convert document coordinates to positioned-parent-relative coordinates
    const positionedParentLeftInDocument =
      positionedParentRect.left + scrollLeft;
    const positionedParentTopInDocument = positionedParentRect.top + scrollTop;
    const leftPositioned = leftScrollable - positionedParentLeftInDocument;
    const topPositioned = topScrollable - positionedParentTopInDocument;

    return [leftPositioned, topPositioned];
  }

  // For container scrolling, coordinates are already in the right space
  // (scrollable-parent coordinates can be used directly as positioned coordinates)
  return [leftScrollable, topScrollable];
};
