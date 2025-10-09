import { getElementScrollableRect } from "../scroll/scrollable_rect.js";

/**
 * Get element bounds in scrollable-parent-relative coordinates
 * @param {HTMLElement} element - The element to get bounds for
 * @param {HTMLElement} scrollableParent - The scrollable parent element
 * @returns {Object} Bounds object with left, top, right, bottom properties.
 *   All coordinates are in scrollable-parent-relative space for consistency.
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
      left,
      top,
      right,
      bottom,
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
    if (scrollableParent === document.documentElement) {
      // For document scrolling, add document scroll offset
      const { scrollLeft, scrollTop } = document.documentElement;
      scrollableParentRect = { left: -scrollLeft, top: -scrollTop };
    } else {
      // For container scrolling, get the container's position
      scrollableParentRect = getElementScrollableRect(
        scrollableParent,
        scrollableParent,
      );
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
      fromFixed: true,
      fromStickyLeft: undefined,
      fromStickyTop: undefined,
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
      left,
      top,
      right,
      bottom,
      fromFixed: false,
      fromStickyLeft: undefined,
      fromStickyTop: undefined,
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
    left,
    top,
    right: left + width,
    bottom: top + height,
    fromFixed: false,
    fromStickyLeftAttr: hasStickyLeftAttribute
      ? { value: parseFloat(computedStyle.left) || 0 }
      : undefined,
    fromStickyTopAttr: hasStickyTopAttribute
      ? { value: parseFloat(computedStyle.top) || 0 }
      : undefined,
  };
};
