import { getScrollBox, getScrollport } from "../../position/dom_coords.js";
import { createStyleController } from "../../style/style_controller.js";
import { getScrollContainer } from "../scroll/scroll_container.js";
import { initDragConstraints } from "./drag_constraint.js";
import { createDragElementPositioner } from "./drag_element_positioner.js";
import { createDragGestureController } from "./drag_gesture.js";
import { getDropTargetInfo } from "./drop_target_detection.js";
import { moveCSSVars } from "./move_css_vars.js";
import { applyStickyFrontiersToAutoScrollArea } from "./sticky_frontiers.js";

const dragStyleController = createStyleController("drag_to_move");

const css = /* css */ `
  .navi_drop_hint {
    position: absolute;
    top: var(--drop-hint-y);
    left: calc(var(--drop-target-left) + var(--drop-hint-margin-x, 0px));
    z-index: 10;
    display: none;
    width: calc(var(--drop-target-width) - 2 * var(--drop-hint-margin-x, 0px));
    height: var(--drop-hint-size, 3px);
    background: var(--drop-hint-background-color, #4476ff);
    border-radius: var(--drop-hint-border-radius, 2px);
    transform: translateY(-50%);
    pointer-events: none;
  }
  [data-drop-edge="top"] > .navi_drop_hint {
    display: block;
    --drop-hint-y: calc(
      var(--drop-target-top) - var(--drop-hint-margin-y, 0px)
    );
  }
  [data-drop-edge="bottom"] > .navi_drop_hint {
    display: block;
    --drop-hint-y: calc(
      var(--drop-target-bottom) + var(--drop-hint-margin-y, 0px)
    );
  }

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

  [navi-drag-clone-source] {
    visibility: hidden;
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

export const createDragToMoveGestureController = ({
  cloneOnDrag = false,
  dropHint = false,
  dropTargetSelector = null,
  onRelease,
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
  import.meta.css = css;

  const initGrabToMoveElement = (
    dragGesture,
    { element, referenceElement, elementToMove, convertScrollablePosition },
  ) => {
    const scrollContainer = dragGesture.gestureInfo.scrollContainer;

    if (dropTargetSelector) {
      const getTargets = () => {
        return Array.from(scrollContainer.querySelectorAll(dropTargetSelector));
      };
      const targets = getTargets();
      const originalIndex = targets.indexOf(element);

      const dropHintVars = [
        "--drop-hint-size",
        "--drop-hint-background-color",
        "--drop-hint-border-radius",
        "--drop-hint-margin-x",
        "--drop-hint-margin-y",
      ];
      const restoreCSSVars = moveCSSVars(
        dropHintVars,
        element,
        scrollContainer,
      );

      let dropHintEl = null;
      if (dropHint) {
        dropHintEl = document.createElement("div");
        dropHintEl.className = "navi_drop_hint";
        scrollContainer.appendChild(dropHintEl);
        dragGesture.addReleaseCallback(() => {
          dropHintEl.remove();
          restoreCSSVars();
        });
      }

      let currentPlaceholder = originalIndex;

      const updateDropTarget = (targetIndex) => {
        const items = getTargets();
        const containerRect = scrollContainer.getBoundingClientRect();
        let anchorRect;
        let anchorEdge;
        if (targetIndex === 0) {
          anchorEdge = "top";
          anchorRect = items[0].getBoundingClientRect();
        } else {
          let item;
          if (targetIndex >= items.length) {
            item = items[items.length - 1];
          } else if (targetIndex > originalIndex) {
            item = items[targetIndex];
          } else {
            item = items[targetIndex - 1];
          }
          anchorEdge = "bottom";
          anchorRect = item.getBoundingClientRect();
        }
        const scrollLeft = scrollContainer.scrollLeft;
        const scrollTop = scrollContainer.scrollTop;
        const isPositioned =
          getComputedStyle(scrollContainer).position !== "static";
        const scrollOffsetLeft = isPositioned ? scrollLeft : 0;
        const scrollOffsetTop = isPositioned ? scrollTop : 0;
        const offsetTop = anchorRect.top - containerRect.top + scrollOffsetTop;
        const offsetBottom =
          anchorRect.bottom - containerRect.top + scrollOffsetTop;
        const offsetLeft =
          anchorRect.left - containerRect.left + scrollOffsetLeft;
        scrollContainer.setAttribute("data-drop-target", targetIndex);
        scrollContainer.setAttribute("data-drop-edge", anchorEdge);
        scrollContainer.style.setProperty(
          "--drop-target-top",
          `${offsetTop}px`,
        );
        scrollContainer.style.setProperty(
          "--drop-target-bottom",
          `${offsetBottom}px`,
        );
        scrollContainer.style.setProperty(
          "--drop-target-left",
          `${offsetLeft}px`,
        );
        scrollContainer.style.setProperty(
          "--drop-target-width",
          `${anchorRect.width}px`,
        );
      };

      dragGesture.addReleaseCallback(() => {
        scrollContainer.removeAttribute("data-drop-target");
        scrollContainer.removeAttribute("data-drop-edge");
        scrollContainer.style.removeProperty("--drop-target-top");
        scrollContainer.style.removeProperty("--drop-target-bottom");
        scrollContainer.style.removeProperty("--drop-target-left");
        scrollContainer.style.removeProperty("--drop-target-width");
      });

      dragGesture.addDragCallback((gestureInfo) => {
        const items = getTargets();
        const dropTargetInfo = getDropTargetInfo(gestureInfo, items);
        gestureInfo.dropTargetInfo = dropTargetInfo || null;
        if (!dropTargetInfo) {
          return;
        }
        const newIndex =
          dropTargetInfo.elementSide.y === "end"
            ? dropTargetInfo.index + 1
            : dropTargetInfo.index;
        if (newIndex !== currentPlaceholder) {
          currentPlaceholder = newIndex;
        }
        if (currentPlaceholder === originalIndex) {
          scrollContainer.removeAttribute("data-drop-target");
          scrollContainer.removeAttribute("data-drop-edge");
          scrollContainer.style.removeProperty("--drop-target-top");
          scrollContainer.style.removeProperty("--drop-target-bottom");
          scrollContainer.style.removeProperty("--drop-target-left");
          scrollContainer.style.removeProperty("--drop-target-width");
        } else {
          updateDropTarget(currentPlaceholder);
        }
      });

      dragGesture.addReleaseCallback((gestureInfo) => {
        gestureInfo.grabElementIndex = originalIndex;
        gestureInfo.grabElement = element;
        gestureInfo.releaseElementIndex =
          currentPlaceholder !== originalIndex ? currentPlaceholder : null;
        gestureInfo.releaseElement =
          currentPlaceholder !== originalIndex
            ? (getTargets()[currentPlaceholder] ?? null)
            : null;
      });
    }

    const direction = dragGesture.gestureInfo.direction;
    // const dragGestureName = dragGesture.gestureInfo.name;
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
    event,
    ...rest
  } = {}) => {
    const scrollContainer = getScrollContainer(referenceElement || element);
    let getDragPositioner;
    if (cloneOnDrag) {
      const dragClone = createDragClone(element, {
        clientX: event ? event.clientX : 0,
        clientY: event ? event.clientY : 0,
      });
      elementToMove = dragClone;
      getDragPositioner = () => {
        return createDragElementPositioner(
          element,
          referenceElement,
          dragClone,
        );
      };
    } else {
      getDragPositioner = () => {
        return createDragElementPositioner(
          element,
          referenceElement,
          elementToMove,
        );
      };
    }
    const [
      elementScrollableLeft,
      elementScrollableTop,
      convertScrollablePosition,
    ] = getDragPositioner();
    const dragGesture = grab({
      element,
      scrollContainer,
      layoutScrollableLeft: elementScrollableLeft,
      layoutScrollableTop: elementScrollableTop,
      event,
      ...rest,
    });
    if (cloneOnDrag) {
      dragGesture.gestureInfo.elementImpacted = elementToMove;
      element.setAttribute("navi-drag-clone-source", "");
      dragGesture.addReleaseCallback(() => {
        element.removeAttribute("navi-drag-clone-source");
        elementToMove.remove();
      });
    }
    initGrabToMoveElement(dragGesture, {
      element,
      referenceElement,
      elementToMove,
      convertScrollablePosition,
    });
    if (onRelease) {
      dragGesture.addReleaseCallback(onRelease);
    }
    return dragGesture;
  };

  return dragGestureController;
};

const createDragClone = (element, pointerEvent) => {
  const rect = element.getBoundingClientRect();
  const elementClone = element.cloneNode(true);
  elementClone.setAttribute("navi-drag-clone", "");
  elementClone.style.removeProperty("view-transition-name");
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
