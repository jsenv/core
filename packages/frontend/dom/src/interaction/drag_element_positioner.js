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
 * The remaining returned properties provide coordinate conversion utilities but are not used for now.
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
//
// CHALLENGE: Convert coordinates from reference element's coordinate system to element's layout coordinates
// - Input coordinates are relative to the reference element's scroll container (without scrolls)
// - We need to output coordinates that can be used to position the element via its offsetParent
// - This requires a 3-step conversion process through reference positioned parent coordinates
const createSameScrollDifferentParentPositioner = (
  element,
  referenceElement,
) => {
  const positioner = {
    leftRelativeToScrollContainer: null,
    topRelativeToScrollContainer: null,
    toLayoutLeft: null,
    toLayoutTop: null,
  };

  const scrollContainer = getScrollContainer(referenceElement);
  const scrollContainerIsDocument =
    scrollContainer === document.documentElement;
  const { scrollLeft, scrollTop } = scrollContainer;

  current_position: {
    const { left: elementLeft, top: elementTop } =
      element.getBoundingClientRect();

    let leftRelativeToScrollContainer;
    let topRelativeToScrollContainer;
    if (scrollContainerIsDocument) {
      leftRelativeToScrollContainer = elementLeft + scrollLeft;
      topRelativeToScrollContainer = elementTop + scrollTop;
    } else {
      const scrollContainerRect = scrollContainer.getBoundingClientRect();
      leftRelativeToScrollContainer =
        elementLeft - scrollContainerRect.left + scrollLeft;
      topRelativeToScrollContainer =
        elementTop - scrollContainerRect.top + scrollTop;
    }
    positioner.leftRelativeToScrollContainer = leftRelativeToScrollContainer;
    positioner.topRelativeToScrollContainer = topRelativeToScrollContainer;
  }

  to_layout: {
    const {
      leftRelativeToScrollContainer: referenceLeftRelativeToScrollContainer,
      topRelativeToScrollContainer: referenceTopRelativeToScrollContainer,
      leftRelativeToPositionedParent: referenceLeftRelativeToPositionedParent,
      topRelativeToPositionedParent: referenceTopRelativeToPositionedParent,
    } = createStandardElementPositioner(referenceElement);
    const ancestorFixedPosition = findAncestorFixedPosition(element);
    const referencePositionedParent = referenceElement.offsetParent;
    const elementPositionedParent = element.offsetParent;

    // left
    const { left: positionedParentLeft } =
      elementPositionedParent.getBoundingClientRect();
    const { left: referencePositionedParentLeft } =
      referencePositionedParent.getBoundingClientRect();
    const positionedParentOffsetLeft =
      referencePositionedParentLeft - positionedParentLeft;
    const layoutOffsetLeft =
      positionedParentOffsetLeft +
      referenceLeftRelativeToScrollContainer +
      referenceLeftRelativeToPositionedParent;
    positioner.toLayoutLeft = (referenceLeftWithoutScroll) => {
      const leftWithoutScroll = referenceLeftWithoutScroll - layoutOffsetLeft;
      if (ancestorFixedPosition && scrollContainerIsDocument) {
        const leftFixed = ancestorFixedPosition[0] + leftWithoutScroll;
        return leftFixed;
      }
      const left = scrollContainer.scrollLeft + scrollLeft + leftWithoutScroll;
      return left;
    };
    // top
    const { top: referencePositionedParentTop } =
      referencePositionedParent.getBoundingClientRect();
    const { top: positionedParentTop } =
      elementPositionedParent.getBoundingClientRect();
    const positionedParentOffsetTop =
      referencePositionedParentTop - positionedParentTop;
    const layoutOffsetTop =
      positionedParentOffsetTop +
      referenceTopRelativeToScrollContainer +
      referenceTopRelativeToPositionedParent;
    positioner.toLayoutTop = (referenceTopWithoutScroll) => {
      const topWithoutScroll = referenceTopWithoutScroll - layoutOffsetTop;
      if (ancestorFixedPosition && scrollContainerIsDocument) {
        const topFixed = ancestorFixedPosition[1] + topWithoutScroll;
        return topFixed;
      }
      const top = scrollContainer.scrollTop + scrollTop + topWithoutScroll;
      return top;
    };
  }

  return positioner;
};

