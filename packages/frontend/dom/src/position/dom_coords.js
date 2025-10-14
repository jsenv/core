import { getScrollContainer } from "../scroll/scroll_container.js";

const { documentElement } = document;

export const getDocumentCoords = (element) => {
  const { left, top, right, bottom, width, height } =
    element.getBoundingClientRect();
  const documentScrollLeft = documentElement.scrollLeft;
  const documentScrollTop = documentElement.scrollTop;
  const leftDocument = left + documentScrollLeft;
  const topDocument = top + documentScrollTop;
  const rightDocument = right + documentScrollLeft;
  const bottomDocument = bottom + documentScrollTop;

  return [
    leftDocument,
    topDocument,
    {
      right: rightDocument,
      bottom: bottomDocument,
      width,
      height,
    },
  ];
};

export const getViewportCoords = (element) => {
  const { left, top, right, bottom, width, height } =
    element.getBoundingClientRect();

  return [left, top, { right, bottom, width, height }];
};

export const getScrollCoords = (
  element,
  scrollContainer = getScrollContainer(element),
  { useOriginalPositionEvenIfSticky = false } = {},
) => {
  const [leftViewport, topViewport, { width, height }] =
    getViewportCoords(element);

  let fromFixed = false;
  let fromStickyLeft;
  let fromStickyTop;
  let fromStickyLeftAttr;
  let fromStickyTopAttr;
  const createScrollCoords = (leftScrollContainer, topScrollContainer) => {
    return [
      leftScrollContainer,
      topScrollContainer,
      {
        right: leftScrollContainer + width,
        bottom: topScrollContainer + height,
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
    const [leftScrollContainer, topScrollContainer] =
      viewportCoordsToScrollCoords(leftViewport, topViewport, scrollContainer);
    const isStickyLeft = computedStyle.left !== "auto";
    const isStickyTop = computedStyle.top !== "auto";
    fromStickyLeft = isStickyLeft
      ? { value: parseFloat(computedStyle.left) || 0 }
      : undefined;
    fromStickyTop = isStickyTop
      ? { value: parseFloat(computedStyle.top) || 0 }
      : undefined;
    return createScrollCoords(leftScrollContainer, topScrollContainer);
  }
  const usePositionFixed = computedStyle.position === "fixed";
  if (usePositionFixed) {
    fromFixed = true;
    // For position:fixed elements, get viewport coordinates and convert to scrollable-relative
    if (scrollContainerIsDocument) {
      const [leftScrollContainer, topScrollContainer] =
        viewportCoordsToScrollCoords(
          leftViewport,
          topViewport,
          documentElement,
        );
      return createScrollCoords(leftScrollContainer, topScrollContainer);
    }
    // For container scrolling, we need to convert relative to the container
    // Fixed elements are positioned relative to viewport, but we need coordinates
    // relative to the scrollable parent for constraint calculations
    const [scrollContainerLeftViewport, scrollContainerTopViewport] =
      getViewportCoords(scrollContainer);
    const leftScrollContainer = leftViewport - scrollContainerLeftViewport;
    const topScrollContainer = topViewport - scrollContainerTopViewport;
    return createScrollCoords(leftScrollContainer, topScrollContainer);
  }

  const hasStickyLeftAttribute = element.hasAttribute("data-sticky-left");
  const hasStickyTopAttribute = element.hasAttribute("data-sticky-top");
  const useStickyAttribute = hasStickyLeftAttribute || hasStickyTopAttribute;
  if (useStickyAttribute) {
    // Handle virtually sticky obstacles (<col> or <tr>) - elements with data-sticky attributes
    // but not CSS position:sticky. Calculate their position based on scroll and sticky behavior
    let [leftScrollContainer, topScrollContainer] =
      viewportCoordsToScrollCoords(leftViewport, topViewport, scrollContainer);
    if (hasStickyLeftAttribute) {
      const leftCssValue = parseFloat(computedStyle.left) || 0;
      fromStickyLeftAttr = { value: leftCssValue };

      const originalPosition = leftScrollContainer; // Natural position in scrollable coordinates

      if (useOriginalPositionEvenIfSticky) {
        // For obstacles: use original position only (ignore sticky behavior)
        leftScrollContainer = originalPosition;
      } else if (scrollContainerIsDocument) {
        // For frontiers with document scrolling: element sticks when scroll passes its natural position
        const scrollLeft = scrollContainer.scrollLeft;
        const stickyPosition = scrollLeft + leftCssValue;
        if (stickyPosition > originalPosition) {
          leftScrollContainer = stickyPosition; // Element is stuck
        } else {
          leftScrollContainer = originalPosition; // Element in natural position
        }
      } else {
        // For frontiers with container scrolling: element sticks relative to container scroll
        const scrollLeft = scrollContainer.scrollLeft;
        const stickyPosition = scrollLeft + leftCssValue;
        if (stickyPosition > originalPosition) {
          leftScrollContainer = stickyPosition; // Element is stuck
        } else {
          leftScrollContainer = originalPosition; // Element in natural position
        }
      }
    }
    if (hasStickyTopAttribute) {
      const topCssValue = parseFloat(computedStyle.top) || 0;
      fromStickyTopAttr = { value: topCssValue };

      const originalPosition = topScrollContainer; // Natural position in scrollable coordinates

      if (useOriginalPositionEvenIfSticky) {
        // For obstacles: use original position only (ignore sticky behavior)
        topScrollContainer = originalPosition;
      } else if (scrollContainerIsDocument) {
        // For frontiers with document scrolling: element sticks when scroll passes its natural position
        const scrollTop = scrollContainer.scrollTop;
        const stickyPosition = scrollTop + topCssValue;
        if (stickyPosition > originalPosition) {
          topScrollContainer = stickyPosition; // Element is stuck
        } else {
          topScrollContainer = originalPosition; // Element in natural position
        }
      } else {
        // For frontiers with container scrolling: element sticks relative to container scroll
        const scrollTop = scrollContainer.scrollTop;
        const stickyPosition = scrollTop + topCssValue;
        if (stickyPosition > originalPosition) {
          topScrollContainer = stickyPosition; // Element is stuck
        } else {
          topScrollContainer = originalPosition; // Element in natural position
        }
      }
    }
    return createScrollCoords(leftScrollContainer, topScrollContainer);
  }

  // For normal elements, use scrollable-relative coordinates
  const [leftScrollContainer, topScrollContainer] =
    viewportCoordsToScrollCoords(leftViewport, topViewport, scrollContainer);
  return createScrollCoords(leftScrollContainer, topScrollContainer);
};
const viewportCoordsToScrollCoords = (left, top, scrollContainer) => {
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
