/**
 * DOM Coordinate Systems: The Missing APIs Problem
 *
 * When positioning and moving DOM elements, we commonly need coordinate information.
 * The web platform provides getBoundingClientRect() which gives viewport-relative coordinates,
 * but this creates several challenges when working with scrollable containers:
 *
 * ## The Problem
 *
 * 1. **Basic positioning**: getBoundingClientRect() works great for viewport-relative positioning
 * 2. **Document scrolling**: When document has scroll, we add document.scrollLeft/scrollTop
 * 3. **Scroll containers**: When elements are inside scrollable containers, we need coordinates
 *    relative to that container, not the document
 *
 * ## Missing Browser APIs
 *
 * The web platform lacks essential APIs for scroll container workflows:
 * - No equivalent of getBoundingClientRect() relative to scroll container
 * - No built-in way to get element coordinates in scroll container space
 * - Manual coordinate conversion is error-prone and inconsistent
 *
 * ## This Module's Solution
 *
 * This module provides the missing coordinate APIs that work seamlessly with scroll containers:
 * - **getScrollRelativeRect()**: element rect relative to scroll container (PRIMARY API)
 * - **getMouseEventScrollRelativeRect()**: Mouse coordinates in scroll container space
 * - **convertScrollRelativeRectInto()**: Convert scroll-relative rect to element positioning coordinates
 *
 * These APIs abstract away the complexity of coordinate system conversion and provide
 * a consistent interface for element positioning regardless of scroll container depth.
 *
 * ## Primary API: getScrollRelativeRect()
 *
 * This is the main API you want - element rectangle relative to scroll container:
 *
 * ```js
 * const rect = element.getBoundingClientRect(); // viewport-relative
 * const scrollRect = getScrollRelativeRect(element, scrollContainer); // scroll-relative
 * ```
 *
 * Returns: { left, top, right, bottom, width, height, scrollLeft, scrollTop, scrollContainer, ...metadata }
 *
 * The scroll values are included so you can calculate scroll-absolute coordinates yourself:
 * ```js
 * const { left, top, scrollLeft, scrollTop } = getScrollRelativeRect(element);
 * const scrollAbsoluteLeft = left + scrollLeft;
 * const scrollAbsoluteTop = top + scrollTop;
 * ```
 *
 * ## Secondary APIs:
 *
 * - **getMouseEventScrollRelativeRect()**: Get mouse coordinates as a rect in scroll container space
 * - **convertScrollRelativeRectInto()**: Convert from scroll-relative coordinates to element positioning coordinates (for setting element.style.left/top)
 *
 * ## Coordinate System Terminology:
 *
 * - **Viewport-relative**: getBoundingClientRect() coordinates - relative to browser viewport
 * - **Scroll-relative**: Coordinates relative to scroll container (ignoring current scroll position)
 * - **Scroll-absolute**: Scroll-relative + scroll position (element's position in full scrollable content)
 * - **Element coordinates**: Coordinates for positioning elements (via element.style.left/top)
 *
 * ## Legacy Coordinate System Diagrams
 *
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
import { getBorderSizes } from "../size/get_border_sizes.js";

const { documentElement } = document;

/**
 * Get element rectangle relative to its scroll container
 *
 * @param {Element} element - The element to get coordinates for
 * @param {Element} [scrollContainer] - Optional scroll container (auto-detected if not provided)
 * @param {object} [options] - Configuration options
 * @returns {object} { left, top, right, bottom, width, height, scrollLeft, scrollTop, scrollContainer, ...metadata }
 */
