import { getBorderSizes } from "../size/get_border_sizes.js";

/**
 * Get element bounds, handling both normal positioning and data-sticky-left|top
 * @param {HTMLElement} element - The element to get bounds for
 * @returns {Object} Bounds object with left, top, right, bottom properties
 */
export const getElementBounds = (
  element,
  {
    scrollableParent,
    useNonStickyLeftEvenIfStickyLeft = false,
    useNonStickyTopEvenIfStickyTop = false,
  } = {},
) => {
  const rect = element.getBoundingClientRect();
  const isHorizontallySticky = element.hasAttribute("data-sticky-left");
  const isVerticallySticky = element.hasAttribute("data-sticky-top");
  const useStickyAttribute = isHorizontallySticky || isVerticallySticky;
  if (!useStickyAttribute) {
    const { left, top, right, bottom } = rect;
    return { left, top, right, bottom };
  }
  const computedStyle = getComputedStyle(element);
  const hasPositionSticky = computedStyle.position === "sticky";
  if (hasPositionSticky) {
    const { left, top, right, bottom } = rect;
    return {
      sticky: true,
      left,
      top,
      right,
      bottom,
    };
  }

  // handle virtually sticky obstacles (<col> or <tr>)
  // are not really sticky but should be handled as such
  // For sticky elements, calculate current position based on scroll and sticky behavior
  // The sticky element "sticks" at its CSS left position relative to the scrollable parent
  let left;
  const parentRect = scrollableParent.getBoundingClientRect();
  const borderSizes = getBorderSizes(scrollableParent);
  if (isHorizontallySticky) {
    const stickyLeft = parseFloat(computedStyle.left) || 0;
    const stickyPositionInViewport =
      parentRect.left + borderSizes.left + stickyLeft;
    left = stickyPositionInViewport;
    if (useNonStickyLeftEvenIfStickyLeft) {
      const scrollLeft = scrollableParent.scrollLeft;
      left += scrollLeft;
    }
  } else {
    left = rect.left;
  }
  let top;
  if (isVerticallySticky) {
    const stickyTop = parseFloat(computedStyle.top) || 0;
    const stickyPositionInViewport =
      parentRect.top + borderSizes.top + stickyTop;
    top = stickyPositionInViewport;
    if (useNonStickyTopEvenIfStickyTop) {
      const scrollTop = scrollableParent.scrollTop;
      top += scrollTop;
    }
  } else {
    top = rect.top;
  }
  return {
    sticky: true,
    left,
    top,
    right: left + rect.width,
    bottom: top + rect.height,
  };
};
