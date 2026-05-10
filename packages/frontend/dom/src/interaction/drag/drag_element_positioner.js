import { findSelfOrAncestorFixedPosition } from "../../position/position_fixed.js";
import { getScrollContainer } from "../scroll/scroll_container.js";

/**
 * Creates a coordinate system positioner for drag operations.
 *
 * PURPOSE:
 * During a drag gesture, the system tracks mouse movement as "scrollable coordinates"
 * relative to the scroll container. This function converts those coordinates into
 * the actual CSS transform values needed to visually move an element (or a separate
 * elementToMove) to follow the mouse.
 *
 * PARAMETERS:
 * - element:          The element being grabbed / tracked for drag detection and auto-scroll.
 * - referenceElement: Optional. The element whose coordinate system defines the input space.
 *                     When provided, scrollable coords are relative to its scroll container.
 *                     Defaults to element itself.
 * - elementToMove:    Optional. A different element to apply the transform to (e.g. a clone
 *                     or a table that moves as a whole when a column is dragged).
 *                     When provided, its offsetParent is used as the positioning context.
 *
 * THE COORDINATE PIPELINE:
 *
 *   Mouse position
 *     → scrollable coords  (relative to referenceScrollContainer, scroll-independent)
 *     → positioned coords  (relative to elementToMove's offsetParent, for CSS transform)
 *
 * Two types of offsets bridge these spaces:
 *
 * 1. POSITION OFFSETS (getPositionOffsets):
 *    Compensate for the fact that positionedParent and referencePositionedParent
 *    may differ. For example, if `element` lives inside a <table> and `elementToMove`
 *    is a full table clone, their offsetParents are different elements.
 *    This offset is the spatial difference between those two positioned ancestors.
 *    Called dynamically because parents can move (e.g. overlay elements).
 *
 * 2. SCROLL OFFSETS (getScrollOffsets):
 *    Account for the scroll position of the relevant scroll container(s).
 *    The math ensures that at grab time, the transform delta is zero (element
 *    stays at its visual position), and subsequent mouse movement maps 1:1
 *    to transform change.
 *
 *    CRITICAL CASE — positionedParent outside referenceScrollContainer:
 *    When elementToMove's offsetParent is NOT inside the referenceScrollContainer
 *    (e.g. a clone appended to document.body while tracking an element inside
 *    an overflow:auto div), the scroll offset must be FROZEN at grab time.
 *    Using a live scroll value would double-move the clone during auto-scroll:
 *    the scrollable coordinate decreases (element appears to move up) AND the
 *    live scroll value increases — both applied to the same transform.
 *    Freezing the scroll at grab time cancels this out while still correctly
 *    placing the clone at the right initial position.
 *
 * KEY SCENARIOS SUPPORTED:
 * 1. Same positioned parent, same scroll container        — minimal offsets
 * 2. Different positioned parents, same scroll container  — position offset compensation
 * 3. Same positioned parent, different scroll containers  — scroll offset bridging
 * 4. Different positioned parents, different containers   — full offset compensation
 * 5. Overlay elements (data-overlay-for)                  — specialized offset path
 * 6. Fixed positioned elements                            — special scroll handling
 * 7. elementToMove outside referenceScrollContainer       — frozen scroll offset at grab
 *
 * API CONTRACT:
 * Returns [scrollableLeft, scrollableTop, convertScrollablePosition] where:
 *
 * - scrollableLeft/scrollableTop:
 *   The element's current position in the reference coordinate system at grab time.
 *   Used as the layout starting point (layoutScrollableLeft/Top) by the gesture system.
 *
 * - convertScrollablePosition(scrollableLeft, scrollableTop):
 *   Converts a scrollable coordinate (from the gesture layout) into a positioned
 *   coordinate suitable for CSS transform. The gesture system computes:
 *     topDelta = convertScrollablePosition(layout.scrollableTop) - topAtGrab
 *   and applies that as translateY. At grab time, delta = 0. As the mouse moves,
 *   delta tracks the movement exactly, regardless of scroll context differences.
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
      : positionedParent,
    scrollContainer,
    referenceScrollContainer: referenceElement
      ? getScrollContainer(referenceElement)
      : scrollContainer,
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
  referencePositionedParent,
  scrollContainer,
  referenceScrollContainer,
}) => {
  const samePositionedParent = positionedParent === referencePositionedParent;
  const getScrollOffsets = createGetScrollOffsets(
    scrollContainer,
    referenceScrollContainer,
    positionedParent,
    samePositionedParent,
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
      {
        scrollContainer,
        referenceScrollContainer,
        getScrollOffsets,
      },
    );
  }
  if (isOverlayOf(referencePositionedParent, positionedParent)) {
    return createGetOffsetsForOverlay(
      referencePositionedParent,
      positionedParent,
      {
        scrollContainer,
        referenceScrollContainer,
        getScrollOffsets,
      },
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
  { scrollContainer, referenceScrollContainer, getScrollOffsets },
) => {
  const sameScrollContainer = scrollContainer === referenceScrollContainer;
  const scrollContainerIsDocument =
    scrollContainer === document.documentElement;
  const referenceScrollContainerIsDocument =
    referenceScrollContainer === documentElement;

  if (getComputedStyle(overlay).position === "fixed") {
    if (referenceScrollContainerIsDocument) {
      const getPositionOffsetsFixedOverlay = () => {
        return [0, 0];
      };
      return [getPositionOffsetsFixedOverlay, getScrollOffsets];
    }
    const getPositionOffsetsFixedOverlay = () => {
      const scrollContainerRect = scrollContainer.getBoundingClientRect();
      const referenceScrollContainerRect =
        referenceScrollContainer.getBoundingClientRect();
      let offsetLeftBetweenScrollContainers =
        referenceScrollContainerRect.left - scrollContainerRect.left;
      let offsetTopBetweenScrollContainers =
        referenceScrollContainerRect.top - scrollContainerRect.top;
      if (scrollContainerIsDocument) {
        offsetLeftBetweenScrollContainers -= scrollContainer.scrollLeft;
        offsetTopBetweenScrollContainers -= scrollContainer.scrollTop;
      }
      return [
        -offsetLeftBetweenScrollContainers,
        -offsetTopBetweenScrollContainers,
      ];
    };
    return [getPositionOffsetsFixedOverlay, getScrollOffsets];
  }

  const getPositionOffsetsOverlay = () => {
    if (sameScrollContainer) {
      const overlayRect = overlay.getBoundingClientRect();
      const overlayTargetRect = overlayTarget.getBoundingClientRect();
      const overlayLeft = overlayRect.left;
      const overlayTop = overlayRect.top;
      let overlayTargetLeft = overlayTargetRect.left;
      let overlayTargetTop = overlayTargetRect.top;
      if (scrollContainerIsDocument) {
        overlayTargetLeft += scrollContainer.scrollLeft;
        overlayTargetTop += scrollContainer.scrollTop;
      }
      const offsetLeftBetweenTargetAndOverlay = overlayTargetLeft - overlayLeft;
      const offsetTopBetweenTargetAndOverlay = overlayTargetTop - overlayTop;
      return [
        -scrollContainer.scrollLeft + offsetLeftBetweenTargetAndOverlay,
        -scrollContainer.scrollTop + offsetTopBetweenTargetAndOverlay,
      ];
    }

    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const referenceScrollContainerRect =
      referenceScrollContainer.getBoundingClientRect();
    let scrollContainerLeft = scrollContainerRect.left;
    let scrollContainerTop = scrollContainerRect.top;
    let referenceScrollContainerLeft = referenceScrollContainerRect.left;
    let referenceScrollContainerTop = referenceScrollContainerRect.top;
    if (scrollContainerIsDocument) {
      scrollContainerLeft += scrollContainer.scrollLeft;
      scrollContainerTop += scrollContainer.scrollTop;
    }
    const offsetLeftBetweenScrollContainers =
      referenceScrollContainerLeft - scrollContainerLeft;
    const offsetTopBetweenScrollContainers =
      referenceScrollContainerTop - scrollContainerTop;
    return [
      -offsetLeftBetweenScrollContainers - referenceScrollContainer.scrollLeft,
      -offsetTopBetweenScrollContainers - referenceScrollContainer.scrollTop,
    ];
  };
  const getScrollOffsetsOverlay = () => {
    if (sameScrollContainer) {
      return [scrollContainer.scrollLeft, scrollContainer.scrollTop];
    }

    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const referenceScrollContainerRect =
      referenceScrollContainer.getBoundingClientRect();
    let offsetLeftBetweenScrollContainers =
      referenceScrollContainerRect.left - scrollContainerRect.left;
    let offsetTopBetweenScrollContainers =
      referenceScrollContainerRect.top - scrollContainerRect.top;
    if (scrollContainerIsDocument) {
      offsetLeftBetweenScrollContainers -= scrollContainer.scrollLeft;
      offsetTopBetweenScrollContainers -= scrollContainer.scrollTop;
    }

    return [
      referenceScrollContainer.scrollLeft + offsetLeftBetweenScrollContainers,
      referenceScrollContainer.scrollTop + offsetTopBetweenScrollContainers,
    ];
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

const { documentElement } =
  typeof document === "object" ? document : { documentElement: null };

const createGetScrollOffsets = (
  scrollContainer,
  referenceScrollContainer,
  positionedParent,
  samePositionedParent,
) => {
  const getGetScrollOffsetsSameContainer = () => {
    const scrollContainerIsDocument = scrollContainer === documentElement;
    // I don't really get why we have to add scrollLeft (scrollLeft at grab)
    // to properly position the element in this scenario
    // It happens since we use translateX to position the element
    // Or maybe since something else. In any case it works
    const { scrollLeft, scrollTop } = samePositionedParent
      ? { scrollLeft: 0, scrollTop: 0 }
      : referenceScrollContainer;
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
    const positionedParentIsInsideScrollContainer =
      referenceScrollContainer === documentElement ||
      referenceScrollContainer.contains(positionedParent);
    if (!positionedParentIsInsideScrollContainer) {
      // positionedParent is outside the scroll container (e.g. clone in document.body
      // while tracking an element inside a custom scroll container).
      // We must add the scroll at grab time as a frozen offset so that:
      // - initial topDelta = 0 (clone starts at correct position)
      // - auto-scroll doesn't double-move the clone (scroll changes cancel out in layout)
      const scrollLeftAtGrab = referenceScrollContainer.scrollLeft;
      const scrollTopAtGrab = referenceScrollContainer.scrollTop;
      return () => [scrollLeft + scrollLeftAtGrab, scrollTop + scrollTopAtGrab];
    }
    const getScrollOffsets = () => {
      const leftScrollToAdd = scrollLeft + referenceScrollContainer.scrollLeft;
      const topScrollToAdd = scrollTop + referenceScrollContainer.scrollTop;
      return [leftScrollToAdd, topScrollToAdd];
    };
    return getScrollOffsets;
  };

  const sameScrollContainer = scrollContainer === referenceScrollContainer;
  const getScrollOffsetsSameContainer = getGetScrollOffsetsSameContainer();
  if (sameScrollContainer) {
    return getScrollOffsetsSameContainer;
  }
  const getScrollOffsetsDifferentContainers = () => {
    const [scrollLeftToAdd, scrollTopToAdd] = getScrollOffsetsSameContainer();
    const rect = scrollContainer.getBoundingClientRect();
    const referenceRect = referenceScrollContainer.getBoundingClientRect();
    const leftDiff = referenceRect.left - rect.left;
    const topDiff = referenceRect.top - rect.top;
    return [scrollLeftToAdd + leftDiff, scrollTopToAdd + topDiff];
  };
  return getScrollOffsetsDifferentContainers;
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