export const getScrollRelativeRect = (
  element,
  scrollContainer = getScrollContainer(element),
  { useOriginalPositionEvenIfSticky = false } = {},
) => {
  const {
    left: leftViewport,
    top: topViewport,
    width,
    height,
  } = element.getBoundingClientRect();

  let fromFixed = false;
  let fromStickyLeft;
  let fromStickyTop;
  let fromStickyLeftAttr;
  let fromStickyTopAttr;
  const scrollLeft = scrollContainer.scrollLeft;
  const scrollTop = scrollContainer.scrollTop;
  const scrollContainerIsDocument = scrollContainer === documentElement;
  const createScrollRelativeRect = (leftScrollRelative, topScrollRelative) => {
    const isStickyLeftOrHasStickyLeftAttr = Boolean(
      fromStickyLeft || fromStickyLeftAttr,
    );
    const isStickyTopOrHasStickyTopAttr = Boolean(
      fromStickyTop || fromStickyTopAttr,
    );
    return {
      left: leftScrollRelative,
      top: topScrollRelative,
      right: leftScrollRelative + width,
      bottom: topScrollRelative + height,

      // metadata
      width,
      height,
      scrollContainer,
      scrollContainerIsDocument,
      scrollLeft,
      scrollTop,
      fromFixed,
      fromStickyLeft,
      fromStickyTop,
      fromStickyLeftAttr,
      fromStickyTopAttr,
      isStickyLeftOrHasStickyLeftAttr,
      isStickyTopOrHasStickyTopAttr,
      isSticky:
        isStickyLeftOrHasStickyLeftAttr || isStickyTopOrHasStickyTopAttr,
    };
  };

  sticky: {
    const computedStyle = getComputedStyle(element);
    sticky_position: {
      const usePositionSticky = computedStyle.position === "sticky";
      if (usePositionSticky) {
        // For CSS position:sticky elements, use scrollable-relative coordinates
        const [leftScrollRelative, topScrollRelative] =
          viewportPosToScrollRelativePos(
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
        return createScrollRelativeRect(leftScrollRelative, topScrollRelative);
      }
    }
    sticky_attribute: {
      const hasStickyLeftAttribute = element.hasAttribute("data-sticky-left");
      const hasStickyTopAttribute = element.hasAttribute("data-sticky-top");
      const useStickyAttribute =
        hasStickyLeftAttribute || hasStickyTopAttribute;
      if (useStickyAttribute) {
        // Handle virtually sticky obstacles (<col> or <tr>) - elements with data-sticky attributes
        // but not CSS position:sticky. Calculate their position based on scroll and sticky behavior
        let [leftScrollRelative, topScrollRelative] =
          viewportPosToScrollRelativePos(
            leftViewport,
            topViewport,
            scrollContainer,
          );
        if (hasStickyLeftAttribute) {
          const leftCssValue = parseFloat(computedStyle.left) || 0;
          fromStickyLeftAttr = { value: leftCssValue };
          if (useOriginalPositionEvenIfSticky) {
            // For obstacles: use original position only (ignore sticky behavior)
          } else {
            const scrollLeft = scrollContainer.scrollLeft;
            const stickyPosition = scrollLeft + leftCssValue;
            const leftWithScroll = leftScrollRelative + scrollLeft;
            if (stickyPosition > leftWithScroll) {
              leftScrollRelative = leftCssValue; // Element is stuck
            } else {
              // Element in natural position
            }
          }
        }
        if (hasStickyTopAttribute) {
          const topCssValue = parseFloat(computedStyle.top) || 0;
          fromStickyTopAttr = { value: topCssValue };
          if (useOriginalPositionEvenIfSticky) {
            // For obstacles: use original position only (ignore sticky behavior)
          } else {
            const scrollTop = scrollContainer.scrollTop;
            const stickyPosition = scrollTop + topCssValue;
            const topWithScroll = topScrollRelative + scrollTop;
            if (stickyPosition > topWithScroll) {
              topScrollRelative = topCssValue; // Element is stuck
            } else {
              // Element in natural position
            }
          }
        }
        return createScrollRelativeRect(leftScrollRelative, topScrollRelative);
      }
    }
  }

  // For normal elements, use scrollable-relative coordinates
  const [leftScrollRelative, topScrollRelative] =
    viewportPosToScrollRelativePos(leftViewport, topViewport, scrollContainer);
  return createScrollRelativeRect(leftScrollRelative, topScrollRelative);
};
const viewportPosToScrollRelativePos = (
  leftViewport,
  topViewport,
  scrollContainer,
) => {
  const scrollContainerIsDocument = scrollContainer === documentElement;
  if (scrollContainerIsDocument) {
    return [leftViewport, topViewport];
  }
  const { left: scrollContainerLeftViewport, top: scrollContainerTopViewport } =
    scrollContainer.getBoundingClientRect();
  return [
    leftViewport - scrollContainerLeftViewport,
    topViewport - scrollContainerTopViewport,
  ];
};

export const getMouseEventScrollRelativeRect = (
  mouseEvent,
  scrollContainer,
) => {
  const [mouseLeftScrollRelative, mouseTopScrollRelative] =
    viewportPosToScrollRelativePos(
      mouseEvent.clientX,
      mouseEvent.clientY,
      scrollContainer,
    );
  return {
    left: mouseLeftScrollRelative,
    top: mouseTopScrollRelative,
    right: mouseLeftScrollRelative,
    bottom: mouseTopScrollRelative,
    width: 0,
    height: 0,
  };
};

export const addScrollToRect = (scrollRelativeRect) => {
  const { left, top, width, height, scrollLeft, scrollTop } =
    scrollRelativeRect;
  const leftWithScroll = left + scrollLeft;
  const topWithScroll = top + scrollTop;
  return {
    ...scrollRelativeRect,
    left: leftWithScroll,
    top: topWithScroll,
    right: leftWithScroll + width,
    bottom: topWithScroll + height,
  };
};

export const convertScrollRelativeRectInto = (
  scrollRelativeRect,
  targetScrollContainer = documentElement,
) => {
  const {
    left: leftScrollRelative,
    top: topScrollRelative,
    width,
    height,
    scrollContainer: sourceScrollContainer,
  } = scrollRelativeRect;

  const createScrollRelativeRect = (left, top) => {
    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      scrollContainer: targetScrollContainer,
      scrollLeft: targetScrollContainer.scrollLeft,
      scrollTop: targetScrollContainer.scrollTop,
    };
  };

  // Same scroll container - no conversion needed
  if (sourceScrollContainer === targetScrollContainer) {
    return createScrollRelativeRect(leftScrollRelative, topScrollRelative);
  }

  // Convert from source scroll container to target scroll container
  // Strategy: source -> document -> target

  // Step 1: Convert from source to document coordinates
  let leftDocument;
  let topDocument;
  if (sourceScrollContainer === documentElement) {
    leftDocument = leftScrollRelative;
    topDocument = topScrollRelative;
  } else {
    const sourceScrollContainerRect = getScrollRelativeRect(
      sourceScrollContainer,
      documentElement,
    );
    leftDocument = leftScrollRelative + sourceScrollContainerRect.left;
    topDocument = topScrollRelative + sourceScrollContainerRect.top;
  }

  // Step 2: Convert from document to target coordinates
  let leftTarget;
  let topTarget;
  if (targetScrollContainer === documentElement) {
    leftTarget = leftDocument;
    topTarget = topDocument;
  } else {
    const targetScrollContainerRect = getScrollRelativeRect(
      targetScrollContainer,
      documentElement,
    );
    leftTarget = leftDocument - targetScrollContainerRect.left;
    topTarget = topDocument - targetScrollContainerRect.top;
  }

  return createScrollRelativeRect(leftTarget, topTarget);
};

