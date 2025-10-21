import { findSelfOrAncestorFixedPosition } from "../position/position_fixed.js";
import { getScrollContainer } from "../scroll/scroll_container.js";

/**
 * Creates a coordinate system positioner for drag operations.
 *
 * ARCHITECTURE:
 * This function uses a modular offset-based approach to handle coordinate system conversions
 * between different positioning contexts (scroll containers and positioned parents).
 *
 * The system decomposes coordinate conversion into two types of offsets:
 * 1. Position offsets - compensate for different positioned parents
 * 2. Scroll offsets - handle scroll position and container differences
 *
 * COORDINATE SYSTEM:
 * - Input coordinates are relative to the reference element's scroll container
 * - Output coordinates are relative to the element's positioned parent for DOM positioning
 * - Handles cross-coordinate system scenarios (different scroll containers and positioned parents)
 *
 * KEY SCENARIOS SUPPORTED:
 * 1. Same positioned parent, same scroll container - Simple case, minimal offsets
 * 2. Different positioned parents, same scroll container - Position offset compensation
 * 3. Same positioned parent, different scroll containers - Scroll offset handling
 * 4. Different positioned parents, different scroll containers - Full offset compensation
 * 5. Overlay elements - Special handling for elements with data-overlay-for attribute
 * 6. Fixed positioning - Special scroll offset handling for fixed positioned elements
 *
 * API CONTRACT:
 * Returns [scrollableLeft, scrollableTop, convertScrollablePosition] where:
 *
 * - scrollableLeft/scrollableTop:
 *   Current element coordinates in the reference coordinate system (adjusted for position offsets)
 *
 * - convertScrollablePosition:
 *   Converts reference coordinate system positions to DOM positioning coordinates
 *   Applies both position and scroll offsets for accurate element placement
 *
 * IMPLEMENTATION STRATEGY:
 * Uses factory functions to create specialized offset calculators based on the specific
 * combination of positioning contexts, optimizing for performance and code clarity.
 */

export const createDragElementPositioner = (
  element,
  referenceElement,
  elementToMove,
) => {
  let scrollableLeft;
  let scrollableTop;
  let convertScrollablePosition;

  const positionedParent = elementToMove
    ? elementToMove.offsetParent
    : element.offsetParent;
  const scrollContainer = getScrollContainer(element);
  const [getPositionOffsets, getScrollOffsets] = createGetOffsets({
    positionedParent,
    referencePositionedParent: referenceElement
      ? referenceElement.offsetParent
      : undefined,
    scrollContainer,
    referenceScrollContainer: referenceElement
      ? getScrollContainer(referenceElement)
      : undefined,
  });

  scrollable_current: {
    [scrollableLeft, scrollableTop] = getScrollablePosition(
      element,
      scrollContainer,
    );
    const [positionOffsetLeft, positionOffsetTop] = getPositionOffsets();
    scrollableLeft += positionOffsetLeft;
    scrollableTop += positionOffsetTop;
  }
  scrollable_converter: {
    convertScrollablePosition = (
      scrollableLeftToConvert,
      scrollableTopToConvert,
    ) => {
      const [positionOffsetLeft, positionOffsetTop] = getPositionOffsets();
      const [scrollOffsetLeft, scrollOffsetTop] = getScrollOffsets();

      const positionedLeftWithoutScroll =
        scrollableLeftToConvert + positionOffsetLeft;
      const positionedTopWithoutScroll =
        scrollableTopToConvert + positionOffsetTop;
      const positionedLeft = positionedLeftWithoutScroll + scrollOffsetLeft;
      const positionedTop = positionedTopWithoutScroll + scrollOffsetTop;

      return [positionedLeft, positionedTop];
    };
  }
  return [scrollableLeft, scrollableTop, convertScrollablePosition];
};

const getScrollablePosition = (element, scrollContainer) => {
  const { left: elementViewportLeft, top: elementViewportTop } =
    element.getBoundingClientRect();
  const scrollContainerIsDocument = scrollContainer === documentElement;
  if (scrollContainerIsDocument) {
    return [elementViewportLeft, elementViewportTop];
  }
  const { left: scrollContainerLeft, top: scrollContainerTop } =
    scrollContainer.getBoundingClientRect();
  const scrollableLeft = elementViewportLeft - scrollContainerLeft;
  const scrollableTop = elementViewportTop - scrollContainerTop;

  return [scrollableLeft, scrollableTop];
};

