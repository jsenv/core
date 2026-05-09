import { getScrollBox, getScrollport } from "../../position/dom_coords.js";
import { createStyleController } from "../../style/style_controller.js";
import { getScrollContainer } from "../scroll/scroll_container.js";
import { initDragConstraints } from "./drag_constraint.js";
import { createDragElementPositioner } from "./drag_element_positioner.js";
import { createDragGestureController } from "./drag_gesture.js";
import { applyStickyFrontiersToAutoScrollArea } from "./sticky_frontiers.js";

export const dragStyleController = createStyleController("drag_to_move");

/**
 * Creates a gesture controller that moves elements via drag.
 *
 * Wraps `createDragGestureController` and adds:
 * - Element translation via CSS transform (translate only; other existing transforms are preserved)
 * - Auto-scroll while dragging near scroll-container edges
 * - Constraints (area boundaries, obstacle elements)
 *
 * The returned controller exposes a `grab(options)` / `grabViaPointer(event, options)` method.
 * Key grab options:
 * - `element`: the element whose position drives layout calculations (scroll-container detection,
 *   constraints, auto-scroll). Sets `data-grabbed` during the drag.
 * - `referenceElement`: optional sticky-frontier / obstacle reference, defaults to `element`.
 * - `elementToMove`: optional different element to actually translate (e.g. a drag clone).
 *   If omitted, `element` is translated. The translate is read from `dragStyleController`
 *   at grab time so any pre-existing translate is accumulated rather than reset.
 *
 * @param {object} [options]
 * @param {boolean} [options.stickyFrontiers=true]
 *   Shrinks the auto-scroll area at sticky boundaries (elements with `data-sticky-left` /
 *   `data-sticky-top`).
 * @param {number} [options.autoScrollAreaPadding=0]
 *   Extra padding (px) subtracted from each edge of the auto-scroll trigger area.
 * @param {string|object|function} [options.areaConstraint="scroll"]
 *   Constrains where the element can be dragged.
 *   `"scroll"` — bounded by the full scroll area.
 *   `"scrollport"` — bounded by the visible viewport of the scroll container.
 *   `"none"` — no area constraint.
 *   `{left, top, right, bottom}` — fixed bounds (values may be functions receiving context).
 *   `function` — called each drag frame, must return a `{left,top,right,bottom}` object.
 * @param {Element} [options.obstaclesContainer]
 *   Container to look for obstacle elements in. Defaults to the scroll container.
 * @param {string} [options.obstacleAttributeName="data-drag-obstacle"]
 *   Attribute that marks obstacle elements.
 * @param {boolean} [options.showConstraintFeedbackLine=false]
 *   Renders a visual line when the pointer deviates from the element due to constraints.
 * @param {boolean} [options.showDebugMarkers=false]
 *   Renders debug markers for constraint regions.
 * @param {"commit"|"cancel"|"manual"} [options.releasePositionEffect="commit"]
 *   Controls what happens to the translated position on release.
 *   - `"commit"`: bakes the translate into inline styles so the element stays put (default).
 *   - `"cancel"`: discards the translate so the element snaps back to its original position.
 *   - `"manual"`: does nothing — the caller is responsible for clearing or committing
 *     the transform via `dragStyleController`.
 * @returns {object} Drag gesture controller with augmented `grab()` / `grabViaPointer()` methods.
 */
export const createDragToMoveGestureController = ({
  stickyFrontiers = true,
  autoScrollAreaPadding = 0,
  areaConstraint = "scroll",
  obstaclesContainer,
  obstacleAttributeName = "data-drag-obstacle",
  showConstraintFeedbackLine = false,
  showDebugMarkers = false,
  releasePositionEffect = "commit",
  ...options
} = {}) => {
  const initGrabToMoveElement = (
    dragGesture,
    { element, referenceElement, elementToMove, convertScrollablePosition },
  ) => {
    const scrollContainer = dragGesture.gestureInfo.scrollContainer;

    const direction = dragGesture.gestureInfo.direction;
    // elementImpacted is either an externally provided elementToMove (e.g. a drag clone)
    const elementImpacted = elementToMove || element;
    // elementImpacted is either an externally provided elementToMove
    // (e.g. a drag clone passed by the caller) or the element itself.
    // Capture any pre-existing translate so we can accumulate on top of it
    // rather than resetting it to zero on the first drag event.
    const transformAtGrab =
      dragStyleController.getUnderlyingValue(elementImpacted, "transform") ||
      {};
    const translateXAtGrab = transformAtGrab.translateX;
    const translateYAtGrab = transformAtGrab.translateY;
    dragGesture.addReleaseCallback(() => {
      if (releasePositionEffect === "cancel") {
        dragStyleController.clear(elementImpacted);
      } else if (releasePositionEffect === "commit") {
        dragStyleController.commit(elementImpacted);
      }
      // "manual": caller handles cleanup, do nothing.
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
      // Snapshot at grab time so that DOM mutations during dragging
      // (e.g. items shifting) don't change the scrollable boundary mid-drag.
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
      // scrollBox is the fixed bounding rect of the scroll container viewport.
      // scrollport is recomputed before each drag event to account for scrolling.
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
        // Build the transform to apply, preserving any transforms that were
        // already on the element before the grab (e.g. rotate from another
        // controller), and accumulating from the pre-grab translate baseline.
        const transform = { ...transformAtGrab };
        if (direction.x) {
          const leftTarget = positionedLeft;
          const leftAtGrab = dragGesture.gestureInfo.leftAtGrab;
          const leftDelta = leftTarget - leftAtGrab;
          const translateX = translateXAtGrab
            ? translateXAtGrab + leftDelta
            : leftDelta;
          transform.translateX = translateX;
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
    event,
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
      event,
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