export const getScrollContainerOffset = (element) => {
  const scrollContainer = getScrollContainer(element);
  const offsetParent = element.offsetParent || documentElement;
  const positionedParent =
    offsetParent === document.body ? documentElement : offsetParent;
  const positionedParentRect = positionedParent.getBoundingClientRect();
  const scrollContainerRect = scrollContainer.getBoundingClientRect();
  if (positionedParent.contains(scrollContainer)) {
    return [
      scrollContainerRect.left -
        positionedParentRect.left -
        scrollContainer.scrollLeft,

      scrollContainerRect.top -
        positionedParentRect.top -
        scrollContainer.scrollTop,
    ];
  }

  const positionedLeft = positionedParentRect.left + documentElement.scrollLeft;
  const positionedTop = positionedParentRect.top + documentElement.scrollTop;
  const scrollContainerLeft =
    scrollContainerRect.left + documentElement.scrollLeft;
  const scrollContainerTop =
    scrollContainerRect.top + documentElement.scrollTop;
  return [
    positionedLeft - scrollContainerLeft,
    positionedTop - scrollContainerTop,
  ];
};

export const convertScrollRelativeRectToElementRect = (
  scrollRelativeRect,
  element,
) => {
  const {
    left: leftScrollRelative,
    top: topScrollRelative,
    width,
    height,
    scrollContainer,
    scrollContainerIsDocument,
    fromFixed,
    fromStickyLeft,
    fromStickyTop,
    fromStickyLeftAttr,
    fromStickyTopAttr,
  } = scrollRelativeRect;

  const createElementRect = (left, top) => {
    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
    };
  };

  // Handle fixed positioning
  if (fromFixed) {
    return createElementRect(leftScrollRelative, topScrollRelative);
  }

  // Auto-detect if not explicitly provided
  const isStickyLeft = Boolean(fromStickyLeft || fromStickyLeftAttr);
  const isStickyTop = Boolean(fromStickyTop || fromStickyTopAttr);
  if (isStickyLeft || isStickyTop) {
    let elementLeftRelative = leftScrollRelative;
    let elementTopRelative = topScrollRelative;

    if (isStickyLeft) {
      const stickyLeft = fromStickyLeft
        ? fromStickyLeft.value
        : fromStickyLeftAttr.value;
      const naturalPosition = leftScrollRelative;
      const stickyPosition = stickyLeft;
      if (naturalPosition < stickyPosition) {
        elementLeftRelative = stickyPosition;
      } else {
        elementLeftRelative = naturalPosition;
      }
    }

    if (isStickyTop) {
      const stickyTop = fromStickyTop
        ? fromStickyTop.value
        : fromStickyTopAttr.value;
      const naturalPosition = topScrollRelative;
      const stickyPosition = stickyTop;
      if (naturalPosition < stickyPosition) {
        elementTopRelative = stickyPosition;
      } else {
        elementTopRelative = naturalPosition;
      }
    }

    return createElementRect(elementLeftRelative, elementTopRelative);
  }

  // Handle normal positioning
  const offsetParent = element.offsetParent || documentElement;
  const positionedParent =
    offsetParent === document.body ? documentElement : offsetParent;
  const positionedParentIsDocument = positionedParent === documentElement;

  if (scrollContainerIsDocument && positionedParentIsDocument) {
    return createElementRect(leftScrollRelative, topScrollRelative);
  }

  if (scrollContainerIsDocument && !positionedParentIsDocument) {
    // Scroll container is document, but element is positioned relative to a parent
    // Convert positioned parent to document-relative coordinates
    const positionedParentScrollRelativeRect = getScrollRelativeRect(
      positionedParent,
      documentElement,
    );
    const elementLeftRelative =
      leftScrollRelative - positionedParentScrollRelativeRect.left;
    const elementTopRelative =
      topScrollRelative - positionedParentScrollRelativeRect.top;
    return createElementRect(elementLeftRelative, elementTopRelative);
  }

  if (!scrollContainerIsDocument && positionedParentIsDocument) {
    // Scroll container is not document, but element is positioned relative to document
    // Convert scroll container position to document-relative coordinates
    const scrollContainerScrollRelativeRect = getScrollRelativeRect(
      scrollContainer,
      documentElement,
    );
    const elementLeftRelative =
      leftScrollRelative + scrollContainerScrollRelativeRect.left;
    const elementTopRelative =
      topScrollRelative + scrollContainerScrollRelativeRect.top;
    return createElementRect(elementLeftRelative, elementTopRelative);
  }

  // Both scroll container and positioned parent are the same container
  if (scrollContainer === positionedParent) {
    return createElementRect(leftScrollRelative, topScrollRelative);
  }

  // General case: different scroll container and positioned parent
  // Convert both scroll container and positioned parent to document-relative coordinates
  const scrollContainerScrollRelativeRect = getScrollRelativeRect(
    scrollContainer,
    documentElement,
  );
  const positionedParentScrollRelativeRect = getScrollRelativeRect(
    positionedParent,
    documentElement,
  );

  // Element position in document coordinates
  const elementLeftDocument =
    leftScrollRelative + scrollContainerScrollRelativeRect.left;
  const elementTopDocument =
    topScrollRelative + scrollContainerScrollRelativeRect.top;

  // Convert to positioned parent relative coordinates
  const elementLeftRelative =
    elementLeftDocument - positionedParentScrollRelativeRect.left;
  const elementTopRelative =
    elementTopDocument - positionedParentScrollRelativeRect.top;

  return createElementRect(elementLeftRelative, elementTopRelative);
};

