import { getScrollBox, getScrollport } from "../position/dom_coords.js";
import { getScrollContainer } from "../scroll/scroll_container.js";
import { createStyleController } from "../style/style_controller.js";
import { initDragConstraints } from "./drag_constraint.js";
import {
  createDragElementPositioner,
  getOffsetBetweenTwoElements,
} from "./drag_element_positioner.js";
import { createDragGestureController } from "./drag_gesture.js";
import { applyStickyFrontiersToAutoScrollArea } from "./sticky_frontiers.js";

const dragStyleController = createStyleController("drag_to_move");

export const createDragToMoveGestureController = ({
  stickyFrontiers = true,
  // Padding to reduce the area used to autoscroll by this amount (applied after sticky frontiers)
  // This creates an invisible space around the area where elements cannot be dragged
  autoScrollAreaPadding = 0,
  // constraints,
  areaConstraint = "scroll", // "scroll" | "scrollport" | "none" | {left,top,right,bottom} | function
  obstaclesContainer,
  obstacleAttributeName = "data-drag-obstacle",
  // Visual feedback line connecting mouse cursor to the moving grab point when constraints prevent following
  // This provides intuitive feedback during drag operations when the element cannot reach the mouse
  // position due to obstacles, boundaries, or other constraints. The line originates from where the mouse
  // initially grabbed the element, but moves with the element to show the current anchor position.
  // It becomes visible when there's a significant distance between mouse and grab point.
  showConstraintFeedbackLine = true,
  showDebugMarkers = true,
  resetPositionAfterRelease = false,
  ...options
} = {}) => {
  const initGrabToMoveElement = (
    dragGesture,
    { element, referenceElement, elementToMove, convertScrollablePosition },
  ) => {
    const direction = dragGesture.gestureInfo.direction;
    const dragGestureName = dragGesture.gestureInfo.name;
    const scrollContainer = dragGesture.gestureInfo.scrollContainer;
    const elementImpacted = elementToMove || element;
    const translateXAtGrab = dragStyleController.getUnderlyingValue(
      elementImpacted,
      "transform.translateX",
    );
    const translateYAtGrab = dragStyleController.getUnderlyingValue(
      elementImpacted,
      "transform.translateY",
    );
    dragGesture.addReleaseCallback(() => {
      if (resetPositionAfterRelease) {
        dragStyleController.clear(elementImpacted);
      } else {
        dragStyleController.commit(elementImpacted);
      }
    });

    let xOffset;
    let yOffset;
    if (elementToMove) {
      // Calculate dynamic offset that accounts for scroll container position
      [xOffset, yOffset] = getOffsetBetweenTwoElements(
        element,
        elementToMove,
        scrollContainer,
      );
    }

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

    let scrollArea;
    {
      // computed at start so that scrollWidth/scrollHeight are fixed
      // even if the dragging side effects increases them afterwards
      scrollArea = {
        left: 0,
        top: 0,
        right: scrollContainer.scrollWidth,
        bottom: scrollContainer.scrollHeight,
      };
    }

    let scrollport;
    let autoScrollArea;
    {
      // for visible are we also want to snapshot the widht/height
      // and we'll add scrollContainer container scrolls during drag (getScrollport does that)
      const scrollBox = getScrollBox(scrollContainer);
      const updateScrollportAndAutoScrollArea = () => {
        scrollport = getScrollport(scrollBox, scrollContainer);
        autoScrollArea = scrollport;
        if (stickyFrontiers) {
          autoScrollArea = applyStickyFrontiersToAutoScrollArea(
            autoScrollArea,
            {
              scrollContainer,
              direction,
              dragGestureName,
            },
          );
        }
        if (autoScrollAreaPadding > 0) {
          autoScrollArea = {
            paddingLeft: autoScrollAreaPadding,
            paddingTop: autoScrollAreaPadding,
            paddingRight: autoScrollAreaPadding,
            paddingBottom: autoScrollAreaPadding,
            left: autoScrollArea.left + autoScrollAreaPadding,
            top: autoScrollArea.top + autoScrollAreaPadding,
            right: autoScrollArea.right - autoScrollAreaPadding,
            bottom: autoScrollArea.bottom - autoScrollAreaPadding,
          };
        }
      };
      updateScrollportAndAutoScrollArea();
      dragGesture.addBeforeDragCallback(updateScrollportAndAutoScrollArea);
    }

    // Set up dragging attribute
    element.setAttribute("data-grabbed", "");
    dragGesture.addReleaseCallback(() => {
      element.removeAttribute("data-grabbed");
    });

    // Will be used for dynamic constraints on sticky elements
    let hasCrossedScrollportLeftOnce = false;
    let hasCrossedScrollportTopOnce = false;
    const dragConstraints = initDragConstraints(dragGesture, {
      areaConstraint,
      obstaclesContainer: obstaclesContainer || scrollContainer,
      obstacleAttributeName,
      showConstraintFeedbackLine,
      showDebugMarkers,
      referenceElement,
    });
    dragGesture.addBeforeDragCallback(
      (layoutRequested, currentLayout, limitLayout, { dragEvent }) => {
        dragConstraints.applyConstraints(
          layoutRequested,
          currentLayout,
          limitLayout,
          {
            elementWidth,
            elementHeight,
            scrollArea,
            scrollport,
            hasCrossedScrollportLeftOnce,
            hasCrossedScrollportTopOnce,
            autoScrollArea,
            dragEvent,
          },
        );
      },
    );

    const dragToMove = (gestureInfo) => {
      const { isGoingDown, isGoingUp, isGoingLeft, isGoingRight, layout } =
        gestureInfo;
      const elementLeft = layout.left;
      const elementTop = layout.top;
      const elementRight = elementLeft + elementWidth;
      const elementBottom = elementTop + elementHeight;

      const elementScrollableLeft = layout.scrollableLeft;
      const elementScrollableTop = layout.scrollableTop;
      const [elementPositionedLeft, elementPositionedTop] =
        convertScrollablePosition(elementScrollableLeft, elementScrollableTop);

      hasCrossedScrollportLeftOnce =
        hasCrossedScrollportLeftOnce || elementLeft < scrollport.left;
      hasCrossedScrollportTopOnce =
        hasCrossedScrollportTopOnce || elementTop < scrollport.top;

      const moveAndKeepIntoView = (axis) => {
        let scroll;
        let position;
        compute_scroll: {
          const currentScroll =
            axis === "x"
              ? scrollContainer.scrollLeft
              : scrollContainer.scrollTop;
          const isGoingPositive = axis === "x" ? isGoingRight : isGoingDown;
          const isGoingNegative = axis === "x" ? isGoingLeft : isGoingUp;

          if (isGoingPositive) {
            const elementEnd = axis === "x" ? elementRight : elementBottom;
            const autoScrollAreaEnd =
              axis === "x" ? autoScrollArea.right : autoScrollArea.bottom;

            if (elementEnd > autoScrollAreaEnd) {
              const scrollAmountNeeded = elementEnd - autoScrollAreaEnd;
              scroll = currentScroll + scrollAmountNeeded;
            }
            break compute_scroll;
          }
          if (isGoingNegative) {
            const elementStart = axis === "x" ? elementLeft : elementTop;
            const autoScrollAreaStart =
              axis === "x" ? autoScrollArea.left : autoScrollArea.top;
            const referenceOrEl = referenceElement || element;
            const canAutoScrollNegative =
              axis === "x"
                ? !referenceOrEl.hasAttribute("data-sticky-left") ||
                  hasCrossedScrollportLeftOnce
                : !referenceOrEl.hasAttribute("data-sticky-top") ||
                  hasCrossedScrollportTopOnce;

            if (canAutoScrollNegative && elementStart < autoScrollAreaStart) {
              const scrollAmountNeeded = autoScrollAreaStart - elementStart;
              scroll = Math.max(0, currentScroll - scrollAmountNeeded);
            }
          }
        }
        compute_position: {
          const elementStart =
            axis === "x" ? elementPositionedLeft : elementPositionedTop;
          let elementPosition = elementStart;
          if (elementToMove) {
            const offsetWithElementToMove = axis === "x" ? xOffset : yOffset;
            elementPosition -= offsetWithElementToMove;
          }
          position = elementPosition;
        }
        return [scroll, position];
      };

      let xScroll;
      let xPosition;
      let yScroll;
      let yPosition;
      if (direction.x) {
        [xScroll, xPosition] = moveAndKeepIntoView("x");
      }
      if (direction.y) {
        [yScroll, yPosition] = moveAndKeepIntoView("y");
      }

      if (xScroll !== undefined) {
        scrollContainer.scrollLeft = xScroll;
      }
      if (yScroll !== undefined) {
        scrollContainer.scrollTop = yScroll;
      }

      const transform = {};
      if (xPosition !== undefined) {
        const leftAtGrab = dragGesture.gestureInfo.leftAtGrab;
        const moveX = xPosition - leftAtGrab;
        const translateX = translateXAtGrab ? translateXAtGrab + moveX : moveX;
        transform.translateX = translateX;
        console.log({
          leftAtGrab,
          xPosition,
        });
      }
      if (yPosition !== undefined) {
        const topAtGrab = dragGesture.gestureInfo.topAtGrab;
        const moveY = yPosition - topAtGrab;
        const translateY = translateYAtGrab ? translateYAtGrab + moveY : moveY;
        transform.translateY = translateY;
      }
      dragStyleController.set(elementImpacted, {
        transform,
      });
    };
    dragGesture.addDragCallback(dragToMove);
  };

  const dragGestureController = createDragGestureController(options);
  const grab = dragGestureController.grab;
  dragGestureController.grab = ({
    element,
    referenceElement,
    elementToMove,
    ...rest
  } = {}) => {
    if (!element) {
      throw new Error("element is required");
    }
    const scrollContainer = getScrollContainer(referenceElement || element);
    const [
      elementScrollableLeft,
      elementScrollableTop,
      convertScrollablePosition,
    ] = createDragElementPositioner(element, referenceElement, elementToMove);
    const dragGesture = grab({
      scrollContainer,
      layoutScrollableLeft: elementScrollableLeft,
      layoutScrollableTop: elementScrollableTop,
      ...rest,
    });
    initGrabToMoveElement(dragGesture, {
      element,
      referenceElement,
      elementToMove,
      convertScrollablePosition,
    });
    return dragGesture;
  };

  return dragGestureController;
};
