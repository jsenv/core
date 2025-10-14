import { getScrollContainer } from "../scroll/scroll_container.js";

export const getViewportCoords = (element) => {
  const { left, top, right, bottom, width, height } =
    element.getBoundingClientRect();
  return [left, top, { right, bottom, width, height }];
};

export const getDocumentCoords = (element) => {
  const { left, top, right, bottom, width, height } =
    element.getBoundingClientRect();
  const documentScrollLeft = document.documentElement.scrollLeft;
  const documentScrollTop = document.documentElement.scrollTop;
  const documentLeft = left + documentScrollLeft;
  const documentTop = top + documentScrollTop;
  const documentRight = right + documentScrollLeft;
  const documentBottom = bottom + documentScrollTop;

  return [
    documentLeft,
    documentTop,
    {
      right: documentRight,
      bottom: documentBottom,
      width,
      height,
    },
  ];
};

const { documentElement } = document;
export const getScrollCoords = (
  element,
  scrollContainer = getScrollContainer(element),
  { useOriginalPositionEvenIfSticky = false } = {},
) => {
  const { left, top, width, height } = element.getBoundingClientRect();
  let fromFixed = false;
  let fromStickyLeft;
  let fromStickyTop;
  let fromStickyLeftAttr;
  let fromStickyTopAttr;
  const createScrollCoords = (leftScrollable, topScrollable) => {
    return [
      leftScrollable,
      topScrollable,
      {
        right: leftScrollable + width,
        bottom: topScrollable + height,
        width,
        height,
        fromFixed,
        fromStickyLeft,
        fromStickyTop,
        fromStickyLeftAttr,
        fromStickyTopAttr,
      },
    ];
  };

  const computedStyle = getComputedStyle(element);
  const usePositionSticky = computedStyle.position === "sticky";
  const scrollContainerIsDocument = scrollContainer === documentElement;
  if (usePositionSticky) {
    // For CSS position:sticky elements, use scrollable-relative coordinates
    const [leftScrollable, topScrollable] = viewportCoordsToScrollableCoords(
      left,
      top,
      scrollContainer,
    );
    const isStickyLeft = computedStyle.left !== "auto";
    const isStickyTop = computedStyle.top !== "auto";
    fromStickyLeft = isStickyLeft
      ? { value: parseFloat(computedStyle.left) || 0 }
      : undefined;
    fromStickyTop = isStickyTop
      ? { value: parseFloat(computedStyle.top) || 0 }
      : undefined;
    return createScrollCoords(leftScrollable, topScrollable);
  }
  const usePositionFixed = computedStyle.position === "fixed";
  if (usePositionFixed) {
    fromFixed = true;
    // For position:fixed elements, get viewport coordinates and convert to scrollable-relative
    if (scrollContainerIsDocument) {
      const [leftScrollable, topScrollable] = viewportCoordsToScrollableCoords(
        left,
        top,
        document.documentElement,
      );
      return createScrollCoords(leftScrollable, topScrollable);
    }
    // For container scrolling, we need to convert relative to the container
    // Fixed elements are positioned relative to viewport, but we need coordinates
    // relative to the scrollable parent for constraint calculations
    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const leftScrollable = left - scrollContainerRect.left;
    const topScrollable = top - scrollContainerRect.top;
    return createScrollCoords(leftScrollable, topScrollable);
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
      scrollContainer,
    );
    if (hasStickyLeftAttribute) {
      const leftCssValue = parseFloat(computedStyle.left) || 0;
      fromStickyLeftAttr = { value: leftCssValue };

      const originalPosition = leftScrollable; // Natural position in scrollable coordinates

      if (useOriginalPositionEvenIfSticky) {
        // For obstacles: use original position only (ignore sticky behavior)
        leftScrollable = originalPosition;
      } else if (scrollContainerIsDocument) {
        // For frontiers with document scrolling: element sticks when scroll passes its natural position
        const scrollLeft = scrollContainer.scrollLeft;
        const stickyPosition = scrollLeft + leftCssValue;
        if (stickyPosition > originalPosition) {
          leftScrollable = stickyPosition; // Element is stuck
        } else {
          leftScrollable = originalPosition; // Element in natural position
        }
      } else {
        // For frontiers with container scrolling: element sticks relative to container scroll
        const scrollLeft = scrollContainer.scrollLeft;
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
      } else if (scrollContainerIsDocument) {
        // For frontiers with document scrolling: element sticks when scroll passes its natural position
        const scrollTop = scrollContainer.scrollTop;
        const stickyPosition = scrollTop + topCssValue;
        if (stickyPosition > originalPosition) {
          topScrollable = stickyPosition; // Element is stuck
        } else {
          topScrollable = originalPosition; // Element in natural position
        }
      } else {
        // For frontiers with container scrolling: element sticks relative to container scroll
        const scrollTop = scrollContainer.scrollTop;
        const stickyPosition = scrollTop + topCssValue;
        if (stickyPosition > originalPosition) {
          topScrollable = stickyPosition; // Element is stuck
        } else {
          topScrollable = originalPosition; // Element in natural position
        }
      }
    }
    return createScrollCoords(leftScrollable, topScrollable);
  }

  // For normal elements, use scrollable-relative coordinates
  const [leftScrollable, topScrollable] = viewportCoordsToScrollableCoords(
    left,
    top,
    scrollContainer,
  );
  return createScrollCoords(leftScrollable, topScrollable);
};
const viewportCoordsToScrollableCoords = (left, top, scrollContainer) => {
  const scrollContainerIsDocument = scrollContainer === documentElement;
  const { scrollLeft, scrollTop } = scrollContainer;
  if (scrollContainerIsDocument) {
    // For document scrolling: convert to document coordinates
    return [left + scrollLeft, top + scrollTop];
  }
  // For container scrolling: convert to container-relative coordinates
  const scrollableRect = scrollContainer.getBoundingClientRect();
  return [
    left - scrollableRect.left + scrollLeft,
    top - scrollableRect.top + scrollTop,
  ];
};