// Scenario 3: Different scroll container, same positioned parent
// The DOM positioning is the same, but coordinate system reference differs
const createDifferentScrollSameParentPositioner = (
  element,
  referenceElement,
) => {
  const scrollContainer = getScrollContainer(element);
  const scrollContainerIsDocument =
    scrollContainer === document.documentElement;
  const referenceScrollContainer = getScrollContainer(referenceElement);
  const elementRect = element.getBoundingClientRect();
  const { scrollLeft, scrollTop } = scrollContainer;
  const referenceScrollContainerRect =
    referenceScrollContainer.getBoundingClientRect();
  const ancestorFixedPosition = findAncestorFixedPosition(element);

  // Calculate element positions relative to reference element's scroll container
  const leftRelativeToScrollContainer =
    elementRect.left -
    referenceScrollContainerRect.left +
    referenceScrollContainer.scrollLeft;
  const topRelativeToScrollContainer =
    elementRect.top -
    referenceScrollContainerRect.top +
    referenceScrollContainer.scrollTop;

  // Since positioned parent is the same, layout coordinates are simple
  const toLayoutLeft = (leftWithoutScroll) => {
    const left =
      leftWithoutScroll -
      leftRelativeToScrollContainer +
      leftRelativeToPositionedParent;
    if (ancestorFixedPosition && scrollContainerIsDocument) {
      return ancestorFixedPosition[0] + left;
    }
    return scrollLeft + left;
  };
  const toLayoutTop = (topWithoutScroll) => {
    const top =
      topWithoutScroll -
      topRelativeToScrollContainer +
      topRelativeToPositionedParent;
    if (ancestorFixedPosition && scrollContainerIsDocument) {
      return ancestorFixedPosition[1] + top;
    }
    return scrollTop + top;
  };

  // Other properties using reference element's coordinate system
  const positionedParent = referenceElement.offsetParent;
  const positionedParentRect = positionedParent.getBoundingClientRect();
  // Calculate element position relative to reference element's positioned parent
  const leftRelativeToPositionedParent =
    elementRect.left - positionedParentRect.left;
  const topRelativeToPositionedParent =
    elementRect.top - positionedParentRect.top;
  return {
    leftRelativeToScrollContainer,
    topRelativeToScrollContainer,
    toLayoutLeft,
    toLayoutTop,
    leftRelativeToPositionedParent,
    topRelativeToPositionedParent,
  };
};

