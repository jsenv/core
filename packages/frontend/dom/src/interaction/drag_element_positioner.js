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
  const scrollContainer = getScrollContainer(element);
  const positionedParent = elementToMove
    ? elementToMove.offsetParent
    : element.offsetParent;

  if (!referenceElement) {
    return createStandardElementPositioner(element, {
      scrollContainer,
      positionedParent,
    });
  }

  // Analyze element positioning context relative to reference
  const referenceScrollContainer = getScrollContainer(referenceElement);
  const referencePositionedParent = referenceElement.offsetParent;

  const sameScrollContainer = scrollContainer === referenceScrollContainer;
  const samePositionedParent = positionedParent === referencePositionedParent;

  if (sameScrollContainer && samePositionedParent) {
    // Scenario 1: Same everything - use standard logic
    return createStandardElementPositioner(element, {
      scrollContainer,
      positionedParent,
    });
  }

  if (sameScrollContainer && !samePositionedParent) {
    // Scenario 2: Same scroll container, different positioned parent
    return createSameScrollDifferentParentPositioner(element, {
      scrollContainer,
      positionedParent,
      referencePositionedParent,
    });
  }

  if (!sameScrollContainer && samePositionedParent) {
    // Scenario 3: Different scroll container, same positioned parent
    return createDifferentScrollSameParentPositioner(element, {
      positionedParent,
      referenceScrollContainer,
    });
  }

  // Scenario 4: Both different - most complex case
  return createFullyDifferentPositioner(element, {
    positionedParent,
    referenceScrollContainer,
  });
};

const { documentElement } = document;

// Scenario 2: Same scroll container, different positioned parent
// The coordinate system is the same, but we need different DOM positioning
//
// CHALLENGE: Convert coordinates from reference element's coordinate system to element's layout coordinates
// - Input coordinates are relative to the reference element's scroll container (without scrolls)
// - We need to output coordinates that can be used to position the element via its offsetParent
// - This requires a 3-step conversion process through reference positioned parent coordinates
const createSameScrollDifferentParentPositioner = (
  element,
  { scrollContainer, positionedParent, referencePositionedParent },
) => {
  let scrollableLeft;
  let scrollableTop;
  let convertScrollablePosition;

  scrollable_current: {
    [scrollableLeft, scrollableTop] = getScrollablePosition(
      element,
      scrollContainer,
    );
  }
  scrollable_converter: {
    convertScrollablePosition = (
      referenceScrollableLeftToConvert,
      referenceScrollableTopToConvert,
    ) => {
      let positionedLeft;
      let positionedTop;

      const [
        positionedParentLeftOffsetWithScrollContainer,
        positionedParentTopOffsetWithScrollContainer,
      ] = getPositionedParentOffsetWithScrollContainer(
        positionedParent,
        scrollContainer,
      );

      const [
        referencePositionedParentLeftOffsetWithScrollContainer,
        referencePositionedParentTopOffsetWithScrollContainer,
      ] = getPositionedParentOffsetWithScrollContainer(
        referencePositionedParent,
        scrollContainer,
      );

      left: {
        // Step 1: Convert from reference scroll-relative to reference positioned-parent-relative
        const referencePositionedLeftWithoutScroll =
          referenceScrollableLeftToConvert -
          referencePositionedParentLeftOffsetWithScrollContainer;

        // Step 2: Convert to element positioned-parent-relative by adding the difference
        const positionedLeftWithoutScroll =
          referencePositionedLeftWithoutScroll +
          (referencePositionedParentLeftOffsetWithScrollContainer -
            positionedParentLeftOffsetWithScrollContainer);

        // Step 3: Apply scroll to get final positioning
        positionedLeft =
          scrollContainer.scrollLeft + positionedLeftWithoutScroll;
      }
      top: {
        // Step 1: Convert from reference scroll-relative to reference positioned-parent-relative
        const referencePositionedTopWithoutScroll =
          referenceScrollableTopToConvert -
          referencePositionedParentTopOffsetWithScrollContainer;

        // Step 2: Convert to element positioned-parent-relative by adding the difference
        const positionedTopWithoutScroll =
          referencePositionedTopWithoutScroll +
          (referencePositionedParentTopOffsetWithScrollContainer -
            positionedParentTopOffsetWithScrollContainer);

        // Step 3: Apply scroll to get final positioning
        positionedTop = scrollContainer.scrollTop + positionedTopWithoutScroll;
      }

      return [positionedLeft, positionedTop];
    };
  }

  return [scrollableLeft, scrollableTop, convertScrollablePosition];
};

