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
 * - leftRelativeToScrollContainer/topRelativeToScrollContainer:
 *   Current coordinates relative to the reference element's scroll container.
 *   When using a reference element, these coordinates represent where the element appears
 *   from the perspective of the reference element's coordinate system.
 *
 * - toLayoutLeft/toLayoutTop functions:
 *   Convert from the internal scroll-relative coordinates to DOM positioning coordinates.
 *   When using a reference element, these functions must convert from the reference element's
 *   scroll-relative coordinates to the element's offsetParent-relative coordinates.
 *
 * OTHER PROPERTIES:
 * The remaining returned properties provide coordinate conversion utilities but are less critical.
 */
export const createDragElementPositioner = (element, referenceElement) => {
  if (!referenceElement) {
    return createStandardElementPositioner(element);
  }

  // Analyze element positioning context relative to reference
  const referenceScrollContainer = getScrollContainer(referenceElement);
  const referencePositionedParent = referenceElement.offsetParent;
  const elementScrollContainer = getScrollContainer(element);
  const elementPositionedParent = element.offsetParent;

  const sameScrollContainer =
    elementScrollContainer === referenceScrollContainer;
  const samePositionedParent =
    elementPositionedParent === referencePositionedParent;

  if (sameScrollContainer && samePositionedParent) {
    // Scenario 1: Same everything - use standard logic with element as effective element
    return createStandardElementPositioner(element);
  }

  if (sameScrollContainer && !samePositionedParent) {
    // Scenario 2: Same scroll container, different positioned parent
    return createSameScrollDifferentParentPositioner(element, referenceElement);
  }

  if (!sameScrollContainer && samePositionedParent) {
    // Scenario 3: Different scroll container, same positioned parent
    return createDifferentScrollSameParentPositioner(element, referenceElement);
  }

  // Scenario 4: Both different - most complex case
  return createFullyDifferentPositioner(element, referenceElement);
};

// Scenario 2: Same scroll container, different positioned parent
// The coordinate system is the same, but we need different DOM positioning
const createSameScrollDifferentParentPositioner = (
  element,
  referenceElement,
) => {
  const referencePositionedParent = referenceElement.offsetParent;
  const elementPositionedParent = element.offsetParent;

  // Calculate element position relative to reference element's scroll container
  const referenceScrollContainer = getScrollContainer(referenceElement);
  const elementRect = element.getBoundingClientRect();
  const referenceScrollContainerRect =
    referenceScrollContainer.getBoundingClientRect();

  const leftRelativeToScrollContainer =
    elementRect.left - referenceScrollContainerRect.left;
  const topRelativeToScrollContainer =
    elementRect.top - referenceScrollContainerRect.top;

  // Get reference element positioning info for other properties
  const referenceStandardPositioner =
    createStandardElementPositioner(referenceElement);

  // Override toLayoutLeft/Top to convert to element's positioned parent coordinates
  const toLayoutLeft = (leftRelativeToScrollContainer) => {
    // Step 1: Convert to reference element's positioned parent coordinates using reference positioning
    const referenceLeftRelativeToPositionedParent =
      leftRelativeToScrollContainer -
      referenceStandardPositioner.leftRelativeToScrollContainer +
      referenceStandardPositioner.leftRelativeToPositionedParent;

    // Step 2: Convert to viewport coordinates
    const referencePositionedParentRect =
      referencePositionedParent.getBoundingClientRect();
    const referenceViewportLeft =
      referencePositionedParentRect.left +
      referenceLeftRelativeToPositionedParent;

    // Step 3: Convert to element's positioned parent coordinates
    const elementPositionedParentRect =
      elementPositionedParent.getBoundingClientRect();
    return referenceViewportLeft - elementPositionedParentRect.left;
  };

  const toLayoutTop = (topRelativeToScrollContainer) => {
    // Step 1: Convert to reference element's positioned parent coordinates using reference positioning
    const referenceTopRelativeToPositionedParent =
      topRelativeToScrollContainer -
      referenceStandardPositioner.topRelativeToScrollContainer +
      referenceStandardPositioner.topRelativeToPositionedParent;

    // Step 2: Convert to viewport coordinates
    const referencePositionedParentRect =
      referencePositionedParent.getBoundingClientRect();
    const referenceViewportTop =
      referencePositionedParentRect.top +
      referenceTopRelativeToPositionedParent;

    // Step 3: Convert to element's positioned parent coordinates
    const elementPositionedParentRect =
      elementPositionedParent.getBoundingClientRect();
    return referenceViewportTop - elementPositionedParentRect.top;
  };

  return {
    leftRelativeToScrollContainer,
    topRelativeToScrollContainer,
    toLayoutLeft,
    toLayoutTop,
    leftRelativeToPositionedParent:
      referenceStandardPositioner.leftRelativeToPositionedParent,
    topRelativeToPositionedParent:
      referenceStandardPositioner.topRelativeToPositionedParent,
    toScrollRelativeLeft: referenceStandardPositioner.toScrollRelativeLeft,
    toScrollRelativeTop: referenceStandardPositioner.toScrollRelativeTop,
  };
};

