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

  [navi-drag-clone-source] {
    visibility: hidden;
  }

  [navi-drag-clone-alive] {
    position: absolute;
    top: var(--clone-top);
    left: var(--clone-left);
    z-index: 9999;
    width: var(--clone-width);
    height: var(--clone-height);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22);
    opacity: 0.95;
    transition: box-shadow 0.15s ease;
    pointer-events: none;
  }

  [navi-drag-clone] {
    transform: scale(1.15);
    transform-origin: var(--drag-origin);
    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @starting-style {
    [navi-drag-clone-alive] {
      box-shadow: none;
    }

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
  // Called only when the item was actually moved (grabIndex !== releaseIndex).
  // Signature: applyDropEffect(fromIndex, toIndex)
  // When cloneOnDrag is true the DOM mutation is automatically wrapped in a
  // view transition so the clone animates into the item's new position.
  applyDropEffect,
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
    const transformAtGrab =
      dragStyleController.getUnderlyingValue(elementImpacted, "transform") ||
      {};
    const translateXAtGrab = transformAtGrab.translateX;
    const translateYAtGrab = transformAtGrab.translateY;
    dragGesture.addReleaseCallback(() => {
      if (cloneOnDrag) {
        return;
      }
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
        const transform = { ...transformAtGrab };
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
    if (cloneOnDrag) {
      const dragClone = createDragClone(element, {
        clientX: event ? event.clientX : 0,
        clientY: event ? event.clientY : 0,
      });
      elementToMove = dragClone;
    }
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
    if (cloneOnDrag) {
      dragGesture.gestureInfo.elementImpacted = elementToMove;
      element.setAttribute("navi-drag-clone-source", "");
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

    dragGesture.addReleaseCallback(async (gestureInfo) => {
      const { grabElementIndex, releaseElementIndex } = gestureInfo;
      if (releaseElementIndex !== grabElementIndex) {
        const viewTransition = document.startViewTransition(() => {
          if (cloneOnDrag) {
            // Snap the wrapper to the drop target position so the browser
            // captures the clone at scale 1 at exactly the right place.
            // The view transition then animates from the dragged (scaled) old
            // state to this unscaled destination state.
            const destElement = gestureInfo.releaseElement || element;
            const destRect = destElement.getBoundingClientRect();
            const cloneWrapper = elementToMove;
            const clone = cloneWrapper.firstElementChild;
            // Clear any transform animation left from dragging so the wrapper
            // sits purely at its CSS-var position with no residual translate.
            dragStyleController.clear(cloneWrapper);
            cloneWrapper.style.setProperty(
              "--clone-left",
              `${destRect.left}px`,
            );
            cloneWrapper.style.setProperty("--clone-top", `${destRect.top}px`);
            cloneWrapper.style.setProperty(
              "--clone-width",
              `${destRect.width}px`,
            );
            cloneWrapper.style.setProperty(
              "--clone-height",
              `${destRect.height}px`,
            );
            // Removing the attribute drops the CSS scale(1.15) rule so the
            // browser captures the inner clone at scale 1.
            clone.removeAttribute("navi-drag-clone");
          }
          return applyDropEffect?.(grabElementIndex, releaseElementIndex);
        });
        await viewTransition.finished;
      }
      element.removeAttribute("navi-drag-clone-source");
      elementToMove.remove();
    });

    return dragGesture;
  };

  return dragGestureController;
};

const createDragClone = (element, pointerEvent) => {
  const rect = element.getBoundingClientRect();

  // Wrapper handles positioning via CSS vars
  const wrapper = document.createElement("div");
  wrapper.setAttribute("navi-drag-clone-alive", "");
  wrapper.viewTransitionName = "navi-drag-clone-wrapper";
  wrapper.style.setProperty("--clone-top", `${rect.top}px`);
  wrapper.style.setProperty("--clone-left", `${rect.left}px`);
  wrapper.style.setProperty("--clone-width", `${rect.width}px`);
  wrapper.style.setProperty("--clone-height", `${rect.height}px`);
  // transform-origin set to pointer position within the element for natural scale expansion
  wrapper.style.setProperty(
    "--drag-origin",
    `${pointerEvent.clientX - rect.left}px ${pointerEvent.clientY - rect.top}px`,
  );

  // Inner clone carries the visual styles (scale, shadow) and view-transition-name
  const elementClone = element.cloneNode(true);
  elementClone.setAttribute("navi-drag-clone", "");
  elementClone.style.viewTransitionName = "navi-drag-clone";
  wrapper.appendChild(elementClone);
  document.body.appendChild(wrapper);

  return wrapper;
};