// Scenario 3: Different scroll container, same positioned parent
// The DOM positioning is the same, but coordinate system reference differs
const createDifferentScrollSameParentPositioner = (
  element,
  { referenceScrollContainer, positionedParent },
) => {
  let scrollableLeft;
  let scrollableTop;
  let convertScrollablePosition;

  scrollable_current: {
    [scrollableLeft, scrollableTop] = getScrollablePosition(
      element,
      referenceScrollContainer,
    );
  }
  scrollable_converter: {
    convertScrollablePosition = (
      referenceScrollableLeftToConvert,
      referenceScrollableTopToConvert,
    ) => {
      let positionedLeft;
      let positionedTop;

      const [
        positionedParentLeftOffsetWithReferenceScrollContainer,
        positionedParentTopOffsetWithReferenceScrollContainer,
      ] = getPositionedParentOffsetWithScrollContainer(
        positionedParent,
        referenceScrollContainer,
      );

      left: {
        // Convert from reference scroll container coordinates to positioned parent coordinates
        positionedLeft =
          referenceScrollableLeftToConvert -
          positionedParentLeftOffsetWithReferenceScrollContainer;
      }
      top: {
        // Convert from reference scroll container coordinates to positioned parent coordinates
        positionedTop =
          referenceScrollableTopToConvert -
          positionedParentTopOffsetWithReferenceScrollContainer;
      }

      return [positionedLeft, positionedTop];
    };
  }

  return [scrollableLeft, scrollableTop, convertScrollablePosition];
};

// Scenario 4: Both different - most complex case
// Both coordinate system and DOM positioning differ
const createFullyDifferentPositioner = (
  element,
  { referenceScrollContainer, positionedParent },
) => {
  let scrollableLeft;
  let scrollableTop;
  let convertScrollablePosition;

  scrollable_current: {
    [scrollableLeft, scrollableTop] = getScrollablePosition(
      element,
      referenceScrollContainer,
    );
  }
  scrollable_converter: {
    convertScrollablePosition = (
      referenceScrollableLeftToConvert,
      referenceScrollableTopToConvert,
    ) => {
      let positionedLeft;
      let positionedTop;

      const [
        positionedParentLeftOffsetWithReferenceScrollContainer,
        positionedParentTopOffsetWithReferenceScrollContainer,
      ] = getPositionedParentOffsetWithScrollContainer(
        positionedParent,
        referenceScrollContainer,
      );

      left: {
        // Step 1: Convert from reference scroll container coordinates to element positioned parent coordinates (without scroll)
        const positionedLeftWithoutScroll =
          referenceScrollableLeftToConvert -
          positionedParentLeftOffsetWithReferenceScrollContainer;
        // Step 2: Apply element's scroll container scroll to get final position
        positionedLeft =
          referenceScrollContainer.scrollLeft + positionedLeftWithoutScroll;
      }
      top: {
        // Step 1: Convert from reference scroll container coordinates to element positioned parent coordinates (without scroll)
        const positionedTopWithoutScroll =
          referenceScrollableTopToConvert -
          positionedParentTopOffsetWithReferenceScrollContainer;
        // Step 2: Apply element's scroll container scroll to get final position
        positionedTop =
          referenceScrollContainer.scrollTop + positionedTopWithoutScroll;
      }

      return [positionedLeft, positionedTop];
    };
  }
  return [scrollableLeft, scrollableTop, convertScrollablePosition];
};

