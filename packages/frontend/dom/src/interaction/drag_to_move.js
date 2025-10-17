import { getScrollContainerVisibleArea } from "../position/dom_coords.js";
import { getScrollContainer } from "../scroll/scroll_container.js";
import { initDragConstraints } from "./drag_constraint.js";
import { createDragElementPositioner } from "./drag_element_positioner.js";
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
  const initGrabToMoveElement = (
    dragGesture,
    { element, referenceElement },
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

    let positioner;
    let moveConverter;
    {
      positioner = createDragElementPositioner(element, referenceElement);

      /**
       *
       * - moveX = (dragX - grabX) + scrollContainer.scrollLeft
       * - elementLeftRequested = elementLeftWithoutScrollAtGrab + moveX
       * - elementLeftRequestedWithoutScroll = elementLeftWithoutScrollAtGrab + moveX - scrollContainer.scrollLeft
       * - dragX = (moveX - grabX) - scrollContainer.scrollLeft
       *
       */

      const [elementScrollableLeftAtGrab, elementScrollableTopAtGrab] =
        positioner.scrollablePosition;

      const toElementScrollableLeft = (moveX) =>
        elementScrollableLeftAtGrab + moveX - scrollContainer.scrollLeft;
      const toElementLeft = (moveX) => elementScrollableLeftAtGrab + moveX;
      const fromElementLeft = (left) => left - elementScrollableLeftAtGrab;

      const toElementScrollableTop = (moveY) =>
        elementScrollableTopAtGrab + moveY - scrollContainer.scrollTop;
      const toElementTop = (moveY) => elementScrollableTopAtGrab + moveY;
      const fromElementTop = (top) => top - elementScrollableTopAtGrab;

      moveConverter = {
        toElementScrollableLeft,
        toElementScrollableTop,
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
      showDebugMarkers,
      referenceElement,
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

      const elementScrollableLeft =
        moveConverter.toElementScrollableLeft(moveX);
      const elementScrollableTop = moveConverter.toElementScrollableTop(moveY);
      const elementPositionedLeft = positioner.toLeft(elementScrollableLeft);
      const elementPositionedTop = positioner.toTop(elementScrollableTop);
      console.log({
        moveX,
        elementScrollableLeft,
        elementPositionedLeft,
        elementLeft,
      });

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
            const referenceOrEl = referenceElement || element;
            const canAutoScrollNegative =
              axis === "x"
                ? !referenceOrEl.hasAttribute("data-sticky-left") ||
                  hasCrossedVisibleAreaLeftOnce
                : !referenceOrEl.hasAttribute("data-sticky-top") ||
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
            axis === "x" ? elementPositionedLeft : elementPositionedTop;
          const elementPosition = elementStart - visualOffset;
          element.style[styleProperty] = `${elementPosition}px`;
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
  const grab = dragGestureController.grab;
  dragGestureController.grab = ({
    element,
    referenceElement,
    ...rest
  } = {}) => {
    if (!element) {
      throw new Error("element is required");
    }
    const scrollContainer = getScrollContainer(referenceElement || element);
    const dragGesture = grab({
      scrollContainer,
      ...rest,
    });
    initGrabToMoveElement(dragGesture, {
      element,
      referenceElement,
    });
    return dragGesture;
  };

  return dragGestureController;
};