// Scenario 4: Both different - most complex case
// Both coordinate system and DOM positioning differ
const createFullyDifferentPositioner = (element, referenceElement) => {
  const scrollContainer = getScrollContainer(element);
  const referenceScrollContainer = getScrollContainer(referenceElement);
  const referencePositionedParent = referenceElement.offsetParent;
  const elementPositionedParent = element.offsetParent;
  const { scrollLeft, scrollTop } = scrollContainer;
  const elementRect = element.getBoundingClientRect();
  const referenceScrollContainerRect =
    referenceScrollContainer.getBoundingClientRect();
  const scrollContainerIsDocument =
    scrollContainer === document.documentElement;
  const ancestorFixedPosition = findAncestorFixedPosition(element);

  const leftRelativeToScrollContainer =
    elementRect.left -
    referenceScrollContainerRect.left +
    referenceScrollContainer.scrollLeft;
  const topRelativeToScrollContainer =
    elementRect.top -
    referenceScrollContainerRect.top +
    referenceScrollContainer.scrollTop;
  // Calculate element position relative to reference element's positioned parent (for coordinate conversion)
  const referencePositionedParentRect =
    referencePositionedParent.getBoundingClientRect();
  const leftRelativeToPositionedParent =
    elementRect.left - referencePositionedParentRect.left;
  const topRelativeToPositionedParent =
    elementRect.top - referencePositionedParentRect.top;

  // Calculate offset between reference element's scroll container and positioned parent
  const positionedParentLeftOffsetWithScrollContainer =
    referenceScrollContainerRect.left - referencePositionedParentRect.left;
  const positionedParentTopOffsetWithScrollContainer =
    referenceScrollContainerRect.top - referencePositionedParentRect.top;

  const toLayoutLeft = (leftWithoutScroll) => {
    // Step 1: Convert from scroll-relative to reference element's positioned-parent-relative
    const referenceLeftRelativeToPositionedParent =
      leftWithoutScroll - positionedParentLeftOffsetWithScrollContainer;
    // Step 2: Convert to viewport coordinates using reference element's positioned parent
    const referenceViewportLeft =
      referencePositionedParentRect.left +
      referenceLeftRelativeToPositionedParent;
    // Step 3: Convert to element's positioned-parent-relative coordinates
    const elementPositionedParentRect =
      elementPositionedParent.getBoundingClientRect();
    const left = referenceViewportLeft - elementPositionedParentRect.left;
    if (ancestorFixedPosition && scrollContainerIsDocument) {
      return ancestorFixedPosition[0] + left;
    }
    return scrollLeft + left;
  };

  const toLayoutTop = (topWithoutScroll) => {
    // Step 1: Convert from scroll-relative to reference element's positioned-parent-relative
    const referenceTopRelativeToPositionedParent =
      topWithoutScroll - positionedParentTopOffsetWithScrollContainer;
    // Step 2: Convert to viewport coordinates using reference element's positioned parent
    const referenceViewportTop =
      referencePositionedParentRect.top +
      referenceTopRelativeToPositionedParent;
    // Step 3: Convert to element's positioned-parent-relative coordinates
    const elementPositionedParentRect =
      elementPositionedParent.getBoundingClientRect();

    const top = referenceViewportTop - elementPositionedParentRect.top;
    if (ancestorFixedPosition && scrollContainerIsDocument) {
      return ancestorFixedPosition[1] + top;
    }
    return scrollTop + top;
  };

  return {
    leftRelativeToScrollContainer,
    topRelativeToScrollContainer,
    toLayoutLeft,
    toLayoutTop,
    leftRelativeToPositionedParent,
    topRelativeToPositionedParent,
  };
};