const createStandardElementPositioner = (
  element,
  { scrollContainer, positionedParent },
) => {
  let scrollableLeft;
  let scrollableTop;
  let convertScrollablePosition;

  scrollable_current: {
    [scrollableLeft, scrollableTop] = getScrollablePosition(
      element,
      scrollContainer,
    );
  }
  scrollable_converter: {
    convertScrollablePosition = (
      scrollableLeftToConvert,
      scrollableTopToConvert,
    ) => {
      let positionedLeft;
      let positionedTop;

      const [
        positionedParentLeftOffsetWithScrollContainer,
        positionedParentTopOffsetWithScrollContainer,
      ] = getPositionedParentOffsetWithScrollContainer(
        positionedParent,
        scrollContainer,
      );

      left: {
        const positionedLeftWithoutScroll =
          scrollableLeftToConvert -
          positionedParentLeftOffsetWithScrollContainer;
        positionedLeft =
          scrollContainer.scrollLeft + positionedLeftWithoutScroll;
      }
      top: {
        const positionedTopWithoutScroll =
          scrollableTopToConvert - positionedParentTopOffsetWithScrollContainer;
        positionedTop = scrollContainer.scrollTop + positionedTopWithoutScroll;
      }
      return [positionedLeft, positionedTop];
    };
  }
  return [scrollableLeft, scrollableTop, convertScrollablePosition];
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

// Calculate the offset between two elements accounting for scroll container position
// This is useful when elementToMove is different from the drag element
export const getOffsetBetweenTwoElements = (
  elementA,
  elementB,
  scrollContainer,
) => {
  if (elementA === elementB) {
    return [0, 0];
  }
  const scrollContainerIsDocument = scrollContainer === documentElement;
  const elementARect = elementA.getBoundingClientRect();
  const elementBRect = elementB.getBoundingClientRect();
  const offsetLeftViewport = elementARect.left - elementBRect.left;
  const offsetTopViewport = elementARect.top - elementBRect.top;
  if (scrollContainerIsDocument) {
    // Document case: getBoundingClientRect already includes document scroll effects
    // Add current scroll position to get the static offset
    return [
      scrollContainer.scrollLeft + offsetLeftViewport,
      scrollContainer.scrollTop + offsetTopViewport,
    ];
  }
  // Custom scroll container case: account for container's position and scroll
  const scrollContainerRect = scrollContainer.getBoundingClientRect();
  return [
    offsetLeftViewport + scrollContainer.scrollLeft - scrollContainerRect.left,
    offsetTopViewport + scrollContainer.scrollTop - scrollContainerRect.top,
  ];
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

// Calculate static offset between positioned parent and scroll container
// This offset should be independent of scroll position
const getPositionedParentOffsetWithScrollContainer = (
  positionedParent,
  scrollContainer,
) => {
  if (positionedParent === scrollContainer) {
    return [0, 0];
  }

  const scrollContainerIsDocument = scrollContainer === documentElement;
  const { left: positionedParentLeft, top: positionedParentTop } =
    positionedParent.getBoundingClientRect();

  if (scrollContainerIsDocument) {
    // Document scroll container case:
    // When the document is scrolled, getBoundingClientRect() values are already affected
    // For example: if document is scrolled 200px to the right:
    //   - documentElement.getBoundingClientRect().left returns -200px
    //   - positionedParent.getBoundingClientRect().left already includes this scroll effect
    // To get the static offset (position as if no scroll), we add the current scroll position
    const offsetLeft = scrollContainer.scrollLeft + positionedParentLeft;
    const offsetTop = scrollContainer.scrollTop + positionedParentTop;
    return [offsetLeft, offsetTop];
  }

  // Custom scroll container case:
  // getBoundingClientRect() values are affected by the container's scroll position
  // We need to calculate the offset relative to the scroll container's coordinate system
  // Steps:
  // 1. Get positioned parent's position relative to viewport
  // 2. Get scroll container's position relative to viewport
  // 3. Calculate relative position: (parent position - container position)
  // 4. Add scroll position to get static offset (unaffected by current scroll)
  const { left: scrollContainerLeft, top: scrollContainerTop } =
    scrollContainer.getBoundingClientRect();
  const offsetLeft =
    scrollContainer.scrollLeft + positionedParentLeft - scrollContainerLeft;
  const offsetTop =
    scrollContainer.scrollTop + positionedParentTop - scrollContainerTop;
  return [offsetLeft, offsetTop];
};
