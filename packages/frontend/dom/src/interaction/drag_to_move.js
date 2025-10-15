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
  ...options
} = {}) => {
  const initGrabToMoveElement = (
    dragGesture,
    { element, elementToImpact = element },
  ) => {
    const direction = dragGesture.gestureInfo.direction;
    const dragGestureName = dragGesture.gestureInfo.name;
    const scrollContainer = dragGesture.gestureInfo.scrollContainer;

    let elementWidth;
    let elementHeight;
    {
      const updateElementDimension = () => {
        const elementRect = element.getBoundingClientRect();
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
    let layoutConverter;
    {
      const positioner = createElementPositioner(element, { scrollContainer });
      // Get current element positions from the positioner
      elementLeftWithoutScrollAtGrab = positioner.scrollRelativeLeft;
      elementTopWithoutScrollAtGrab = positioner.scrollRelativeTop;

      const toLayoutLeft = (leftRelativeToScrollContainer) => {
        return positioner.toLayoutLeft(leftRelativeToScrollContainer);
      };
      const toLayoutTop = (topRelativeToScrollContainer) => {
        return positioner.toLayoutTop(topRelativeToScrollContainer);
      };
      layoutConverter = {
        toLayoutLeft,
        toLayoutTop,
      };
    }

    let moveConverter;
    {
      const scrollLeftAtGrab = dragGesture.gestureInfo.grabScrollLeft;
      const scrollTopAtGrab = dragGesture.gestureInfo.grabScrollTop;
      const elementLeftWithScrollAtGrab =
        elementLeftWithoutScrollAtGrab + scrollLeftAtGrab;
      const elementTopWithScrollAtGrab =
        elementTopWithoutScrollAtGrab + scrollTopAtGrab;
      console.log({
        elementLeftWithoutScrollAtGrab,
        elementLeftWithScrollAtGrab,
      });

      const toElementLeft = (moveX) => elementLeftWithoutScrollAtGrab + moveX;
      const toElementTop = (moveY) => elementTopWithoutScrollAtGrab + moveY;
      const fromElementLeft = (left) => left - elementLeftWithScrollAtGrab;
      const fromElementTop = (top) => top - elementTopWithScrollAtGrab;
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

    // Will be used for dynamic constraints on sticky elements
    let hasCrossedVisibleAreaLeftOnce = false;
    let hasCrossedVisibleAreaTopOnce = false;

    // Set up dragging attribute
    element.setAttribute("data-grabbed", "");
    dragGesture.addReleaseCallback(() => {
      element.removeAttribute("data-grabbed");
    });

    const dragConstraints = initDragConstraints(dragGesture, {
      areaConstraintElement: areaConstraintElement || scrollContainer,
      areaConstraint,
      customAreaConstraint,
      obstaclesContainer: obstaclesContainer || scrollContainer,
      obstacleAttributeName,
      showConstraintFeedbackLine,
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
            dragEvent,
            visibleArea,
          });
        limitMoveX(moveXConstrained);
        limitMoveY(moveYConstrained);
      },
    );

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
      const elementLeftLayout = layoutConverter.toLayoutLeft(elementLeft);
      const elementTopLayout = layoutConverter.toLayoutTop(elementTop);

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
          elementToImpact.style[styleProperty] = `${elementPosition}px`;
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
  dragGestureController.grab = ({
    element,
    elementToImpact = element,
    ...rest
  } = {}) => {
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
      elementToImpact,
    });
    return dragGesture;
  };

  return dragGestureController;
};

// We need a unique coordinate system internally
// (which is position relative to the scroll container)
// but we also need to be able to set the element position
// in the DOM which might be different according to his own position + ancestor positions
const createElementPositioner = (element, { scrollContainer }) => {
  const positionedParent = element.offsetParent;
  const positionedParentRect = positionedParent.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  // Most common case: positioned parent is inside the scroll container
  if (scrollContainer.contains(positionedParent)) {
    const positionedParentViewportLeft = positionedParentRect.left;
    const positionedParentViewportTop = positionedParentRect.top;
    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const scrollContainerViewportLeft = scrollContainerRect.left;
    const scrollContainerViewportTop = scrollContainerRect.top;

    // Calculate static offset between positioned parent and scroll container
    const offsetX = positionedParentViewportLeft - scrollContainerViewportLeft;
    const offsetY = positionedParentViewportTop - scrollContainerViewportTop;

    // Get current element position using getBoundingClientRect (actual rendered position)
    const elementViewportLeft = elementRect.left;
    const elementViewportTop = elementRect.top;

    // Calculate current element position relative to positioned parent (layout coordinates)
    const layoutLeft = elementViewportLeft - positionedParentViewportLeft;
    const layoutTop = elementViewportTop - positionedParentViewportTop;

    // Calculate current element position relative to scroll container
    const scrollRelativeLeft =
      elementViewportLeft - scrollContainerViewportLeft;
    const scrollRelativeTop = elementViewportTop - scrollContainerViewportTop;

    const toScrollRelativeLeft = (leftRelativeToPositionedParent) => {
      // Convert from positioned parent coordinates to scroll container coordinates
      return leftRelativeToPositionedParent + offsetX;
    };

    const toScrollRelativeTop = (topRelativeToPositionedParent) => {
      // Convert from positioned parent coordinates to scroll container coordinates
      return topRelativeToPositionedParent + offsetY;
    };

    const toLayoutLeft = (leftRelativeToScrollContainer) => {
      // Convert from scroll container coordinates to positioned parent coordinates
      return leftRelativeToScrollContainer - offsetX;
    };

    const toLayoutTop = (topRelativeToScrollContainer) => {
      // Convert from scroll container coordinates to positioned parent coordinates
      return topRelativeToScrollContainer - offsetY;
    };

    return {
      layoutLeft,
      layoutTop,
      scrollRelativeLeft,
      scrollRelativeTop,
      toScrollRelativeLeft,
      toScrollRelativeTop,
      toLayoutLeft,
      toLayoutTop,
    };
  }

  // TODO: Handle other cases (positioned parent === scroll container, positioned parent is ancestor of scroll container)
  throw new Error(
    "Unsupported positioning configuration: positioned parent must be inside scroll container for now",
  );
};