const createStandardElementPositioner = (element) => {
  const positionedParent = element.offsetParent;
  const scrollContainer = getScrollContainer(element);
  const scrollContainerIsDocument =
    scrollContainer === document.documentElement;
  const ancestorFixedPosition = findAncestorFixedPosition(element);

  // Helper function to create the positioner object (clean, no proxy logic)
  const createStandardPositioner = ({
    // current position
    leftRelativeToPositionedParent,
    topRelativeToPositionedParent,
    // help to implement toLayoutLeft/toLayoutTop
    scrollLeft,
    scrollTop,
    positionedParentLeftOffsetWithScrollContainer,
    positionedParentTopOffsetWithScrollContainer,
    // less important properties
    leftRelativeToScrollContainer,
    topRelativeToScrollContainer,
  }) => {
    const toLayoutLeft = (leftWithoutScroll) => {
      const left =
        leftWithoutScroll - positionedParentLeftOffsetWithScrollContainer;
      if (ancestorFixedPosition && scrollContainerIsDocument) {
        return ancestorFixedPosition[0] + left;
      }
      return scrollLeft + left;
    };
    const toLayoutTop = (topWithoutScroll) => {
      const top =
        topWithoutScroll - positionedParentTopOffsetWithScrollContainer;
      if (ancestorFixedPosition && scrollContainerIsDocument) {
        return ancestorFixedPosition[1] + top;
      }
      return scrollTop + top;
    };

    return {
      leftRelativeToScrollContainer,
      topRelativeToScrollContainer,
      toLayoutLeft,
      toLayoutTop,

      leftRelativeToPositionedParent,
      topRelativeToPositionedParent,
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
    const scrollContainerIsDocument =
      scrollContainer === document.documentElement;
    const scrollLeft = scrollContainer.scrollLeft;
    const scrollTop = scrollContainer.scrollTop;

    // Calculate current element position relative to scroll container
    const leftRelativeToScrollContainer = scrollContainerIsDocument
      ? elementViewportLeft + scrollLeft
      : elementViewportLeft - scrollContainerViewportLeft + scrollLeft;
    const topRelativeToScrollContainer = scrollContainerIsDocument
      ? elementViewportTop + scrollTop
      : elementViewportTop - scrollContainerViewportTop + scrollTop;

    // Calculate static offset between positioned parent and scroll container
    // This offset should be independent of scroll position
    let staticOffsetX;
    let staticOffsetY;
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

    return createStandardPositioner({
      leftRelativeToScrollContainer,
      topRelativeToScrollContainer,
      scrollLeft,
      scrollTop,
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
    const scrollLeft = scrollContainer.scrollLeft;
    const scrollTop = scrollContainer.scrollTop;

    // Element position relative to scroll container (handle document vs custom container)
    const leftRelativeToScrollContainer = scrollContainerIsDocument
      ? elementRect.left + scrollLeft
      : elementRect.left - positionedParentRect.left + scrollLeft;
    const topRelativeToScrollContainer = scrollContainerIsDocument
      ? elementRect.top + scrollTop
      : elementRect.top - positionedParentRect.top + scrollTop;
    // No offset between positioned parent and scroll container (they are the same)
    const positionedParentLeftOffsetWithScrollContainer = 0;
    const positionedParentTopOffsetWithScrollContainer = 0;

    // Element position relative to positioned parent (which is also the scroll container)
    const leftRelativeToPositionedParent =
      elementRect.left - positionedParentRect.left;
    const topRelativeToPositionedParent =
      elementRect.top - positionedParentRect.top;

    return createStandardPositioner({
      scrollLeft,
      scrollTop,
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
    const scrollLeft = scrollContainer.scrollLeft;
    const scrollTop = scrollContainer.scrollTop;

    // Calculate element position relative to scroll container (handle document vs custom container)
    const leftRelativeToScrollContainer = scrollContainerIsDocument
      ? elementRect.left + scrollLeft
      : elementRect.left - scrollContainerRect.left + scrollLeft;
    const topRelativeToScrollContainer = scrollContainerIsDocument
      ? elementRect.top + scrollTop
      : elementRect.top - scrollContainerRect.top + scrollTop;
    // Calculate offset from positioned parent to scroll container (handle document vs custom container)
    const positionedParentLeftOffsetWithScrollContainer =
      scrollContainerIsDocument
        ? positionedParentRect.left
        : scrollContainerRect.left - positionedParentRect.left;
    const positionedParentTopOffsetWithScrollContainer =
      scrollContainerIsDocument
        ? positionedParentRect.top
        : scrollContainerRect.top - positionedParentRect.top;

    // Calculate element position relative to positioned parent
    const leftRelativeToPositionedParent =
      elementRect.left - positionedParentRect.left;
    const topRelativeToPositionedParent =
      elementRect.top - positionedParentRect.top;

    return createStandardPositioner({
      leftRelativeToScrollContainer,
      topRelativeToScrollContainer,
      scrollLeft,
      scrollTop,
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

// Helper function to check if ancestor has a position: fixed
const findAncestorFixedPosition = (element) => {
  let current = element.parentElement;
  while (current && current !== document.documentElement) {
    const computedStyle = window.getComputedStyle(current);
    if (computedStyle.position === "fixed") {
      const { left, top } = current.getBoundingClientRect();
      return [left, top];
    }
    current = current.parentElement;
  }
  return null;
};
