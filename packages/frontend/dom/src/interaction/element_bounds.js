import { getBorderSizes } from "../size/get_border_sizes.js";

/**
 * Get element bounds, handling both normal positioning and data-sticky-left|top
 * @param {HTMLElement} element - The element to get bounds for
 * @returns {Object} Bounds object with left, top, right, bottom properties
 */
export const getElementBounds = (element, positionedParent) => {
  const rect = element.getBoundingClientRect();
  const isHorizontallySticky = element.hasAttribute("data-sticky-left");
  const isVerticallySticky = element.hasAttribute("data-sticky-top");
  const useStickyAttribute = isHorizontallySticky || isVerticallySticky;
  if (!useStickyAttribute) {
    return rect;
  }
  const computedStyle = getComputedStyle(element);
  const hasPositionSticky = computedStyle.position === "sticky";
  if (hasPositionSticky) {
    return {
      sticky: true,
      ...rect,
    };
  }

  // handle virtually sticky obstacles (<col> or <tr>)
  // are not really sticky but should be handled as such
  // For sticky elements, calculate current position based on scroll and sticky behavior
  // The sticky element "sticks" at its CSS left position relative to the scrollable parent
  let left;
  const parentRect = positionedParent.getBoundingClientRect();
  const borderSizes = getBorderSizes(positionedParent);
  if (isHorizontallySticky) {
    const stickyLeft = parseFloat(computedStyle.left) || 0;
    const stickyPositionInViewport =
      parentRect.left + borderSizes.left + stickyLeft;
    left = stickyPositionInViewport;
  } else {
    left = rect.left;
  }
  let top;
  if (isVerticallySticky) {
    const stickyTop = parseFloat(computedStyle.top) || 0;
    const stickyPositionInViewport =
      parentRect.top + borderSizes.top + stickyTop;
    top = stickyPositionInViewport;
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
