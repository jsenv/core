/**
 * X-Axis Coordinate Systems in Web Development
 *
 * Diagram showing horizontal positioning and scrollbars:
 *
 * VIEWPORT (visible part of the document)
 * ┌───────────────────────────────────────────────┐
 * │                                               │
 * │                                               │
 * │ container.offsetLeft: 20px                    │
 * │       ┼─────────────────────────────┐         │
 * │       │                             │         │
 * │       │                             │         │
 * │       │  el.offsetLeft: 100px       │         │
 * │       │         ┼─────┐             │         │
 * │       │         │     │             │         │
 * │       │         └─────┘             │         │
 * │       │                             │         │
 * │       │ ░░░███░░░░░░░░░░░░░░░░░░░░░ │         │
 * │       └─────│───────────────────────┘         │
 * │ container.scrollLeft: 50px                    │
 * │                                               │
 * │                                               │
 * │ ░░░░░░░███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
 * └─────────│─────────────────────────────────────┘
 *   document.scrollLeft: 200px
 *
 *
 * Left coordinate for the element:
 *
 * Document coordinates (absolute position in full document)
 * • Result: 320px
 * • Detail: container.offsetLeft + element.offsetLeft + document.scrollLeft
 *           20                +  100              + 200               = 320px
 *
 * Viewport coordinates (getBoundingClientRect().left):
 * • Result: 120px
 * • Detail: container.offsetLeft + element.offsetLeft
 *           20                +  100              = 120px
 *
 * Scroll coordinates (position within scroll container):
 * • Result: 50px
 * • Detail: element.offsetLeft - container.scrollLeft
 *           100              - 50                 = 50px
 *
 * Scroll behavior examples:
 *
 * When document scrolls (scrollLeft: 200px → 300px):
 * • Document coordinates: 320px → 420px
 * • Viewport coordinates: 120px → 120px (unchanged)
 * • Scroll coordinates: 50px → 50px (unchanged)
 *
 * When container scrolls (scrollLeft: 50px → 100px):
 * • Document coordinates: 320px → 270px
 * • Viewport coordinates: 120px → 70px
 * • Scroll coordinates: 50px → 0px
 */

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
    const [leftScrollContainer, topScrollContainer] = viewportPosToScrollPos(
      leftViewport,
      topViewport,
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
    return createScrollCoords(leftScrollContainer, topScrollContainer);
  }
  const usePositionFixed = computedStyle.position === "fixed";
  if (usePositionFixed) {
    fromFixed = true;
    // For position:fixed elements, get viewport coordinates and convert to scrollable-relative
    if (scrollContainerIsDocument) {
      const [leftScrollContainer, topScrollContainer] = viewportPosToScrollPos(
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
    let [leftScrollContainer, topScrollContainer] = viewportPosToScrollPos(
      leftViewport,
      topViewport,
      scrollContainer,
    );
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
  const [leftScrollContainer, topScrollContainer] = viewportPosToScrollPos(
    leftViewport,
    topViewport,
    scrollContainer,
  );
  return createScrollCoords(leftScrollContainer, topScrollContainer);
};
const viewportPosToScrollPos = (leftViewport, topViewport, scrollContainer) => {
  const scrollContainerIsDocument = scrollContainer === documentElement;
  const { scrollLeft, scrollTop } = scrollContainer;
  if (scrollContainerIsDocument) {
    return [leftViewport + scrollLeft, topViewport + scrollTop];
  }
  const { left: scrollContainerLeftViewport, top: scrollContainerTopViewport } =
    scrollContainer.getBoundingClientRect();
  return [
    leftViewport - scrollContainerLeftViewport + scrollLeft,
    topViewport - scrollContainerTopViewport + scrollTop,
  ];
};

export const getMouseEventScrollCoords = (mouseEvent, scrollContainer) => {
  const [mouseLeftScrollContainer, mouseTopScrollContainer] =
    viewportPosToScrollPos(
      mouseEvent.clientX,
      mouseEvent.clientY,
      scrollContainer,
    );
  return [
    mouseLeftScrollContainer,
    mouseTopScrollContainer,
    {
      width: 1,
      height: 1,
      right: mouseLeftScrollContainer + 1,
      bottom: mouseTopScrollContainer + 1,
    },
  ];
};

export const getElementStickyPos = (
  element,
  scrollContainer,
  { isStickyLeft, isStickyTop },
) => {
  const elementRect = element.getBoundingClientRect();
  const scrollContainerRect = scrollContainer.getBoundingClientRect();
  const leftRelative = elementRect.left - scrollContainerRect.left;
  const topRelative = elementRect.top - scrollContainerRect.top;
  const scrollContainerIsDocument = scrollContainer === documentElement;

  let leftSticky = leftRelative;
  let topSticky = topRelative;
  if (isStickyLeft && !scrollContainerIsDocument) {
    leftSticky -= scrollContainer.scrollLeft;
  }
  if (isStickyTop && !scrollContainerIsDocument) {
    topSticky -= scrollContainer.scrollTop;
  }
  return [leftSticky, topSticky];
};
export const getElementFixedPos = (element) => {
  const rect = element.getBoundingClientRect();
  // getBoundingClientRect already gives viewport coordinates, which is what fixed positioning uses
  return [rect.left, rect.top];
};
export const convertScrollPosToElementPos = (
  leftScrollContainer,
  topScrollContainer,
  element,
  scrollContainer = getScrollContainer(element),
) => {
  const offsetParent = element.offsetParent || documentElement;
  const positionedParent =
    offsetParent === document.body ? documentElement : offsetParent;
  const scrollContainerIsDocument = scrollContainer === documentElement;
  const positionedParentIsDocument = positionedParent === documentElement;

  if (scrollContainerIsDocument && positionedParentIsDocument) {
    // Both scroll container and positioned parent are document
    // Convert from document coordinates to viewport coordinates
    const documentScrollLeft = documentElement.scrollLeft;
    const documentScrollTop = documentElement.scrollTop;
    return [
      leftScrollContainer - documentScrollLeft,
      topScrollContainer - documentScrollTop,
    ];
  }

  if (scrollContainerIsDocument && !positionedParentIsDocument) {
    // Scroll container is document, but element is positioned relative to a parent
    const positionedParentRect = positionedParent.getBoundingClientRect();
    const documentScrollLeft = documentElement.scrollLeft;
    const documentScrollTop = documentElement.scrollTop;
    // Convert from document coordinates to positioned parent coordinates
    const positionedParentDocumentLeft =
      positionedParentRect.left + documentScrollLeft;
    const positionedParentDocumentTop =
      positionedParentRect.top + documentScrollTop;
    return [
      leftScrollContainer - positionedParentDocumentLeft,
      topScrollContainer - positionedParentDocumentTop,
    ];
  }

  if (!scrollContainerIsDocument && positionedParentIsDocument) {
    // Scroll container is not document, but element is positioned relative to document
    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const documentScrollLeft = documentElement.scrollLeft;
    const documentScrollTop = documentElement.scrollTop;
    // Convert from container coordinates to document coordinates, then to viewport
    const elementDocumentLeft =
      leftScrollContainer +
      scrollContainerRect.left +
      documentScrollLeft -
      scrollContainer.scrollLeft;
    const elementDocumentTop =
      topScrollContainer +
      scrollContainerRect.top +
      documentScrollTop -
      scrollContainer.scrollTop;
    return [
      elementDocumentLeft - documentScrollLeft,
      elementDocumentTop - documentScrollTop,
    ];
  }

  // Both scroll container and positioned parent are the same container
  if (scrollContainer === positionedParent) {
    // Element is positioned relative to its scroll container
    return [
      leftScrollContainer - scrollContainer.scrollLeft,
      topScrollContainer - scrollContainer.scrollTop,
    ];
  }

  // General case: different scroll container and positioned parent
  const scrollContainerRect = scrollContainer.getBoundingClientRect();
  const positionedParentRect = positionedParent.getBoundingClientRect();
  const documentScrollLeft = documentElement.scrollLeft;
  const documentScrollTop = documentElement.scrollTop;

  // Convert scroll container coordinates to document coordinates
  const elementDocumentLeft =
    leftScrollContainer +
    scrollContainerRect.left +
    documentScrollLeft -
    scrollContainer.scrollLeft;
  const elementDocumentTop =
    topScrollContainer +
    scrollContainerRect.top +
    documentScrollTop -
    scrollContainer.scrollTop;

  // Convert document coordinates to positioned parent coordinates
  const positionedParentDocumentLeft =
    positionedParentRect.left + documentScrollLeft;
  const positionedParentDocumentTop =
    positionedParentRect.top + documentScrollTop;

  return [
    elementDocumentLeft - positionedParentDocumentLeft,
    elementDocumentTop - positionedParentDocumentTop,
  ];
};
