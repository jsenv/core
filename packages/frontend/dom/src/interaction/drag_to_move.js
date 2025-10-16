import { getScrollContainerVisibleArea } from "../position/dom_coords.js";
import { getScrollContainer } from "../scroll/scroll_container.js";
import { initDragConstraints } from "./drag_constraint.js";
import { createDragGestureController } from "./drag_gesture.js";
import { applyStickyFrontiersToVisibleArea } from "./sticky_frontiers.js";

export const createDragToMoveGestureController = ({
  stickyFrontiers = true,
  // Padding to reduce the visible area constraint by this amount (applied after sticky frontiers)
  // This creates an invisible margin around the visible area where elements cannot be dragged
  visibleAreaPadding = 0,
  // constraints,
  areaConstraintElement,
  areaConstraint = "scroll",
  customAreaConstraint,
  obstaclesContainer,
  obstacleAttributeName = "data-drag-obstacle",
  // Visual feedback line connecting mouse cursor to the moving grab point when constraints prevent following
  // This provides intuitive feedback during drag operations when the element cannot reach the mouse
  // position due to obstacles, boundaries, or other constraints. The line originates from where the mouse
  // initially grabbed the element, but moves with the element to show the current anchor position.
  // It becomes visible when there's a significant distance between mouse and grab point.
  showConstraintFeedbackLine = true,
  showDebugMarkers = true,
  ...options
} = {}) => {
  const initGrabToMoveElement = (dragGesture, { element, elementProxy }) => {
    const direction = dragGesture.gestureInfo.direction;
    const dragGestureName = dragGesture.gestureInfo.name;
    const scrollContainer = dragGesture.gestureInfo.scrollContainer;

    let elementWidth;
    let elementHeight;
    {
      const updateElementDimension = () => {
        const elementRect = (elementProxy || element).getBoundingClientRect();
        elementWidth = elementRect.width;
        elementHeight = elementRect.height;
      };
      updateElementDimension();
      dragGesture.addBeforeDragCallback(updateElementDimension);
    }

    let visibleArea;
    {
      const updateVisibleArea = () => {
        const visibleAreaBase = getScrollContainerVisibleArea(scrollContainer);
        let visibleAreaCurrent = visibleAreaBase;
        if (stickyFrontiers) {
          visibleAreaCurrent = applyStickyFrontiersToVisibleArea(
            visibleAreaCurrent,
            {
              scrollContainer,
              direction,
              dragGestureName,
            },
          );
        }
        if (visibleAreaPadding > 0) {
          visibleAreaCurrent = {
            left: visibleAreaCurrent.left + visibleAreaPadding,
            top: visibleAreaCurrent.top + visibleAreaPadding,
            right: visibleAreaCurrent.right - visibleAreaPadding,
            bottom: visibleAreaCurrent.bottom - visibleAreaPadding,
          };
        }
        visibleArea = visibleAreaCurrent;
      };
      updateVisibleArea();
      dragGesture.addBeforeDragCallback(updateVisibleArea);
    }

    let elementLeftWithoutScrollAtGrab;
    let elementTopWithoutScrollAtGrab;
    let positioner;
    {
      positioner = createElementPositioner(element, elementProxy);
      elementLeftWithoutScrollAtGrab = positioner.leftRelativeToScrollContainer;
      elementTopWithoutScrollAtGrab = positioner.topRelativeToScrollContainer;
    }

    let moveConverter;
    {
      const { grabScrollLeft, grabScrollTop } = dragGesture.gestureInfo;

      const toElementLeft = (moveX) =>
        elementLeftWithoutScrollAtGrab + moveX + grabScrollLeft;
      const toElementTop = (moveY) =>
        elementTopWithoutScrollAtGrab + moveY + grabScrollTop;
      const fromElementLeft = (left) =>
        left - elementLeftWithoutScrollAtGrab - grabScrollLeft;
      const fromElementTop = (top) =>
        top - elementTopWithoutScrollAtGrab - grabScrollTop;
      moveConverter = {
        toElementLeft,
        toElementTop,
        fromElementLeft,
        fromElementTop,
      };
    }

    // TODO: will be the diff between elementToImpact and elementVisuallyImpacted
    let visualOffsetX = 0;
    let visualOffsetY = 0;

    // Set up dragging attribute
    (elementProxy || element).setAttribute("data-grabbed", "");
    dragGesture.addReleaseCallback(() => {
      (elementProxy || element).removeAttribute("data-grabbed");
    });

    const dragConstraints = initDragConstraints(dragGesture, {
      areaConstraintElement: areaConstraintElement || scrollContainer,
      areaConstraint,
      customAreaConstraint,
      obstaclesContainer: obstaclesContainer || scrollContainer,
      obstacleAttributeName,
      showConstraintFeedbackLine,
      showDebugMarkers,
    });
    dragGesture.addBeforeDragCallback(
      (
        moveXRequested,
        moveYRequested,
        { limitMoveX, limitMoveY, dragEvent },
      ) => {
        const [moveXConstrained, moveYConstrained] =
          dragConstraints.applyConstraints(moveXRequested, moveYRequested, {
            elementWidth,
            elementHeight,
            moveConverter,
            visibleArea,
            hasCrossedVisibleAreaLeftOnce,
            hasCrossedVisibleAreaTopOnce,
            dragEvent,
          });
        limitMoveX(moveXConstrained);
        limitMoveY(moveYConstrained);
      },
    );

    // Will be used for dynamic constraints on sticky elements
    let hasCrossedVisibleAreaLeftOnce = false;
    let hasCrossedVisibleAreaTopOnce = false;
    const dragToMove = (gestureInfo) => {
      const {
        isGoingDown,
        isGoingUp,
        isGoingLeft,
        isGoingRight,
        moveX,
        moveY,
      } = gestureInfo;
      const elementLeft = moveConverter.toElementLeft(moveX);
      const elementTop = moveConverter.toElementTop(moveY);
      const elementRight = elementLeft + elementWidth;
      const elementBottom = elementTop + elementHeight;
      const elementLeftLayout = positioner.toLayoutLeft(elementLeft);
      const elementTopLayout = positioner.toLayoutTop(elementTop);

      hasCrossedVisibleAreaLeftOnce =
        hasCrossedVisibleAreaLeftOnce || elementLeft < visibleArea.left;
      hasCrossedVisibleAreaTopOnce =
        hasCrossedVisibleAreaTopOnce || elementTop < visibleArea.top;

      // Helper function to handle auto-scroll and element positioning for an axis
      const moveAndKeepIntoView = (axis) => {
        keep_into_view: {
          const scrollProperty = axis === "x" ? "scrollLeft" : "scrollTop";
          const currentScroll =
            axis === "x"
              ? scrollContainer.scrollLeft
              : scrollContainer.scrollTop;
          const isGoingPositive = axis === "x" ? isGoingRight : isGoingDown;
          const isGoingNegative = axis === "x" ? isGoingLeft : isGoingUp;

          if (isGoingPositive) {
            const elementEnd = axis === "x" ? elementRight : elementBottom;
            const visibleAreaEnd =
              axis === "x" ? visibleArea.right : visibleArea.bottom;

            if (elementEnd > visibleAreaEnd) {
              const scrollAmountNeeded = elementEnd - visibleAreaEnd;
              const scroll = currentScroll + scrollAmountNeeded;
              // console.log(
              //   `Scrolling ${scrollProperty} from ${currentScroll} to ${scroll} (amount: ${scrollAmountNeeded})`,
              // );
              scrollContainer[scrollProperty] = scroll;
            }
          } else if (isGoingNegative) {
            const elementStart = axis === "x" ? elementLeft : elementTop;
            const visibleAreaStart =
              axis === "x" ? visibleArea.left : visibleArea.top;
            const canAutoScrollNegative =
              axis === "x"
                ? !element.hasAttribute("data-sticky-left") ||
                  hasCrossedVisibleAreaLeftOnce
                : !element.hasAttribute("data-sticky-top") ||
                  hasCrossedVisibleAreaTopOnce;

            if (canAutoScrollNegative && elementStart < visibleAreaStart) {
              const scrollAmountNeeded = visibleAreaStart - elementStart;
              const scroll = Math.max(0, currentScroll - scrollAmountNeeded);
              // console.log(
              //   `Scrolling ${scrollProperty} from ${currentScroll} to ${scroll} (amount: ${scrollAmountNeeded})`,
              // );
              scrollContainer[scrollProperty] = scroll;
            }
          }
        }
        move: {
          const styleProperty = axis === "x" ? "left" : "top";
          const visualOffset = axis === "x" ? visualOffsetX : visualOffsetY;
          const elementStart =
            axis === "x" ? elementLeftLayout : elementTopLayout;
          const elementPosition = elementStart - visualOffset;
          (elementProxy || element).style[styleProperty] =
            `${elementPosition}px`;
        }
      };

      if (direction.x) {
        moveAndKeepIntoView("x");
      }
      if (direction.y) {
        moveAndKeepIntoView("y");
      }
    };
    dragGesture.addDragCallback(dragToMove);
  };

  const dragGestureController = createDragGestureController(options);
  const dragGestureControllerGrab = dragGestureController.grab;
  dragGestureController.grab = ({ element, elementProxy, ...rest } = {}) => {
    if (!element) {
      throw new Error("element is required");
    }
    const scrollContainer = getScrollContainer(element);
    const dragGesture = dragGestureControllerGrab({
      scrollContainer,
      ...rest,
    });
    initGrabToMoveElement(dragGesture, {
      element,
      elementProxy,
    });
    return dragGesture;
  };

  return dragGestureController;
};

