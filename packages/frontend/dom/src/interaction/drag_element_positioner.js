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
 * - An elementProxy is used (the visual element being moved differs from the logical element)
 *
 * EXPECTED API CONTRACT:
 * The calling code expects this positioner to return:
 *
 * - leftRelativeToScrollContainer/topRelativeToScrollContainer:
 *   Current coordinates of the element (or proxy) relative to the element's scroll container.
 *   When using a proxy, these coordinates represent where the proxy appears to be positioned
 *   from the perspective of the original element's coordinate system.
 *
 * - toLayoutLeft/toLayoutTop functions:
 *   Convert from the internal scroll-relative coordinates to DOM positioning coordinates.
 *   When using a proxy, these functions must convert from the element's scroll-relative coordinates
 *   to the proxy's offsetParent-relative coordinates for actual DOM positioning.
 *
 * OTHER PROPERTIES:
 * The remaining returned properties provide coordinate conversion utilities but are less critical.
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
