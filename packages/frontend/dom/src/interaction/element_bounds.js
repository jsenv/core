import { getElementScrollableRect } from "../scroll/scrollable_rect.js";

/**
 * Get element bounds in scrollable-parent-relative coordinates, handling both normal positioning and data-sticky-left|top
 * @param {HTMLElement} element - The element to get bounds for
 * @param {HTMLElement} scrollableParent - The scrollable parent element
 * @returns {Object} Bounds object with left, top, right, bottom properties in scrollable-relative coordinates
 */
export const getElementBounds = (
  element,
  {
    scrollableParent,
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
    const elementRect = getElementScrollableRect(element, scrollableParent);
    const { left, top, right, bottom } = elementRect;
    return {
      isFixed: false,
      isStickyLeft,
      isStickyTop,
      left,
      top,
      right,
      bottom,
    };
  }
  const usePositionFixed = computedStyle.position === "fixed";
  if (usePositionFixed) {
    // For position:fixed elements, use viewport-relative coordinates adjusted for scroll
    const elementRect = getElementScrollableRect(element, scrollableParent);
    const { left, top, right, bottom } = elementRect;
    return {
      isFixed: true,
      left,
      top,
      right,
      bottom,
    };
  }

  const hasStickyLeftAttribute = element.hasAttribute("data-sticky-left");
  const hasStickyTopAttribute = element.hasAttribute("data-sticky-top");
  const useStickyAttribute = hasStickyLeftAttribute || hasStickyTopAttribute;
  if (!useStickyAttribute) {
    // For normal elements, use scrollable-relative coordinates
    const elementRect = getElementScrollableRect(element, scrollableParent);
    const { left, top, right, bottom } = elementRect;
    return {
      isFixed: false,
      isStickyLeft: false,
      isStickyTop: false,
      left,
      top,
      right,
      bottom,
    };
  }

  // Handle virtually sticky obstacles (<col> or <tr>) - elements with data-sticky attributes
  // but not CSS position:sticky. Calculate their position based on scroll and sticky behavior
  const elementRect = getElementScrollableRect(element, scrollableParent);
  const { left: baseLeft, top: baseTop, width, height } = elementRect;
  let left = baseLeft;
  let top = baseTop;
  if (hasStickyLeftAttribute) {
    const stickyLeft = parseFloat(computedStyle.left) || 0;
    // For sticky behavior, element should be positioned at its CSS left value relative to scrollable parent
    const scrollableRect = getElementScrollableRect(
      scrollableParent,
      scrollableParent,
    );
    left = scrollableRect.left + stickyLeft;

    if (useNonStickyLeftEvenIfStickyLeft) {
      // When element hasn't crossed visible area, use its actual scroll-adjusted position
      const scrollLeft = scrollableParent.scrollLeft;
      left += scrollLeft;
    }
  }
  if (hasStickyTopAttribute) {
    const stickyTop = parseFloat(computedStyle.top) || 0;
    // For sticky behavior, element should be positioned at its CSS top value relative to scrollable parent
    const scrollableRect = getElementScrollableRect(
      scrollableParent,
      scrollableParent,
    );
    top = scrollableRect.top + stickyTop;

    if (useNonStickyTopEvenIfStickyTop) {
      // When element hasn't crossed visible area, use its actual scroll-adjusted position
      const scrollTop = scrollableParent.scrollTop;
      top += scrollTop;
    }
  }

  return {
    isFixed: false,
    isStickyLeft: hasStickyLeftAttribute,
    isStickyTop: hasStickyTopAttribute,
    left,
    top,
    right: left + width,
    bottom: top + height,
  };
};
