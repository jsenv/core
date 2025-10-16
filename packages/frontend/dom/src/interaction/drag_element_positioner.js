import { getScrollContainer } from "../scroll/scroll_container.js";

/**
 * We use a unique coordinate system internally described as:
 * "position relative to the scroll container without scrolls"
 * a sort of getBoundingClientRect() relative to the scroll container instead of being always relative to document.documentElement
 *
 * But in the end we need to convert these coordinates back to the actual layour coordinates in the DOM
 * Which might be different when offset parent position differs from scoll container position
 * (e.g. offset parent is positionned and scroll container is not, or both are positionned but not the same)
 *
 * And also very likely to happen when using an elementProxy
 * (The element being moved is not the original element)
 *
 * The code calling this helper expects the following:
 *
 * - leftRelativeToScrollContainer
 */
export const createDragElementPositioner = (element, elementProxy) => {
  if (elementProxy) {
    return createProxiedElementPositioner(element, elementProxy);
  }
  return createStandardElementPositioner(element);
};

const createProxiedElementPositioner = (element, elementProxy) => {
  // Handle proxy scenario: element proxy has different positioning context
  const elementScrollContainer = getScrollContainer(element);
  const elementPositionedParent = element.offsetParent;
  const proxyPositionedParent = elementProxy.offsetParent;
  const proxyScrollContainer = getScrollContainer(elementProxy);
  const hasDifferentScrollContainer =
    proxyScrollContainer !== elementScrollContainer;
  const hasDifferentPositionedParent =
    proxyPositionedParent !== elementPositionedParent;
  const hasDifferentPositioningContext =
    hasDifferentScrollContainer || hasDifferentPositionedParent;

  const createProxiedPositioner = ({
    leftRelativeToPositionedParent,
    topRelativeToPositionedParent,
    leftRelativeToScrollContainer,
    topRelativeToScrollContainer,
    positionedParentLeftOffsetWithScrollContainer,
    positionedParentTopOffsetWithScrollContainer,

    positionedParentLeft,
    positionedParentTop,
  }) => {
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

    const toLayoutLeft = (leftRelativeToScrollContainer) => {
      // Convert from element coordinates to proxy coordinates for positioning
      const elementLeftRelativeToPositionedParent =
        leftRelativeToScrollContainer -
        positionedParentLeftOffsetWithScrollContainer;

      // Step 1: Convert to viewport coordinates
      const elementViewportLeft =
        positionedParentLeft + elementLeftRelativeToPositionedParent;
      // Step 2: Convert to proxy positioned-parent-relative coordinates
      return elementViewportLeft - positionedParentLeft;
    };

    const toLayoutTop = (topRelativeToScrollContainer) => {
      // Convert from element coordinates to proxy coordinates for positioning
      const elementTopRelativeToPositionedParent =
        topRelativeToScrollContainer -
        positionedParentTopOffsetWithScrollContainer;

      // Step 1: Convert to viewport coordinates
      const elementViewportTop =
        positionedParentTop + elementTopRelativeToPositionedParent;
      // Step 2: Convert to proxy positioned-parent-relative coordinates
      return elementViewportTop - positionedParentTop;
    };
    return {
      leftRelativeToPositionedParent,
      topRelativeToPositionedParent,
      leftRelativeToScrollContainer,
      topRelativeToScrollContainer,
      toScrollRelativeLeft,
      toScrollRelativeTop,
      toLayoutLeft,
      toLayoutTop,
    };
  };

  if (hasDifferentPositioningContext) {
    // Proxy has different positioning context - handle separately
    const elementRect = element.getBoundingClientRect();

    // Calculate element positions using element's own positioning context (for external coordinates)
    const elementScrollContainerRect =
      elementScrollContainer.getBoundingClientRect();
    const leftRelativeToScrollContainer =
      elementRect.left - elementScrollContainerRect.left;
    const topRelativeToScrollContainer =
      elementRect.top - elementScrollContainerRect.top;

    const positionedParentRect =
      elementPositionedParent.getBoundingClientRect();
    const leftRelativeToPositionedParent =
      elementRect.left - positionedParentRect.left;
    const topRelativeToPositionedParent =
      elementRect.top - positionedParentRect.top;

    // Calculate offset between positioned parent and element's scroll container
    const positionedParentLeftOffsetWithScrollContainer =
      elementScrollContainerRect.left - positionedParentRect.left;
    const positionedParentTopOffsetWithScrollContainer =
      elementScrollContainerRect.top - positionedParentRect.top;

    // Create proxy positioner to convert from element coordinates to proxy coordinates
    const proxyPositionedParentRect =
      proxyPositionedParent.getBoundingClientRect();

    return createProxiedPositioner({
      leftRelativeToPositionedParent,
      topRelativeToPositionedParent,
      leftRelativeToScrollContainer,
      topRelativeToScrollContainer,
      positionedParentLeftOffsetWithScrollContainer,
      positionedParentTopOffsetWithScrollContainer,

      positionedParentLeft: proxyPositionedParentRect.left,
      positionedParentTop: proxyPositionedParentRect.top,
    });
  }

  return createStandardElementPositioner(element);
};

const createStandardElementPositioner = (element) => {
  const positionedParent = element.offsetParent;
  const scrollContainer = getScrollContainer(element);

  // Helper function to create the positioner object (clean, no proxy logic)
  const createStandardPositioner = ({
    leftRelativeToPositionedParent,
    topRelativeToPositionedParent,
    leftRelativeToScrollContainer,
    topRelativeToScrollContainer,
    positionedParentLeftOffsetWithScrollContainer,
    positionedParentTopOffsetWithScrollContainer,
  }) => {
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

    const toLayoutLeft = (leftRelativeToScrollContainer) => {
      return (
        leftRelativeToScrollContainer -
        positionedParentLeftOffsetWithScrollContainer
      );
    };

    const toLayoutTop = (topRelativeToScrollContainer) => {
      return (
        topRelativeToScrollContainer -
        positionedParentTopOffsetWithScrollContainer
      );
    };

    return {
      leftRelativeToPositionedParent,
      topRelativeToPositionedParent,
      leftRelativeToScrollContainer,
      topRelativeToScrollContainer,
      positionedParentLeftOffsetWithScrollContainer,
      positionedParentTopOffsetWithScrollContainer,
      toScrollRelativeLeft,
      toScrollRelativeTop,
      toLayoutLeft,
      toLayoutTop,
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
      leftRelativeToPositionedParent,
      topRelativeToPositionedParent,
      leftRelativeToScrollContainer,
      topRelativeToScrollContainer,
      positionedParentLeftOffsetWithScrollContainer,
      positionedParentTopOffsetWithScrollContainer,
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
      leftRelativeToPositionedParent,
      topRelativeToPositionedParent,
      leftRelativeToScrollContainer,
      topRelativeToScrollContainer,
      positionedParentLeftOffsetWithScrollContainer,
      positionedParentTopOffsetWithScrollContainer,
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
      leftRelativeToPositionedParent,
      topRelativeToPositionedParent,
      leftRelativeToScrollContainer,
      topRelativeToScrollContainer,
      positionedParentLeftOffsetWithScrollContainer,
      positionedParentTopOffsetWithScrollContainer,
    });
  }

  // never supposed to happen
  throw new Error(
    "Unsupported positioning configuration: positioned parent must be in a parent-child relationship or be the same.",
  );
};
