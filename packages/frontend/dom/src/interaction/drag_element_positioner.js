import { findSelfOrAncestorFixedPosition } from "../position/position_fixed.js";
import { getScrollContainer } from "../scroll/scroll_container.js";

/**
 * Creates a coordinate system positioner for drag operations.
 *
 * COORDINATE SYSTEM:
 * Internally, we use a coordinate system described as "position relative to the scroll container".
 * This is similar to getBoundingClientRect() but relative to the scroll container
 * instead of always being relative to the viewport.
 *
 * CONVERSION CHALLENGE:
 * We need to convert these internal coordinates back to actual DOM layout coordinates.
 * This becomes complex when:
 * - The offsetParent position differs from the scroll container position
 * - A referenceElement is used (the coordinate system differs from the element)
 *
 * EXPECTED API CONTRACT:
 * The calling code expects this positioner to return:
 *
 * - [scrollableLeft, scrollableTop, convertScrollablePosition]
 *
 * - scrollableLeft/scrollableTop:
 *   Current coordinates relative to the reference element's scroll container.
 *   When using a reference element, these coordinates represent where the element appears
 *   from the perspective of the reference element's coordinate system.
 *
 * - convertScrollablePosition:
 *   Convert from the internal scroll-relative coordinates to DOM positioning coordinates.
 *   When using a reference element, these functions must convert from the reference element's
 *   scroll-relative coordinates to the element's offsetParent-relative coordinates.
 *
 */

export const createDragElementPositioner = (
  element,
  referenceElement,
  elementToMove,
) => {
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

  let scrollableLeft;
  let scrollableTop;
  let convertScrollablePosition;

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
const createGetOffsets = ({
  positionedParent,
  referencePositionedParent = positionedParent,
  scrollContainer,
  referenceScrollContainer = scrollContainer,
}) => {
  const samePositionedParent = positionedParent === referencePositionedParent;
  const sameScrollContainer = scrollContainer === referenceScrollContainer;
  const getScrollOffsets = sameScrollContainer
    ? createGetScrollOffsetsForSameContainer(scrollContainer)
    : createGetScrollOffsetsForDifferentContainers(
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
    if (getComputedStyle(positionedParent).position === "fixed") {
      return [() => [0, 0], () => [0, 0]];
    }
  }
  if (isOverlayOf(referencePositionedParent, positionedParent)) {
    if (getComputedStyle(referencePositionedParent).position === "fixed") {
      return [() => [0, 0], () => [0, 0]];
    }
  }
  const scrollContainerIsDocument = scrollContainer === documentElement;
  if (scrollContainerIsDocument) {
    return [
      () => {
        // Document case: getBoundingClientRect already includes document scroll effects
        // Add current scroll position to get the static offset
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
      },
      getScrollOffsets,
    ];
  }

  // Custom scroll container case: account for container's position and scroll
  return [
    () => {
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
    },
    getScrollOffsets,
  ];
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
const createGetScrollOffsetsForSameContainer = (scrollContainer) => {
  return () => {
    return [scrollContainer.scrollLeft, scrollContainer.scrollTop];
  };
};
const createGetScrollOffsetsForDifferentContainers = (
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