// Scenario 3: Different scroll container, same positioned parent
// The DOM positioning is the same, but coordinate system reference differs
const createDifferentScrollSameParentPositioner = (
  element,
  referenceElement,
) => {
  const referenceScrollContainer = getScrollContainer(referenceElement);
  const elementRect = element.getBoundingClientRect();

  // Calculate element positions relative to reference element's scroll container
  const referenceScrollContainerRect =
    referenceScrollContainer.getBoundingClientRect();
  const leftRelativeToScrollContainer =
    elementRect.left - referenceScrollContainerRect.left;
  const topRelativeToScrollContainer =
    elementRect.top - referenceScrollContainerRect.top;

  // Since positioned parent is the same, layout coordinates are simple
  const toLayoutLeft = (leftRelativeToScrollContainer) => {
    return (
      leftRelativeToScrollContainer -
      referenceScrollContainerRect.left +
      elementRect.left
    );
  };

  const toLayoutTop = (topRelativeToScrollContainer) => {
    return (
      topRelativeToScrollContainer -
      referenceScrollContainerRect.top +
      elementRect.top
    );
  };

  // Other properties using reference element's coordinate system
  const positionedParent = referenceElement.offsetParent;
  const referenceElementRect = referenceElement.getBoundingClientRect();
  const positionedParentRect = positionedParent.getBoundingClientRect();
  const leftRelativeToPositionedParent =
    referenceElementRect.left - positionedParentRect.left;
  const topRelativeToPositionedParent =
    referenceElementRect.top - positionedParentRect.top;

  const positionedParentLeftOffsetWithScrollContainer =
    referenceScrollContainerRect.left - positionedParentRect.left;
  const positionedParentTopOffsetWithScrollContainer =
    referenceScrollContainerRect.top - positionedParentRect.top;

  const toScrollRelativeLeft = (leftRelativeToPositionedParent) => {
    return (
      leftRelativeToPositionedParent +
      positionedParentLeftOffsetWithScrollContainer
    );
  };

  const toScrollRelativeTop = (topRelativeToPositionedParent) => {
    return (
      topRelativeToPositionedParent +
      positionedParentTopOffsetWithScrollContainer
    );
  };

  return {
    leftRelativeToScrollContainer,
    topRelativeToScrollContainer,
    toLayoutLeft,
    toLayoutTop,
    leftRelativeToPositionedParent,
    topRelativeToPositionedParent,
    toScrollRelativeLeft,
    toScrollRelativeTop,
  };
};