const createGetOffsets = ({
  positionedParent,
  referencePositionedParent = positionedParent,
  scrollContainer,
  referenceScrollContainer = scrollContainer,
}) => {
  const samePositionedParent = positionedParent === referencePositionedParent;
  const getScrollOffsets = createGetScrollOffsets(
    scrollContainer,
    referenceScrollContainer,
    positionedParent,
  );

  if (samePositionedParent) {
    return [() => [0, 0], getScrollOffsets];
  }

  // parents are different, oh boy let's go
  // The overlay case is problematic because the overlay adjust its position to the target dynamically
  // This creates something complex to support properly.
  // When overlay is fixed we there will never be any offset
  // When overlay is absolute there is a diff relative to the scroll
  // and eventually if the overlay is positioned differently than the other parent
  if (isOverlayOf(positionedParent, referencePositionedParent)) {
    return createGetOffsetsForOverlay(
      positionedParent,
      referencePositionedParent,
      scrollContainer,
      getScrollOffsets,
    );
  }
  if (isOverlayOf(referencePositionedParent, positionedParent)) {
    return createGetOffsetsForOverlay(
      referencePositionedParent,
      positionedParent,
      scrollContainer,
      getScrollOffsets,
    );
  }
  const scrollContainerIsDocument = scrollContainer === documentElement;
  if (scrollContainerIsDocument) {
    // Document case: getBoundingClientRect already includes document scroll effects
    // Add current scroll position to get the static offset
    const getPositionOffsetsDocumentScrolling = () => {
      const { scrollLeft: documentScrollLeft, scrollTop: documentScrollTop } =
        scrollContainer;
      const aRect = positionedParent.getBoundingClientRect();
      const bRect = referencePositionedParent.getBoundingClientRect();
      const aLeft = aRect.left;
      const aTop = aRect.top;
      const bLeft = bRect.left;
      const bTop = bRect.top;
      const aLeftDocument = documentScrollLeft + aLeft;
      const aTopDocument = documentScrollTop + aTop;
      const bLeftDocument = documentScrollLeft + bLeft;
      const bTopDocument = documentScrollTop + bTop;
      const offsetLeft = bLeftDocument - aLeftDocument;
      const offsetTop = bTopDocument - aTopDocument;
      return [offsetLeft, offsetTop];
    };
    return [getPositionOffsetsDocumentScrolling, getScrollOffsets];
  }
  // Custom scroll container case: account for container's position and scroll
  const getPositionOffsetsCustomScrollContainer = () => {
    const aRect = positionedParent.getBoundingClientRect();
    const bRect = referencePositionedParent.getBoundingClientRect();
    const aLeft = aRect.left;
    const aTop = aRect.top;
    const bLeft = bRect.left;
    const bTop = bRect.top;

    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const offsetLeft =
      bLeft - aLeft + scrollContainer.scrollLeft - scrollContainerRect.left;
    const offsetTop =
      bTop - aTop + scrollContainer.scrollTop - scrollContainerRect.top;
    return [offsetLeft, offsetTop];
  };
  return [getPositionOffsetsCustomScrollContainer, getScrollOffsets];
};
const createGetOffsetsForOverlay = (
  overlay,
  overlayTarget,
  scrollContainer,
  getScrollOffsets,
) => {
  if (getComputedStyle(overlay).position === "fixed") {
    return [() => [0, 0], getScrollOffsets];
  }
  const getPositionOffsetsOverlay = () => {
    const overlayRect = overlay.getBoundingClientRect();
    const overlayTargetRect = overlayTarget.getBoundingClientRect();
    const offsetLeft = overlayTargetRect.left - overlayRect.left;
    const offsetTop = overlayTargetRect.top - overlayRect.top;
    return [offsetLeft, offsetTop];
  };
  const getScrollOffsetsOverlay = () => {
    return [scrollContainer.scrollLeft, scrollContainer.scrollTop];
  };
  return [getPositionOffsetsOverlay, getScrollOffsetsOverlay];
};
const isOverlayOf = (element, potentialTarget) => {
  const overlayForAttribute = element.getAttribute("data-overlay-for");
  if (!overlayForAttribute) {
    return false;
  }
  const overlayTarget = document.querySelector(`#${overlayForAttribute}`);
  if (!overlayTarget) {
    return false;
  }
  if (overlayTarget === potentialTarget) {
    return true;
  }
  const overlayTargetPositionedParent = overlayTarget.offsetParent;
  if (overlayTargetPositionedParent === potentialTarget) {
    return true;
  }
  return false;
};

const { documentElement } = document;
const createGetScrollOffsets = (
  scrollContainer,
  referenceScrollContainer,
  positionedParent,
) => {
  const scrollContainerIsDocument = scrollContainer === documentElement;
  // I don't really get why we have to add scrollLeft (scrollLeft at grab)
  // to properly position the element in this scenario
  // It happens since we use translateX to position the element
  // Or maybe since something else. In any case it works
  const { scrollLeft, scrollTop } = scrollContainer;
  if (scrollContainerIsDocument) {
    const fixedPosition = findSelfOrAncestorFixedPosition(positionedParent);
    if (fixedPosition) {
      const getScrollOffsetsFixed = () => {
        const leftScrollToAdd = scrollLeft + fixedPosition[0];
        const topScrollToAdd = scrollTop + fixedPosition[1];
        return [leftScrollToAdd, topScrollToAdd];
      };
      return getScrollOffsetsFixed;
    }
  }
  const getScrollOffsetsWithScrolls = () => {
    const leftScrollToAdd = scrollLeft + referenceScrollContainer.scrollLeft;
    const topScrollToAdd = scrollTop + referenceScrollContainer.scrollTop;
    return [leftScrollToAdd, topScrollToAdd];
  };
  return getScrollOffsetsWithScrolls;
};

export const getDragCoordinates = (
  element,
  scrollContainer = getScrollContainer(element),
) => {
  const [scrollableLeft, scrollableTop] = getScrollablePosition(
    element,
    scrollContainer,
  );
  const { scrollLeft, scrollTop } = scrollContainer;
  const leftRelativeToScrollContainer = scrollableLeft + scrollLeft;
  const topRelativeToScrollContainer = scrollableTop + scrollTop;
  return [leftRelativeToScrollContainer, topRelativeToScrollContainer];
};
