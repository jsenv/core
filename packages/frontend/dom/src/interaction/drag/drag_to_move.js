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

  [navi-drag-clone-wrapper] {
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
    [navi-drag-clone-wrapper] {
      box-shadow: none;
    }

    [navi-drag-clone] {
      transform: scale(1);
    }
  }
`;

/**
 * Creates a gesture controller that moves elements via drag.
 *
 * Wraps `createDragGestureController` and adds:
 * - Element translation via CSS transform (or CSS vars when `cloneOnDrag` is true)
 * - Auto-scroll while dragging near scroll-container edges
 * - Optional drop-target detection with a visual drop hint
 * - Optional drag clone: a scaled-up copy of the element is shown while
 *   dragging, and on release a View Transition animates it to the destination
 *   (scale down + slide) before the clone is removed from the DOM.
 *
 * @param {object} [options]
 * @param {boolean} [options.cloneOnDrag=false]
 *   When true, a clone of the grabbed element is created and moved instead of
 *   the element itself. The original stays in place (hidden). On release the
 *   clone animates to the drop target via the View Transitions API, then is
 *   removed. Requires `applyDropEffect` to actually reorder the DOM/state.
 * @param {boolean} [options.dropHint=false]
 *   When true, renders a visual line indicating where the item will land.
 * @param {string|null} [options.dropTargetSelector=null]
 *   CSS selector for the draggable items inside the scroll container. Required
 *   for drop-target detection and index-based callbacks.
 * @param {function} [options.onRelease]
 *   Called on every release with the gesture info object.
 * @param {function} [options.applyDropEffect]
 *   Called when the item was dropped in a position that differs from its
 *   current one (no-ops are automatically filtered out).
 *   Signature: `applyDropEffect(beforeElement, gestureInfo)`.
 *   - `beforeElement`: the element before which the grabbed item should be
 *     inserted, or `null` to insert at the end of the list.
 *   - `gestureInfo`: the full gesture info object. Also contains:
 *     - `grabElement`: the DOM element that was grabbed.
 *     - `releaseElement`: the DOM element the user was hovering over on drop
 *       (used internally to snap the clone animation; available for callers too).
 *   When `cloneOnDrag` is true this call happens inside `startViewTransition`
 *   so the DOM mutation is captured as the transition's "new" state.
 * @param {boolean} [options.stickyFrontiers=true]
 *   Shrinks the auto-scroll area at sticky boundaries.
 * @param {number} [options.autoScrollAreaPadding=0]
 *   Extra padding (px) subtracted from each edge of the auto-scroll area.
 * @param {string|object|function} [options.areaConstraint="scroll"]
 *   Constrains where the element can be dragged.
 *   `"scroll"` | `"scrollport"` | `"none"` | `{left,top,right,bottom}` | function.
 * @param {Element} [options.obstaclesContainer]
 *   Container to look for obstacle elements in. Defaults to the scroll container.
 * @param {string} [options.obstacleAttributeName="data-drag-obstacle"]
 *   Attribute that marks obstacle elements.
 * @param {boolean} [options.showConstraintFeedbackLine=false]
 *   Shows a visual line when the pointer deviates from the element due to
 *   constraints.
 * @param {boolean} [options.showDebugMarkers=false]
 *   Renders debug markers for constraint regions.
 * @param {boolean} [options.resetPositionAfterRelease=false]
 *   When true, the element returns to its original position on release instead
 *   of committing the translated position.
 * @returns {object} Drag gesture controller with an augmented `grab()` method.
 */
export const createDragToMoveGestureController = ({
  cloneOnDrag = false,
  dropHint = false,
  dropTargetSelector = null,
  onRelease,
  applyDropEffect,
  stickyFrontiers = true,
  autoScrollAreaPadding = 0,
  areaConstraint = "scroll",
  obstaclesContainer,
  obstacleAttributeName = "data-drag-obstacle",
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

      // currentBeforeElement: element before which the grabbed item will be inserted (null = end)
      // currentReleaseElement: the actual hovered drop target — used to snap the clone on release
      let currentBeforeElement;
      let currentReleaseElement;

      const clearDropHint = () => {
        currentBeforeElement = undefined;
        currentReleaseElement = undefined;
        scrollContainer.removeAttribute("data-drop-edge");
        scrollContainer.style.removeProperty("--drop-target-top");
        scrollContainer.style.removeProperty("--drop-target-bottom");
        scrollContainer.style.removeProperty("--drop-target-left");
        scrollContainer.style.removeProperty("--drop-target-width");
      };

      dragGesture.addReleaseCallback(clearDropHint);

      dragGesture.addDragCallback((gestureInfo) => {
        const items = getTargets();
        const dropTargetInfo = getDropTargetInfo(gestureInfo, items);
        gestureInfo.dropTargetInfo = dropTargetInfo || null;
        // When hovering over the grabbed element, treat it as no drop target.
        if (!dropTargetInfo || dropTargetInfo.element === element) {
          clearDropHint();
          return;
        }
        // Convert {element, edge} to a beforeElement using the items array
        // (not nextElementSibling, which breaks if non-item elements exist between items).
        //   edge "start" → insert before the hovered element
        //   edge "end"   → insert before the next item (null = append at end)
        const edge = dropTargetInfo.elementSide.y;
        const hoveredIndex = items.indexOf(dropTargetInfo.element);
        const beforeElement =
          edge === "start"
            ? dropTargetInfo.element
            : (items[hoveredIndex + 1] ?? null);
        // Detect no-op: result would leave the grabbed element in the same position.
        const elementIndex = items.indexOf(element);
        const elementNextItem = items[elementIndex + 1] ?? null;
        const isNoop =
          beforeElement === element || beforeElement === elementNextItem;
        if (isNoop) {
          clearDropHint();
          return;
        }
        // Early return if nothing changed.
        const releaseElement = dropTargetInfo.element;
        if (
          beforeElement === currentBeforeElement &&
          releaseElement === currentReleaseElement
        ) {
          return;
        }
        currentBeforeElement = beforeElement;
        currentReleaseElement = releaseElement;
        // Update drop hint position.
        // beforeElement = null → insert at end (hint after last item)
        // beforeElement = X    → insert before X (hint at top edge of X)
        const anchorEl =
          beforeElement || items.findLast((el) => el !== element);
        const anchorEdge = beforeElement !== null ? "top" : "bottom";
        const containerRect = scrollContainer.getBoundingClientRect();
        const anchorRect = anchorEl.getBoundingClientRect();
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
      });

      dragGesture.addReleaseCallback((gestureInfo) => {
        gestureInfo.grabElement = element;
        gestureInfo.beforeElement = currentBeforeElement;
        gestureInfo.releaseElement = currentReleaseElement;
      });
    }

    const direction = dragGesture.gestureInfo.direction;
    // elementImpacted is either the drag clone wrapper (cloneOnDrag) or the
    // original element. The drag system moves this element.
    const elementImpacted = elementToMove || element;
    // Capture any pre-existing translate so we can accumulate on top of it
    // rather than resetting it to zero on the first drag event.
    const transformAtGrab =
      dragStyleController.getUnderlyingValue(elementImpacted, "transform") ||
      {};
    const translateXAtGrab = transformAtGrab.translateX;
    const translateYAtGrab = transformAtGrab.translateY;
    dragGesture.addReleaseCallback(() => {
      if (cloneOnDrag) {
        // Clone cleanup is handled by the view-transition release callback.
        return;
      }
      if (resetPositionAfterRelease) {
        // Discard the translate — element snaps back.
        dragStyleController.clear(elementImpacted);
      } else {
        // Bake the translate into inline styles so the element stays put.
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
      const { beforeElement, releaseElement } = gestureInfo;
      if (beforeElement !== undefined) {
        // The View Transitions API takes two snapshots:
        //   old  — the DOM as it is right now (clone scaled-up at drag position)
        //   new  — the DOM after the callback runs
        // Between these two states the browser cross-fades and slides each
        // element that has a matching view-transition-name.
        //
        // Strategy:
        //   1. Inside the callback, snap the clone wrapper's CSS vars to the
        //      drop-target element's current rect.  This positions the wrapper
        //      exactly where the dropped item will appear, at scale 1 (because
        //      we also strip the `navi-drag-clone` attribute that applied the
        //      CSS scale(1.15) rule).
        //   2. Also call applyDropEffect so the real DOM is mutated in the same
        //      "new" snapshot — items reorder while the clone slides into place.
        //   3. After the transition finishes we remove the source placeholder
        //      and the clone wrapper.
        const viewTransition = document.startViewTransition(() => {
          if (cloneOnDrag) {
            const cloneWrapper = elementToMove;
            const clone = cloneWrapper.firstElementChild;
            // Snap the clone to the hovered drop target element before
            // applyDropEffect mutates the DOM.
            const destElement = releaseElement;
            const destRect = destElement.getBoundingClientRect();
            // Remove any residual translate left by the drag style controller
            // so the wrapper sits purely at its CSS-var position.
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
            // Stripping this attribute removes the CSS scale(1.15) rule, so
            // the browser captures the clone at scale 1 as the "new" state.
            clone.removeAttribute("navi-drag-clone");
          }
          return applyDropEffect?.(beforeElement, gestureInfo);
        });
        await viewTransition.finished;
      }
      // Unhide the original element and discard the clone wrapper.
      element.removeAttribute("navi-drag-clone-source");
      elementToMove.remove();
    });

    return dragGesture;
  };

  return dragGestureController;
};

// Creates the two-layer clone structure used when cloneOnDrag is true.
//
// Layer 1 — wrapper (navi-drag-clone-wrapper):
//   Positioned absolutely via --clone-top/--clone-left CSS vars.
//   Carries the box-shadow and size. Updated every drag frame.
//   Has a view-transition-name so the View Transitions API can animate it.
//
// Layer 2 — inner clone (navi-drag-clone):
//   A deep clone of the grabbed element.
//   Applies transform: scale(1.15) via the CSS rule for [navi-drag-clone],
//   giving the "lifted" feel. The transform-origin is set to the grab point
//   so the element expands naturally from where the user clicked.
//   On release, the `navi-drag-clone` attribute is removed inside
//   startViewTransition to drop the scale back to 1 as the "new" state.
const createDragClone = (element, pointerEvent) => {
  const rect = element.getBoundingClientRect();

  const wrapper = document.createElement("div");
  wrapper.setAttribute("navi-drag-clone-wrapper", "");
  wrapper.viewTransitionName = "navi-drag-clone-wrapper";
  wrapper.style.setProperty("--clone-top", `${rect.top}px`);
  wrapper.style.setProperty("--clone-left", `${rect.left}px`);
  wrapper.style.setProperty("--clone-width", `${rect.width}px`);
  wrapper.style.setProperty("--clone-height", `${rect.height}px`);
  // Grab point within the element — used as transform-origin so the
  // scale(1.15) expands from where the user clicked, not the element center.
  wrapper.style.setProperty(
    "--drag-origin",
    `${pointerEvent.clientX - rect.left}px ${pointerEvent.clientY - rect.top}px`,
  );

  const elementClone = element.cloneNode(true);
  elementClone.setAttribute("navi-drag-clone", "");
  elementClone.style.viewTransitionName = "navi-drag-clone";
  wrapper.appendChild(elementClone);
  document.body.appendChild(wrapper);

  return wrapper;
};