// Scenario 4: Both different - most complex case
// Both coordinate system and DOM positioning differ
const createFullyDifferentPositioner = (element, referenceElement) => {
  const referenceScrollContainer = getScrollContainer(referenceElement);
  const referencePositionedParent = referenceElement.offsetParent;
  const elementPositionedParent = element.offsetParent;

  // Calculate element position relative to reference element's scroll container (API contract)
  const elementRect = element.getBoundingClientRect();
  const referenceScrollContainerRect =
    referenceScrollContainer.getBoundingClientRect();

  const leftRelativeToScrollContainer =
    elementRect.left - referenceScrollContainerRect.left;
  const topRelativeToScrollContainer =
    elementRect.top - referenceScrollContainerRect.top;

  // Calculate positions relative to reference element's positioned parent (for coordinate conversion)
  const referenceElementRect = referenceElement.getBoundingClientRect();
  const referencePositionedParentRect =
    referencePositionedParent.getBoundingClientRect();
  const leftRelativeToPositionedParent =
    referenceElementRect.left - referencePositionedParentRect.left;
  const topRelativeToPositionedParent =
    referenceElementRect.top - referencePositionedParentRect.top;

  // Calculate offset between reference element's scroll container and positioned parent
  const positionedParentLeftOffsetWithScrollContainer =
    referenceScrollContainerRect.left - referencePositionedParentRect.left;
  const positionedParentTopOffsetWithScrollContainer =
    referenceScrollContainerRect.top - referencePositionedParentRect.top;

  const toLayoutLeft = (leftRelativeToScrollContainer) => {
    // Step 1: Convert from scroll-relative to reference element's positioned-parent-relative
    const referenceLeftRelativeToPositionedParent =
      leftRelativeToScrollContainer -
      positionedParentLeftOffsetWithScrollContainer;

    // Step 2: Convert to viewport coordinates using reference element's positioned parent
    const referenceViewportLeft =
      referencePositionedParentRect.left +
      referenceLeftRelativeToPositionedParent;

    // Step 3: Convert to element's positioned-parent-relative coordinates
    const elementPositionedParentRect =
      elementPositionedParent.getBoundingClientRect();
    return referenceViewportLeft - elementPositionedParentRect.left;
  };

  const toLayoutTop = (topRelativeToScrollContainer) => {
    // Step 1: Convert from scroll-relative to reference element's positioned-parent-relative
    const referenceTopRelativeToPositionedParent =
      topRelativeToScrollContainer -
      positionedParentTopOffsetWithScrollContainer;

    // Step 2: Convert to viewport coordinates using reference element's positioned parent
    const referenceViewportTop =
      referencePositionedParentRect.top +
      referenceTopRelativeToPositionedParent;

    // Step 3: Convert to element's positioned-parent-relative coordinates
    const elementPositionedParentRect =
      elementPositionedParent.getBoundingClientRect();
    return referenceViewportTop - elementPositionedParentRect.top;
  };

  const toScrollRelativeLeft = (leftRelativeToPositionedParent) => {
    return (
      leftRelativeToPositionedParent +
      positionedParentLeftOffsetWithScrollContainer
    );
  };

  const toScrollRelativeTop = (topRelativeToPositionedParent) => {
    return (
      topRelativeToPositionedParent +
      positionedParentTopOffsetWithScrollContainer
    );
  };

  return {
    leftRelativeToScrollContainer,
    topRelativeToScrollContainer,
    toLayoutLeft,
    toLayoutTop,
    leftRelativeToPositionedParent,
    topRelativeToPositionedParent,
    toScrollRelativeLeft,
    toScrollRelativeTop,
  };
};