// https://github.com/w3c/csswg-drafts/issues/3329
// Return the portion of the element that is visible for this scoll container
export const getScrollBox = (scrollContainer) => {
  if (scrollContainer === documentElement) {
    const { clientWidth, clientHeight } = documentElement;

    return {
      left: 0,
      top: 0,
      right: clientWidth,
      bottom: clientHeight,
      width: clientWidth,
      height: clientHeight,
    };
  }

  const { clientWidth, clientHeight } = scrollContainer;
  const scrollContainerBorderSizes = getBorderSizes(scrollContainer);
  const leftWithBorder = scrollContainerBorderSizes.left;
  const topWithBorder = scrollContainerBorderSizes.top;
  const availableWidth = clientWidth;
  const availableHeight = clientHeight;
  const right = leftWithBorder + availableWidth;
  const bottom = topWithBorder + availableHeight;
  return {
    left: leftWithBorder,
    top: topWithBorder,
    right,
    bottom,
    width: availableWidth,
    height: availableHeight,
  };
};
export const getScrollContainerVisibleArea = (scrollContainer) => {
  const { left, top, width, height } = getScrollBox(scrollContainer);
  const leftWithScroll = left + scrollContainer.scrollLeft;
  const topWithScroll = top + scrollContainer.scrollTop;
  const rightWithScroll = leftWithScroll + width;
  const bottomWithScroll = topWithScroll + height;
  return {
    left: leftWithScroll,
    top: topWithScroll,
    right: rightWithScroll,
    bottom: bottomWithScroll,
  };
};
