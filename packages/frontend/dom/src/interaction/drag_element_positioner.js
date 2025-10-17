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
export const createDragElementPositioner = (element, referenceElement) => {
  if (!referenceElement) {
    return createStandardElementPositioner(element);
  }

  // Analyze element positioning context relative to reference
  const referenceScrollContainer = getScrollContainer(referenceElement);
  const referencePositionedParent = referenceElement.offsetParent;
  const scrollContainer = getScrollContainer(element);
  const positionedParent = element.offsetParent;

  const sameScrollContainer = scrollContainer === referenceScrollContainer;
  const samePositionedParent = positionedParent === referencePositionedParent;

  if (sameScrollContainer && samePositionedParent) {
    // Scenario 1: Same everything - use standard logic with element as effective element
    return createStandardElementPositioner(element);
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
      scrollContainer,
      referenceScrollContainer,
      positionedParent,
    });
  }

  // Scenario 4: Both different - most complex case
  return createFullyDifferentPositioner(element, {
    positionedParent,
    scrollContainer,
    referencePositionedParent,
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
    const { left: elementViewportLeft, top: elementViewportTop } =
      element.getBoundingClientRect();
    const scrollContainerIsDocument = scrollContainer === documentElement;

    if (scrollContainerIsDocument) {
      scrollableLeft = elementViewportLeft;
      scrollableTop = elementViewportTop;
    } else {
      const { left: scrollContainerLeft, top: scrollContainerTop } =
        scrollContainer.getBoundingClientRect();
      scrollableLeft = elementViewportLeft - scrollContainerLeft;
      scrollableTop = elementViewportTop - scrollContainerTop;
    }
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
  { scrollContainer, referenceScrollContainer, positionedParent },
) => {
  let scrollableLeft;
  let scrollableTop;
  let convertScrollablePosition;

  scrollable_current: {
    const elementRect = element.getBoundingClientRect();
    const referenceScrollContainerRect =
      referenceScrollContainer.getBoundingClientRect();

    // Calculate element positions relative to reference element's scroll container
    scrollableLeft =
      elementRect.left -
      referenceScrollContainerRect.left +
      referenceScrollContainer.scrollLeft;
    scrollableTop =
      elementRect.top -
      referenceScrollContainerRect.top +
      referenceScrollContainer.scrollTop;
  }
  scrollable_converter: {
    convertScrollablePosition = (
      referenceScrollableLeftToConvert,
      referenceScrollableTopToConvert,
    ) => {
      let positionedLeft;
      let positionedTop;

      const positionedParentRect = positionedParent.getBoundingClientRect();
      const referenceScrollContainerRect =
        referenceScrollContainer.getBoundingClientRect();

      left: {
        // Step 1: Convert from reference scroll container coordinates to viewport coordinates
        const referenceViewportLeft =
          referenceScrollContainerRect.left +
          referenceScrollableLeftToConvert -
          referenceScrollContainer.scrollLeft;
        // Step 2: Convert to element's positioned parent relative coordinates
        const positionedLeftWithoutScroll =
          referenceViewportLeft - positionedParentRect.left;
        // Step 3: Apply element's scroll container scroll to get final position
        positionedLeft =
          scrollContainer.scrollLeft + positionedLeftWithoutScroll;
      }
      top: {
        // Step 1: Convert from reference scroll container coordinates to viewport coordinates
        const referenceViewportTop =
          referenceScrollContainerRect.top +
          referenceScrollableTopToConvert -
          referenceScrollContainer.scrollTop;
        // Step 2: Convert to element's positioned parent relative coordinates
        const positionedTopWithoutScroll =
          referenceViewportTop - positionedParentRect.top;
        // Step 3: Apply element's scroll container scroll to get final position
        positionedTop = scrollContainer.scrollTop + positionedTopWithoutScroll;
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
  {
    scrollContainer,
    referenceScrollContainer,
    positionedParent,
    referencePositionedParent,
  },
) => {
  let scrollableLeft;
  let scrollableTop;
  let convertScrollablePosition;

  scrollable_current: {
    const elementRect = element.getBoundingClientRect();
    const referenceScrollContainerRect =
      referenceScrollContainer.getBoundingClientRect();

    // Calculate element positions relative to reference element's scroll container
    scrollableLeft =
      elementRect.left -
      referenceScrollContainerRect.left +
      referenceScrollContainer.scrollLeft;
    scrollableTop =
      elementRect.top -
      referenceScrollContainerRect.top +
      referenceScrollContainer.scrollTop;
  }
  scrollable_converter: {
    convertScrollablePosition = (
      referenceScrollableLeftToConvert,
      referenceScrollableTopToConvert,
    ) => {
      let positionedLeft;
      let positionedTop;

      // Calculate offset between reference element's scroll container and positioned parent
      const referenceScrollContainerRect =
        referenceScrollContainer.getBoundingClientRect();
      const referencePositionedParentRect =
        referencePositionedParent.getBoundingClientRect();
      const positionedParentLeftOffsetWithScrollContainer =
        referenceScrollContainerRect.left - referencePositionedParentRect.left;
      const positionedParentTopOffsetWithScrollContainer =
        referenceScrollContainerRect.top - referencePositionedParentRect.top;
      const elementPositionedParentRect =
        positionedParent.getBoundingClientRect();

      left: {
        // Step 1: Convert from scroll-relative to reference element's positioned-parent-relative
        const referenceLeftRelativeToPositionedParent =
          referenceScrollableLeftToConvert -
          positionedParentLeftOffsetWithScrollContainer;
        // Step 2: Convert to viewport coordinates using reference element's positioned parent
        const referenceViewportLeft =
          referencePositionedParentRect.left +
          referenceLeftRelativeToPositionedParent;
        // Step 3: Convert to element's positioned-parent-relative coordinates
        const positionedLeftWithoutScroll =
          referenceViewportLeft - elementPositionedParentRect.left;
        // Step 4: Apply element's scroll container scroll to get final position
        positionedLeft =
          scrollContainer.scrollLeft + positionedLeftWithoutScroll;
      }
      top: {
        // Step 1: Convert from scroll-relative to reference element's positioned-parent-relative
        const referenceTopRelativeToPositionedParent =
          referenceScrollableTopToConvert -
          positionedParentTopOffsetWithScrollContainer;
        // Step 2: Convert to viewport coordinates using reference element's positioned parent
        const referenceViewportTop =
          referencePositionedParentRect.top +
          referenceTopRelativeToPositionedParent;
        // Step 3: Convert to element's positioned-parent-relative coordinates
        const positionedTopWithoutScroll =
          referenceViewportTop - elementPositionedParentRect.top;
        // Step 4: Apply element's scroll container scroll to get final position
        positionedTop = scrollContainer.scrollTop + positionedTopWithoutScroll;
      }

      return [positionedLeft, positionedTop];
    };
  }
  return [scrollableLeft, scrollableTop, convertScrollablePosition];
};

const createStandardElementPositioner = (element) => {
  let scrollableLeft;
  let scrollableTop;
  let convertScrollablePosition;

  const scrollContainer = getScrollContainer(element);

  scrollable_current: {
    const { left: elementViewportLeft, top: elementViewportTop } =
      element.getBoundingClientRect();
    const scrollContainerIsDocument = scrollContainer === documentElement;
    if (scrollContainerIsDocument) {
      scrollableLeft = elementViewportLeft;
      scrollableTop = elementViewportTop;
    } else {
      const { left: scrollContainerLeft, top: scrollContainerTop } =
        scrollContainer.getBoundingClientRect();
      scrollableLeft = elementViewportLeft - scrollContainerLeft;
      scrollableTop = elementViewportTop - scrollContainerTop;
    }
  }
  scrollable_converter: {
    const positionedParent = element.offsetParent;
    const [
      positionedParentLeftOffsetWithScrollContainer,
      positionedParentTopOffsetWithScrollContainer,
    ] = getPositionedParentOffsetWithScrollContainer(
      positionedParent,
      scrollContainer,
    );
    convertScrollablePosition = (
      scrollableLeftToConvert,
      scrollableTopToConvert,
    ) => {
      let positionedLeft;
      let positionedTop;
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
    // Document case: getBoundingClientRect we want offset relative to document
    // and document.body is scolled. We want to know offset exluding scrolls
    const offsetLeft = scrollContainer.scrollLeft + positionedParentLeft;
    const offsetTop = scrollContainer.scrollTop + positionedParentTop;
    return [offsetLeft, offsetTop];
  }
  // Custom scroll container case: getBoundingClientRect is affected by container scroll
  // Add scroll position to get static offset (position as if scroll was 0)
  const { left: scrollContainerLeft, top: scrollContainerTop } =
    scrollContainer.getBoundingClientRect();
  const offsetLeft =
    scrollContainer.scrollLeft + positionedParentLeft - scrollContainerLeft;
  const offsetTop =
    scrollContainer.scrollTop + positionedParentTop - scrollContainerTop;
  return [offsetLeft, offsetTop];
};