const createStandardElementPositioner = (element) => {
  const positionedParent = element.offsetParent;
  const scrollContainer = getScrollContainer(element);

  // Helper function to create the positioner object (clean, no proxy logic)
  const createStandardPositioner = ({
    // current position
    leftRelativeToPositionedParent,
    topRelativeToPositionedParent,
    // help to implement toLayoutLeft/toLayoutTop
    positionedParentLeftOffsetWithScrollContainer,
    positionedParentTopOffsetWithScrollContainer,
    // less important properties
    leftRelativeToScrollContainer,
    topRelativeToScrollContainer,
  }) => {
    const toLayoutLeft = (currentLeftRelativeToScrollContainer) => {
      return (
        currentLeftRelativeToScrollContainer -
        positionedParentLeftOffsetWithScrollContainer
      );
    };
    const toLayoutTop = (currentTopRelativeToScrollContainer) => {
      return (
        currentTopRelativeToScrollContainer -
        positionedParentTopOffsetWithScrollContainer
      );
    };

    const toScrollRelativeLeft = (currentLeftRelativeToPositionedParent) => {
      return (
        currentLeftRelativeToPositionedParent +
        positionedParentLeftOffsetWithScrollContainer
      );
    };
    const toScrollRelativeTop = (currentTopRelativeToPositionedParent) => {
      return (
        currentTopRelativeToPositionedParent +
        positionedParentTopOffsetWithScrollContainer
      );
    };

    return {
      leftRelativeToScrollContainer,
      topRelativeToScrollContainer,
      toLayoutLeft,
      toLayoutTop,

      leftRelativeToPositionedParent,
      topRelativeToPositionedParent,
      toScrollRelativeLeft,
      toScrollRelativeTop,
    };
  };

  // Most common case: positioned parent is inside the scroll container
  if (scrollContainer.contains(positionedParent)) {
    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const scrollContainerViewportLeft = scrollContainerRect.left;
    const scrollContainerViewportTop = scrollContainerRect.top;
    const positionedParentRect = positionedParent.getBoundingClientRect();
    const positionedParentViewportLeft = positionedParentRect.left;
    const positionedParentViewportTop = positionedParentRect.top;
    const elementRect = element.getBoundingClientRect();
    const elementViewportLeft = elementRect.left;
    const elementViewportTop = elementRect.top;

    // Calculate static offset between positioned parent and scroll container
    // This offset should be independent of scroll position
    let staticOffsetX;
    let staticOffsetY;
    const scrollContainerIsDocument =
      scrollContainer === document.documentElement;
    if (scrollContainerIsDocument) {
      // Document case: getBoundingClientRect is not affected by document scroll
      staticOffsetX =
        positionedParentViewportLeft - scrollContainerViewportLeft;
      staticOffsetY = positionedParentViewportTop - scrollContainerViewportTop;
    } else {
      // Custom scroll container case: getBoundingClientRect is affected by container scroll
      // Add scroll position to get static offset (position as if scroll was 0)
      staticOffsetX =
        positionedParentViewportLeft +
        scrollContainer.scrollLeft -
        scrollContainerViewportLeft;
      staticOffsetY =
        positionedParentViewportTop +
        scrollContainer.scrollTop -
        scrollContainerViewportTop;
    }

    // Calculate offset between positioned parent and scroll container
    const positionedParentLeftOffsetWithScrollContainer = staticOffsetX;
    const positionedParentTopOffsetWithScrollContainer = staticOffsetY;

    // Calculate current element position relative to positioned parent (layout coordinates)
    const leftRelativeToPositionedParent =
      elementViewportLeft - positionedParentViewportLeft;
    const topRelativeToPositionedParent =
      elementViewportTop - positionedParentViewportTop;

    // Calculate current element position relative to scroll container
    const leftRelativeToScrollContainer = scrollContainerIsDocument
      ? elementViewportLeft
      : elementViewportLeft - scrollContainerViewportLeft;
    const topRelativeToScrollContainer = scrollContainerIsDocument
      ? elementViewportTop
      : elementViewportTop - scrollContainerViewportTop;

    return createStandardPositioner({
      leftRelativeToScrollContainer,
      topRelativeToScrollContainer,
      positionedParentLeftOffsetWithScrollContainer,
      positionedParentTopOffsetWithScrollContainer,
      leftRelativeToPositionedParent,
      topRelativeToPositionedParent,
    });
  }

  // Special case: the scroll container IS the positioned parent
  if (scrollContainer === positionedParent) {
    const positionedParentRect = positionedParent.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const scrollContainerIsDocument =
      scrollContainer === document.documentElement;

    // Element position relative to positioned parent (which is also the scroll container)
    const leftRelativeToPositionedParent =
      elementRect.left - positionedParentRect.left;
    const topRelativeToPositionedParent =
      elementRect.top - positionedParentRect.top;

    // Element position relative to scroll container (handle document vs custom container)
    const leftRelativeToScrollContainer = scrollContainerIsDocument
      ? elementRect.left
      : elementRect.left - positionedParentRect.left;
    const topRelativeToScrollContainer = scrollContainerIsDocument
      ? elementRect.top
      : elementRect.top - positionedParentRect.top;

    // No offset between positioned parent and scroll container (they are the same)
    const positionedParentLeftOffsetWithScrollContainer = 0;
    const positionedParentTopOffsetWithScrollContainer = 0;

    return createStandardPositioner({
      leftRelativeToScrollContainer,
      topRelativeToScrollContainer,
      positionedParentLeftOffsetWithScrollContainer,
      positionedParentTopOffsetWithScrollContainer,
      leftRelativeToPositionedParent,
      topRelativeToPositionedParent,
    });
  }

  // Case: positioned parent is ancestor of scroll container
  if (positionedParent.contains(scrollContainer)) {
    const positionedParentRect = positionedParent.getBoundingClientRect();
    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const scrollContainerIsDocument =
      scrollContainer === document.documentElement;

    // Calculate element position relative to positioned parent
    const leftRelativeToPositionedParent =
      elementRect.left - positionedParentRect.left;
    const topRelativeToPositionedParent =
      elementRect.top - positionedParentRect.top;

    // Calculate element position relative to scroll container (handle document vs custom container)
    const leftRelativeToScrollContainer = scrollContainerIsDocument
      ? elementRect.left
      : elementRect.left - scrollContainerRect.left;
    const topRelativeToScrollContainer = scrollContainerIsDocument
      ? elementRect.top
      : elementRect.top - scrollContainerRect.top;

    // Calculate offset from positioned parent to scroll container (handle document vs custom container)
    const positionedParentLeftOffsetWithScrollContainer =
      scrollContainerIsDocument
        ? positionedParentRect.left
        : scrollContainerRect.left - positionedParentRect.left;
    const positionedParentTopOffsetWithScrollContainer =
      scrollContainerIsDocument
        ? positionedParentRect.top
        : scrollContainerRect.top - positionedParentRect.top;

    return createStandardPositioner({
      leftRelativeToScrollContainer,
      topRelativeToScrollContainer,
      positionedParentLeftOffsetWithScrollContainer,
      positionedParentTopOffsetWithScrollContainer,
      leftRelativeToPositionedParent,
      topRelativeToPositionedParent,
    });
  }

  // never supposed to happen
  throw new Error(
    "Unsupported positioning configuration: positioned parent must be in a parent-child relationship or be the same.",
  );
};
