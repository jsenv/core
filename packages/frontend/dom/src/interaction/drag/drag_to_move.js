import { getScrollBox, getScrollport } from "../../position/dom_coords.js";
import { createStyleController } from "../../style/style_controller.js";
import { getScrollContainer } from "../scroll/scroll_container.js";
import { initDragConstraints } from "./drag_constraint.js";
import { createDragElementPositioner } from "./drag_element_positioner.js";
import { createDragGestureController } from "./drag_gesture.js";
import { applyStickyFrontiersToAutoScrollArea } from "./sticky_frontiers.js";

const dragStyleController = createStyleController("drag_to_move");

export const createDragToMoveGestureController = ({
  cloneOnDrag = false,
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
  showConstraintFeedbackLine = false,
  showDebugMarkers = false,
  resetPositionAfterRelease = false,
  ...options
} = {}) => {
  const initGrabToMoveElement = (
    dragGesture,
    { element, referenceElement, elementToMove, convertScrollablePosition },
  ) => {
    if (cloneOnDrag) {
      const { grabEvent } = dragGesture.gestureInfo;
      const clone = createDragClone(element, {
        clientX: grabEvent.clientX,
        clientY: grabEvent.clientY,
      });
      elementToMove = clone;
      dragGesture.gestureInfo.elementImpacted = clone;
      element.setAttribute("navi-drag-clone-source", "");
      dragGesture.addReleaseCallback(() => {
        element.removeAttribute("navi-drag-clone-source");
        clone.remove();
      });
    }
    const direction = dragGesture.gestureInfo.direction;
    // const dragGestureName = dragGesture.gestureInfo.name;
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
              // dragGestureName,
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
      const left = layout.left;
      const top = layout.top;
      const right = left + elementWidth;
      const bottom = top + elementHeight;

      auto_scroll: {
        hasCrossedScrollportLeftOnce =
          hasCrossedScrollportLeftOnce || left < scrollport.left;
        hasCrossedScrollportTopOnce =
          hasCrossedScrollportTopOnce || top < scrollport.top;

        const getScrollMove = (axis) => {
          const isGoingPositive = axis === "x" ? isGoingRight : isGoingDown;
          if (isGoingPositive) {
            const elementEnd = axis === "x" ? right : bottom;
            const autoScrollAreaEnd =
              axis === "x" ? autoScrollArea.right : autoScrollArea.bottom;

            if (elementEnd <= autoScrollAreaEnd) {
              return 0;
            }
            const scrollAmountNeeded = elementEnd - autoScrollAreaEnd;
            return scrollAmountNeeded;
          }

          const isGoingNegative = axis === "x" ? isGoingLeft : isGoingUp;
          if (!isGoingNegative) {
            return 0;
          }

          const referenceOrEl = referenceElement || element;
          const canAutoScrollNegative =
            axis === "x"
              ? !referenceOrEl.hasAttribute("data-sticky-left") ||
                hasCrossedScrollportLeftOnce
              : !referenceOrEl.hasAttribute("data-sticky-top") ||
                hasCrossedScrollportTopOnce;
          if (!canAutoScrollNegative) {
            return 0;
          }

          const elementStart = axis === "x" ? left : top;
          const autoScrollAreaStart =
            axis === "x" ? autoScrollArea.left : autoScrollArea.top;
          if (elementStart >= autoScrollAreaStart) {
            return 0;
          }

          const scrollAmountNeeded = autoScrollAreaStart - elementStart;
          return -scrollAmountNeeded;
        };

        let scrollLeftTarget;
        let scrollTopTarget;
        if (direction.x) {
          const containerScrollLeftMove = getScrollMove("x");
          if (containerScrollLeftMove) {
            scrollLeftTarget =
              scrollContainer.scrollLeft + containerScrollLeftMove;
          }
        }
        if (direction.y) {
          const containerScrollTopMove = getScrollMove("y");
          if (containerScrollTopMove) {
            scrollTopTarget =
              scrollContainer.scrollTop + containerScrollTopMove;
          }
        }
        // now we know what to do, do it
        if (scrollLeftTarget !== undefined) {
          scrollContainer.scrollLeft = scrollLeftTarget;
        }
        if (scrollTopTarget !== undefined) {
          scrollContainer.scrollTop = scrollTopTarget;
        }
      }

      move: {
        const { scrollableLeft, scrollableTop } = layout;
        const [positionedLeft, positionedTop] = convertScrollablePosition(
          scrollableLeft,
          scrollableTop,
        );
        const transform = {};
        if (direction.x) {
          const leftTarget = positionedLeft;
          const leftAtGrab = dragGesture.gestureInfo.leftAtGrab;
          const leftDelta = leftTarget - leftAtGrab;
          const translateX = translateXAtGrab
            ? translateXAtGrab + leftDelta
            : leftDelta;
          transform.translateX = translateX;
          // console.log({
          //   leftAtGrab,
          //   scrollableLeft,
          //   left,
          //   leftTarget,
          // });
        }
        if (direction.y) {
          const topTarget = positionedTop;
          const topAtGrab = dragGesture.gestureInfo.topAtGrab;
          const topDelta = topTarget - topAtGrab;
          const translateY = translateYAtGrab
            ? translateYAtGrab + topDelta
            : topDelta;
          transform.translateY = translateY;
        }
        dragStyleController.set(elementImpacted, {
          transform,
        });
      }
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
    const scrollContainer = getScrollContainer(referenceElement || element);
    const [
      elementScrollableLeft,
      elementScrollableTop,
      convertScrollablePosition,
    ] = createDragElementPositioner(element, referenceElement, elementToMove);
    const dragGesture = grab({
      element,
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

const css = /* css */ `
  .navi_drag_clone_wrapper {
    position: absolute;
    top: var(--clone-top);
    left: var(--clone-left);
    z-index: 9999;
    width: var(--clone-width);
    height: var(--clone-height);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    pointer-events: none;
  }

  [navi-drag-clone] {
    transform-origin: var(--drag-origin);
    pointer-events: none;
  }

  @starting-style {
    [navi-drag-clone] {
      transform: scale(1);
    }
  }
`;
const createDragClone = (element, pointerEvent) => {
  import.meta.css = css;

  const rect = element.getBoundingClientRect();
  const elementClone = element.cloneNode(true);
  elementClone.setAttribute("navi-drag-clone", "");
  // transform-origin set to pointer position within the element for natural scale expansion
  elementClone.style.setProperty(
    "--drag-origin",
    `${pointerEvent.clientX - rect.left}px ${pointerEvent.clientY - rect.top}px`,
  );

  const cloneWrapper = document.createElement("div");
  cloneWrapper.className = "navi_drag_clone_wrapper";
  cloneWrapper.style.setProperty(
    "--clone-top",
    `${rect.top + window.scrollY}px`,
  );
  cloneWrapper.style.setProperty(
    "--clone-left",
    `${rect.left + window.scrollX}px`,
  );
  cloneWrapper.style.setProperty("--clone-width", `${rect.width}px`);
  cloneWrapper.style.setProperty("--clone-height", `${rect.height}px`);
  cloneWrapper.appendChild(elementClone);
  document.body.appendChild(cloneWrapper);

  return cloneWrapper;
};