// We need a unique coordinate system internally
// (which is position relative to the scroll container without scrolls)
// (a sort of getBoundingClientRect scoped to the scroll container)
// but we also need to be able to set the element position
// in the DOM which might be different according to his own position + ancestor positions + usage of a proxy element
const createElementPositioner = (element, elementProxy) => {
  if (elementProxy) {
    return createProxiedElementPositioner(element, elementProxy);
  }
  return createStandardElementPositioner(element);
};

const createProxiedElementPositioner = (element, elementProxy) => {
  // Handle proxy scenario: element proxy has different positioning context

  const proxyPositionedParent = elementProxy.offsetParent;
  const proxyScrollContainer = getScrollContainer(elementProxy);
  const elementScrollContainer = getScrollContainer(element);

  const hasProxyWithDifferentScrollContainer =
    proxyScrollContainer !== elementScrollContainer;
  const hasProxyWithDifferentPositionedParent =
    proxyPositionedParent !== element.offsetParent;
  const hasProxyWithDifferentPositioningContext =
    hasProxyWithDifferentScrollContainer ||
    hasProxyWithDifferentPositionedParent;

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

  if (hasProxyWithDifferentPositioningContext) {
    // Proxy has different positioning context - handle separately
    const elementRect = element.getBoundingClientRect();
    const positionedParent = element.offsetParent;

    // Calculate element positions using element's own positioning context (for external coordinates)
    const elementScrollContainerRect =
      elementScrollContainer.getBoundingClientRect();
    const leftRelativeToScrollContainer =
      elementRect.left - elementScrollContainerRect.left;
    const topRelativeToScrollContainer =
      elementRect.top - elementScrollContainerRect.top;

    const positionedParentRect = positionedParent.getBoundingClientRect();
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
