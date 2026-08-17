/**
 * A drag, and what it is FOR.
 *
 * What a hand does is always the same — pick the thing up, carry it, let go — so
 * the gesture is not what distinguishes these. What distinguishes them is the
 * outcome the caller asked for, and that is what `startDragTo` takes:
 *
 * - **move**: it stays where it was put. The element ITSELF travels and keeps the
 *   place the hand gave it.
 * - **reorder**: it takes a place in a list. A COPY travels while the original
 *   keeps its place in the layout, which is what makes the gesture possible at
 *   all — nothing else moves while the hand looks for a place, so there is a
 *   stable row of items to look between.
 * - **toss**: it is gotten rid of. The same copy, for the opposite reason: the
 *   original stays until the answer says it is really gone.
 *
 * The caller lists which outcomes ITS element can answer, and only the machinery
 * those need runs: no copy for a move, no drop hint for something that can only be
 * thrown away, no landing looked for where nothing lands. `reorder` and `toss`
 * combine (dropped on a row, or thrown off the screen); `move` and `reorder` cannot
 * both be true of one release, and the caller is the one who must not ask for both.
 *
 * `createDragToMoveGestureController` below is the layer under all of that — the
 * translation, the auto-scroll, the constraints — and stays usable on its own for
 * anything that is none of the three (a table column being dragged, a sticky
 * frontier being moved).
 */

import { getScrollBox, getScrollport } from "../../position/dom_coords.js";
import { createStyleController } from "../../style/style_controller.js";
import { getScrollContainer } from "../scroll/scroll_container.js";
import { dragAfterIntent } from "./drag_after_intent.js";
import { initDragConstraints } from "./drag_constraint.js";
import { createDragElementPositioner } from "./drag_element_positioner.js";
import {
  createDragGestureController,
  isPrimaryButtonEvent,
} from "./drag_gesture.js";
import { getDropTargetInfo } from "./drop_target_detection.js";
import { moveCSSVars } from "./move_css_vars.js";
import { applyStickyFrontiersToAutoScrollArea } from "./sticky_frontiers.js";

const dragStyleController = createStyleController("drag_to_move");

// How long the copy takes to leave the screen, and to come back. Written into the
// CSS below from here: the flight has to be waited for, and a duration living only
// in a stylesheet is a timing JS cannot read reliably.
const TOSS_DURATION_MS = 320;
// Far enough to be off any screen, in the direction the hand was going.
const TOSS_DISTANCE = 900;

const css = /* css */ `
  /* IN THE PAGE, NOT IN THE LIST: the hint lands on the edge of a row, which
     for the last one is the very bottom of the scroll area — drawn inside it,
     the line would push the scrollable area a few pixels further and make a
     scrollbar appear (or hide the hint under it) exactly when one is trying to
     drop at the end. Placed in the body and positioned in viewport
     coordinates, it can sit anywhere, overhang the list, and cost nothing to
     the layout. Fixed, like the clone it accompanies. */
  .navi_drop_hint {
    /* A popover, so it lands in the top layer: no z-index to bid against the
       page, and nothing it can be hidden behind. Shown BEFORE the clone, which
       is what puts the clone above it — the top layer stacks in the order
       things are shown, and the item being carried should pass over the line
       rather than under it. The UA styles for [popover] have to be undone:
       inset:0, margin:auto, a border and a background of its own. */
    position: fixed;
    inset: auto;
    top: var(--drop-hint-y);
    left: calc(var(--drop-target-left) + var(--drop-hint-margin-x, 0px));
    display: none;
    box-sizing: border-box;
    width: calc(var(--drop-target-width) - 2 * var(--drop-hint-margin-x, 0px));
    height: var(--drop-hint-size, 3px);
    margin: 0;
    padding: 0;
    color: inherit;
    background: var(--drop-hint-background-color, #4476ff);
    border: none;
    border-radius: var(--drop-hint-border-radius, 2px);
    transform: translateY(-50%);
    pointer-events: none;
    overflow: visible;
  }
  .navi_drop_hint[data-drop-edge]:popover-open {
    display: block;
  }
  .navi_drop_hint[data-drop-edge="top"] {
    --drop-hint-y: calc(
      var(--drop-target-top) - var(--drop-hint-margin-y, 0px)
    );
  }
  .navi_drop_hint[data-drop-edge="bottom"] {
    --drop-hint-y: calc(
      var(--drop-target-bottom) + var(--drop-hint-margin-y, 0px)
    );
  }
  /* A chevron at each end, pointing in: the line alone is easy to lose against
     a list of borders and separators, two arrows read as "here" at a glance
     (same idea as the table's column drop preview). They overhang the line,
     which costs nothing now that the hint is out of the scrollable area — and
     the more they stick out, the easier they are to spot. */
  .navi_drop_hint_cap {
    position: absolute;
    top: 50%;
    display: flex;
    color: var(--drop-hint-background-color, #4476ff);
    translate: 0 -50%;
  }
  .navi_drop_hint_cap svg {
    width: var(--drop-hint-arrow-size, 11px);
    height: var(--drop-hint-arrow-size, 11px);
  }
  .navi_drop_hint_cap[data-side="start"] {
    left: calc(-1 * var(--drop-hint-arrow-size, 11px));
    rotate: -90deg;
  }
  .navi_drop_hint_cap[data-side="end"] {
    right: calc(-1 * var(--drop-hint-arrow-size, 11px));
    rotate: 90deg;
  }

  /* WHO CAN START A DRAG, said in the cursor.
     A handle drags on the spot, so it shows the hand. A source only drags once
     the intent shows (a few pixels of travel, or a long press) — a plain click
     stays a click — but the text inside it cannot be selected (the gesture takes
     the pointer), so an I-beam over it would promise something that does not
     happen: it reads as a plain surface instead. An opted-out area keeps both
     its cursor and its selection, and never starts a drag (see the check in
     startDragTo).
     Controls inside a source keep their own cursor: cursor is inherited, and
     anything setting its own (a button's pointer) wins on itself.
     Only the resting cursor is set here: what it becomes once a drag is under
     way belongs to the gesture (see the backdrop in drag_gesture.js), the only
     thing that knows a drag actually started. */
  [data-drag-handle] {
    cursor: grab;
  }
  [data-drag-source] {
    cursor: default;
    user-select: none;
  }
  [data-drag-ignore] {
    cursor: auto;
    user-select: auto;
  }

  [navi-drag-clone-source] {
    visibility: hidden;
  }

  [navi-drag-clone-wrapper] {
    /* Also a popover (see .navi_drop_hint): in the top layer it is over the
       page whatever the page's own stacking is, and the coordinates it is
       given are viewport ones — which is what the pointer carrying it works
       in. Same UA-style reset as the hint. */
    position: fixed;
    inset: auto;
    top: var(--clone-top);
    left: var(--clone-left);
    box-sizing: border-box;
    width: var(--clone-width);
    height: var(--clone-height);
    margin: 0;
    padding: 0;
    color: inherit;
    background: transparent;
    border: none;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22);
    opacity: 0.95;
    transition: box-shadow 0.15s ease;
    pointer-events: none;
    /* Nothing in a copy being carried by a pointer is text to select: the
       selection belongs to the original, which is still in the page. This is the
       one place the rule is unconditional — an element that can be dragged is
       usually selectable too (a link is both), and forcing it there would take
       away a selection made from outside the element.  */
    user-select: none;
    overflow: visible;
  }

  /* Ce qui a été lancé: il continue dans la direction du geste jusqu'à sortir de
     l'écran, et revient par le même chemin si la réponse refuse. */
  [navi-drag-clone-wrapper][data-tossed] {
    transition:
      translate ${TOSS_DURATION_MS}ms ease-out,
      opacity ${TOSS_DURATION_MS}ms ease-out;
  }
  [navi-drag-clone-wrapper][data-tossed="away"] {
    opacity: 0;
  }

  [navi-drag-clone] {
    transform: scale(var(--drag-clone-scale, 1.03));
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
// At module scope, not inside startDragTo: the cursor rules above say who
// can start a drag, and they have to be true BEFORE anyone drags anything.
import.meta.css = css;

const dragCSSVars = [
  "--drop-hint-size",
  "--drop-hint-background-color",
  "--drop-hint-border-radius",
  "--drop-hint-margin-x",
  "--drop-hint-margin-y",
  "--drop-hint-arrow-size",
  "--drag-clone-scale",
];

/**
 * Starts a drag-to-reorder interaction on a list item.
 *
 * Handles the full reorder UX:
 * - Activates only once the intent is established — a short movement with a mouse, a long
 *   press with a finger (see `dragAfterIntent`), so that neither a click nor a scroll
 *   reorders anything by accident.
 * - Clones the grabbed element and moves the clone while the original stays hidden in place
 *   (keeps the layout intact so other items don't shift during the drag).
 * - CSS vars (`--drop-hint-size`, `--drop-hint-background-color`, etc.) are read from the
 *   dragged element and moved to `document.documentElement` for the duration of the drag so
 *   the drop-hint and clone — both in `document.body` — can inherit them.
 * - Shows a drop-hint line indicating where the item will land.
 * - Drop-target detection is intersection-based: the clone's bounding rect is compared
 *   against every item that matches `itemSelector` in the scroll container.
 * - No-ops are filtered: releasing on the grabbed element itself, or in a position that
 *   would leave it at exactly the same index, never triggers `onReorder`.
 * - On a valid drop, the clone animates to the drop position via the View Transitions API,
 *   `onReorder` is called inside the transition callback so the DOM update and the animation
 *   are captured together, then the clone is removed.
 * - On a cancelled drop (pointer released with no valid target), the clone is removed
 *   immediately without calling `onReorder`.
 *
 * IDs are used as the bridge between DOM elements and JS state because:
 * - Not all DOM elements matching `itemSelector` may be valid drop targets
 *   (holes in the structure), so DOM indices don't reliably map to state indices.
 * - Virtual lists render fewer DOM nodes than the total item count, so
 *   DOM-index-based counting would be wrong.
 *
 * Any option not listed below is forwarded to `createDragToMoveGestureController`
 * (`areaConstraint`, `autoScrollAreaPadding`, `stickyFrontiers`…), except
 * `releasePositionEffect`, always `"manual"` here: what moves is the clone, and it
 * is removed on release, so there is no position to commit or cancel.
 *
 * @param {PointerEvent} event
 *   The `pointerdown` event that may become a reorder.
 * @param {object} options
 * @param {Element} [options.draggedElement=event.currentTarget]
 *   The list item to drag.
 * @param {Element} [options.containerElement=draggedElement.parentElement]
 *   Element searched with `itemSelector` to find the items to drop between.
 * @param {string} [options.itemSelector]
 *   CSS selector that matches all list items inside `containerElement`.
 *   Used for drop-target detection and no-op filtering. Left out, nothing is a
 *   drop target: no hint is drawn and no reorder can be answered — which is what
 *   a drag that only ever throws the thing away asks for.
 * @param {function} options.getItemId
 *   Returns the stable ID for a given DOM element.
 *   Signature: `getItemId(element) → id`.
 * @param {function} options.onReorder
 *   Called when the user drops the item in a new position.
 *   Signature: `onReorder(fromId, toId, syncCloneWithDropTarget)`.
 *   - `fromId`: stable ID of the dragged item.
 *   - `toId`: stable ID of the item to insert before, or `null` to append at the end.
 *   - `syncCloneWithDropTarget`: call it synchronously inside a
 *     `document.startViewTransition` callback, next to the DOM mutation, so the
 *     clone is captured at its landing position.
 * @param {(detail: {gestureInfo: object, dropTarget: Element|null}) => "reorder"|"toss"|"cancel"} [options.resolveDrop]
 *   What THIS release means, when the answer is not simply "a target was found or
 *   not": the same grab can be meant to reorder or to get rid of the thing, and
 *   only the caller knows which — far and fast is a throw, over a row is a move.
 *   Left out, a drop target reorders and anything else is cancelled.
 * @param {(detail: {gestureInfo: object}) => Promise|void} [options.onToss]
 *   The release was a throw. The clone leaves the screen the way it was thrown
 *   while this runs; it comes back if the promise rejects, because the thing still
 *   exists and the screen has to say so.
 * @param {object} [options.direction={ x: false, y: true }]
 *   Axes along which dragging is allowed. Passed to `createDragToMoveGestureController`.
 * @param {number} [options.threshold=5]
 *   Distance (px) a mouse must travel before the press becomes a drag.
 * @param {boolean|"if-touch"} [options.longPress="if-touch"]
 *   Which pointers start the drag by holding still instead of by travelling.
 * @param {number} [options.longPressDelay=400]
 *   How long (ms) such a pointer must stay down.
 * @param {number} [options.longPressSlop=8]
 *   How far (px) it may drift during that wait before the press is abandoned.
 * @param {function} [options.onPressStart]
 *   The pointer went down and the wait began (a cue that the press counts).
 * @param {function} [options.onPressCancel]
 *   The pointer moved or lifted before the wait was over.
 * @param {function} [options.onPress]
 *   The wait completed and the item is now held (haptics, scale…).
 */

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
 * A `transform` already on the moved element (rotate, scale…) is preserved and does
 * not disturb the movement. `rotate` and `scale` set as individual CSS properties do:
 * they apply outside `transform`, where nothing the gesture writes can reach them —
 * put those on a child element instead (a warning says so in dev).
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
 * @param {"commit"|"cancel"|"cancel-animated"|"manual"} [options.releasePositionEffect="commit"]
 *   Controls what happens to the translated position on release.
 *   - `"commit"`: bakes the translate into inline styles so the element stays put (default).
 *   - `"cancel"`: discards the translate so the element snaps back to its original position.
 *   - `"cancel-animated"`: same, travelling back to it over `cancelAnimationDuration`.
 *   - `"manual"`: does nothing — the caller is responsible for clearing or committing
 *     the transform via `dragStyleController`.
 * @param {number} [options.cancelAnimationDuration=200]
 *   Duration (ms) of the way back for `"cancel-animated"`.
 * @param {string} [options.cancelAnimationEasing="ease-out"]
 *   Easing of the way back for `"cancel-animated"`.
 * @returns {object} Drag gesture controller with augmented `grab()` / `grabViaPointer()` methods.
 *
 * `gestureInfo` gains `cancelPosition()`, `commitPosition()` and
 * `cancelPositionAnimated({duration, easing})` — the last returns the `Animation`
 * playing the way back (`null` when the element was already home), so a caller
 * on `"manual"` can decide between thrown and put back, and still await the
 * landing.
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
  cancelAnimationDuration = 200,
  cancelAnimationEasing = "ease-out",
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
    const transformAtGrab = dragStyleController.getUnderlyingValue(
      elementImpacted,
      "transform",
    );
    const translateXAtGrab = transformAtGrab.translateX;
    const translateYAtGrab = transformAtGrab.translateY;
    if (import.meta.dev) {
      warnAboutTransformsOutsideTransform(elementImpacted);
    }

    const cancelPosition = () => {
      dragStyleController.clear(elementImpacted);
    };
    // Reading the transform on either side of the clear is what lets this work
    // without knowing anything about the element: how it looked while held and
    // how it looks once let go are both just computed transforms, and the
    // animation has only to bridge the two.
    const cancelPositionAnimated = ({
      duration = cancelAnimationDuration,
      easing = cancelAnimationEasing,
    } = {}) => {
      const transformWhileHeld = getComputedStyle(elementImpacted).transform;
      cancelPosition();
      const transformAtRest = getComputedStyle(elementImpacted).transform;
      if (transformWhileHeld === transformAtRest) {
        return null;
      }
      // No fill: the element already sits at its resting transform, the
      // animation only replays the way back to it.
      return elementImpacted.animate(
        [{ transform: transformWhileHeld }, { transform: transformAtRest }],
        { duration, easing },
      );
    };
    const commitPosition = () => {
      dragStyleController.commit(elementImpacted);
    };
    dragGesture.gestureInfo.cancelPosition = cancelPosition;
    dragGesture.gestureInfo.cancelPositionAnimated = cancelPositionAnimated;
    dragGesture.gestureInfo.commitPosition = commitPosition;

    dragGesture.addReleaseCallback(() => {
      if (releasePositionEffect === "cancel") {
        cancelPosition();
      } else if (releasePositionEffect === "cancel-animated") {
        cancelPositionAnimated();
      } else if (releasePositionEffect === "commit") {
        commitPosition();
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
        // The translate keys are seeded HERE, before the spread, and not merely
        // assigned below: a transform object is serialized in key order, and in a
        // transform list every function transforms the frame of the ones after it.
        // A translate written after a rotate or a scale therefore travels rotated
        // and scaled — the element drifts away from the pointer, proportionally to
        // the distance covered. Dragging moves things on screen, so its translate
        // has to come first, whatever else the element carries. The spread still
        // wins on the value when the element already had a translate of its own.
        const transform = { translateX: 0, translateY: 0, ...transformAtGrab };
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

/*
 * `rotate` and `scale` set as individual properties are not part of `transform`:
 * the element's matrix is translate, then rotate, then scale, then `transform`.
 * The drag translate lives in `transform`, so it lands INSIDE them and comes out
 * rotated and scaled — the element drifts away from the pointer, a bit more at
 * every pixel travelled.
 * Nothing written inside `transform` can compensate, and `getComputedStyle().transform`
 * does not show these properties, so the gesture cannot even see what is happening
 * to it: hence a warning, and the way out is to carry the decoration on a child
 * (what the drag clone of startDragTo does).
 * `translate` as an individual property is left alone — translations compose,
 * whatever their order.
 */
const warnAboutTransformsOutsideTransform = (element) => {
  const { rotate, scale } = getComputedStyle(element);
  const propertiesInTheWay = [];
  if (rotate !== "none") {
    propertiesInTheWay.push(`rotate: ${rotate}`);
  }
  if (scale !== "none") {
    propertiesInTheWay.push(`scale: ${scale}`);
  }
  if (propertiesInTheWay.length === 0) {
    return;
  }
  console.warn(
    `The element being dragged has ${propertiesInTheWay.join(" and ")} set as CSS ${propertiesInTheWay.length === 1 ? "property" : "properties"}, which applies outside "transform" and will distort the drag: the element will not follow the pointer. Put the rotation/scale on a child element, or express it inside "transform".`,
    element,
  );
};

/**
 * Starts a drag, for one or more of the outcomes listed.
 *
 * @param {PointerEvent} event The `pointerdown` that may become a drag.
 * @param {("move"|"reorder"|"toss")[]} effects
 *   What letting go of this element can mean. `reorder` and `toss` carry a copy;
 *   `move` carries the element itself. Asking for `move` and `reorder` together is
 *   asking one release to mean two things.
 * @param {object} [options]
 * @param {Element} [options.draggedElement=event.currentTarget]
 * @param {(detail: {gestureInfo: object, x: number, y: number}) => Promise|void} [options.onMove]
 *   It was put somewhere. The position is already committed when this runs — the
 *   hand let go of it there — and travels back if the promise rejects.
 * @param {Element} [options.containerElement=draggedElement.parentElement]
 *   Searched with `itemSelector` for the items to drop between.
 * @param {string} [options.itemSelector] What matches the items of the list.
 * @param {function} [options.getItemId] `getItemId(element) → id`.
 * @param {function} [options.onReorder]
 *   `onReorder(fromId, toId, syncCloneWithDropTarget)` — see its own note below.
 * @param {(detail: {gestureInfo: object}) => Promise|void} [options.onToss]
 *   It was thrown away. The copy leaves the screen while this runs and comes back
 *   if the promise rejects, because the thing still exists and the screen has to
 *   say so.
 * @param {number} [options.tossDistance=110] How far a throw goes, in px.
 * @param {number} [options.tossSpeed=0.45] And how fast, in px/ms. BOTH are asked
 *   for: one without the other is moving the thing while hesitating, and nothing is
 *   thrown away on a hesitation.
 *
 * Everything else is forwarded to `createDragToMoveGestureController`
 * (`areaConstraint`, `autoScrollAreaPadding`, `direction`…) and to `dragAfterIntent`
 * (`threshold`, `longPress`, `longPressDelay`, `longPressSlop`, `onPressStart`,
 * `onPressCancel`, `onPress`).
 *
 * About `onReorder`:
 * - `fromId`: id of the item that moved.
 * - `toId`: id of the item to insert before, or `null` to append at the end.
 * - `syncCloneWithDropTarget`: call it synchronously inside a
 *   `document.startViewTransition` callback, next to the DOM mutation, so the copy
 *   is captured at its landing position.
 * The gesture holds its copy until what `onReorder` returns settles, so returning
 * the transition is what makes the landing continuous.
 */
export const startDragTo = (
  event,
  effects,
  { draggedElement = event.currentTarget, ...options } = {},
) => {
  // An area that opted out of dragging (a text one wants to select, a control that
  // owns the gesture): the press there is none of our business.
  if (event.target.closest && event.target.closest("[data-drag-ignore]")) {
    return undefined;
  }
  // A secondary button (right click and friends) is a context menu, not a grab.
  if (!isPrimaryButtonEvent(event)) {
    return undefined;
  }
  const canReorder = effects.includes("reorder");
  const canToss = effects.includes("toss");
  if (canReorder || canToss) {
    if (import.meta.dev && effects.includes("move")) {
      console.warn(
        `startDragTo: "move" and "reorder"/"toss" cannot both answer one release — one keeps the element where it was put, the others carry a copy and put the original back. Ignoring "move".`,
      );
    }
    return startDragToCarryCopy(event, {
      draggedElement,
      canReorder,
      canToss,
      ...options,
    });
  }
  return startDragToMoveElement(event, { draggedElement, ...options });
};

/**
 * The element ITSELF is carried, and keeps the place the hand gave it.
 *
 * No copy, unlike the two others: what is being moved is the thing and not a
 * stand-in for it, so there is nothing to put back and nothing to reveal.
 */
const startDragToMoveElement = (
  event,
  {
    draggedElement,
    onMove,
    threshold,
    longPress,
    longPressDelay,
    longPressSlop,
    onPressStart,
    onPressCancel,
    onPress,
    ...options
  },
) => {
  event.preventDefault();
  return dragAfterIntent(
    event,
    () => {
      const gestureController = createDragToMoveGestureController({
        releasePositionEffect: "manual",
        ...options,
      });
      const dragGesture = gestureController.grabViaPointer(event, {
        element: draggedElement,
      });
      if (!dragGesture) {
        return null;
      }
      dragGesture.addReleaseCallback(async (gestureInfo) => {
        const { xDelta, yDelta } = gestureInfo.layout;
        if (!xDelta && !yDelta) {
          // Picked up and put back down: nothing moved, so nobody is told.
          gestureInfo.cancelPosition();
          return;
        }
        // Committed before the answer rather than after: the hand let go of it
        // there, and a thing that snaps home while a request is in flight says the
        // gesture was not understood.
        gestureInfo.commitPosition();
        try {
          await onMove?.({ gestureInfo, x: xDelta, y: yDelta });
        } catch {
          gestureInfo.cancelPositionAnimated();
        }
      });
      return dragGesture;
    },
    {
      threshold,
      longPress,
      longPressDelay,
      longPressSlop,
      onPressStart,
      onPressCancel,
      onPress,
    },
  );
};

// Far and fast, both at once: one without the other is moving the thing while
// hesitating, and nothing is thrown away on a hesitation — it comes back.
const TOSS_DISTANCE_TO_COMMIT = 110;
const TOSS_SPEED_TO_COMMIT = 0.45;

const resolveDropMeaning = ({
  gestureInfo,
  hasDropTarget,
  canReorder,
  canToss,
  tossDistance = TOSS_DISTANCE_TO_COMMIT,
  tossSpeed = TOSS_SPEED_TO_COMMIT,
}) => {
  if (canToss) {
    const { xDelta, yDelta } = gestureInfo.layout;
    const distance = Math.hypot(xDelta, yDelta);
    if (distance > tossDistance && gestureInfo.velocity > tossSpeed) {
      return "toss";
    }
  }
  if (canReorder && hasDropTarget) {
    return "reorder";
  }
  return "cancel";
};

/**
 * A COPY of the element is carried, and the original keeps its place in the
 * layout — which is what makes a reorder possible at all: nothing else moves
 * while the hand looks for a place, so there is a stable row of items to look
 * between. A throw uses the same copy for the opposite reason: the original stays
 * until the answer says it is really gone.
 */
const startDragToCarryCopy = (
  event,
  {
    draggedElement,
    canReorder,
    canToss,
    // Something that can be thrown away has to be able to LEAVE. The default of
    // the layer below keeps what is dragged inside its scroll area, which is right
    // for a reorder (a row belongs to its list) and makes a throw impossible — the
    // copy hits the edge of the list and no distance is ever covered, so no throw
    // ever happens and no sideways movement is even visible.
    // Destructured with the default here rather than written at the call below: a
    // caller passing `areaConstraint: undefined` (which is what saying nothing
    // through an options object looks like) would otherwise put the layer below
    // back on its own default and undo this.
    areaConstraint = canToss ? "none" : undefined,
    containerElement = draggedElement.parentElement,
    itemSelector,
    getItemId,
    onReorder,
    onToss,
    tossDistance,
    tossSpeed,
    direction = { x: false, y: true },
    threshold,
    longPress,
    longPressDelay,
    longPressSlop,
    onPressStart,
    onPressCancel,
    onPress,
    ...options
  },
) => {
  // An area that opted out of dragging (a text one wants to select, a control
  // that owns the gesture): the press there is none of our business.
  if (event.target.closest && event.target.closest("[data-drag-ignore]")) {
    return undefined;
  }
  // A secondary button (right click and friends) is a context menu, not a grab.
  if (!isPrimaryButtonEvent(event)) {
    return undefined;
  }
  event.preventDefault();
  return dragAfterIntent(
    event,
    () => {
      const cloneWrapper = createDragClone(draggedElement, event);
      draggedElement.setAttribute("navi-drag-clone-source", "");
      // Move drag related CSS vars from the element to the document
      // so they're accessible to .navi_drop_hint and the clone (which are both in document.body)
      const restoreCSSVars = moveCSSVars(
        dragCSSVars,
        draggedElement,
        document.documentElement,
      );

      const gestureController = createDragToMoveGestureController({
        direction,
        releasePositionEffect: "manual",
        areaConstraint,
        ...options,
      });
      const dragGesture = gestureController.grabViaPointer(event, {
        element: draggedElement,
        elementToMove: cloneWrapper,
      });
      // getDropTargetInfo uses gestureInfo.elementImpacted to compute the dragged rect.
      // Point it at the clone so drop detection tracks the clone's current position.
      dragGesture.gestureInfo.elementImpacted = cloneWrapper;

      // No place to land, no hint: an element that can only be thrown away has
      // nowhere to be put.
      const dropHintEl = canReorder ? createDropHint() : null;
      if (dropHintEl) {
        document.body.appendChild(dropHintEl);
      }
      // The hint first, the clone second: that order is what stacks them in the
      // top layer.
      dropHintEl?.showPopover();
      cloneWrapper.showPopover();

      // currentBeforeElement: element before which the grabbed item will be inserted (null = end)
      // currentReleaseElement: the actual hovered drop target — used to snap the clone on release
      let currentBeforeElement;
      let currentReleaseElement;

      const clearDropHintDOM = () => {
        if (!dropHintEl) {
          return;
        }
        dropHintEl.removeAttribute("data-drop-edge");
        dropHintEl.style.removeProperty("--drop-target-top");
        dropHintEl.style.removeProperty("--drop-target-bottom");
        dropHintEl.style.removeProperty("--drop-target-left");
        dropHintEl.style.removeProperty("--drop-target-width");
      };

      const clearDropHint = () => {
        currentBeforeElement = undefined;
        currentReleaseElement = undefined;
        clearDropHintDOM();
      };

      dragGesture.addDragCallback((gestureInfo) => {
        if (!dropHintEl) {
          return;
        }
        const allItems = [];
        const items = [];
        for (const el of containerElement.querySelectorAll(itemSelector)) {
          allItems.push(el);
          if (el !== draggedElement) {
            items.push(el);
          }
        }

        const dropTargetInfo = getDropTargetInfo(gestureInfo, items, {
          fallbackToEdge: true,
        });
        gestureInfo.dropTargetInfo = dropTargetInfo || null;
        if (!dropTargetInfo) {
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
        const elementIndex = allItems.indexOf(draggedElement);
        const elementNextItem = allItems[elementIndex + 1] ?? null;
        const isNoop = beforeElement === elementNextItem;
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
        // Update drop hint CSS vars.
        // beforeElement = null → insert at end (hint after last item)
        // beforeElement = X    → insert before X (hint at top edge of X)
        const anchorEl = beforeElement || items[items.length - 1];
        const anchorEdge = beforeElement !== null ? "top" : "bottom";
        // Viewport coordinates, straight from the anchor row: the hint is fixed
        // in the page (see its CSS), so there is no container box to be relative
        // to and no scroll offset to add back.
        const anchorRect = anchorEl.getBoundingClientRect();
        dropHintEl.setAttribute("data-drop-edge", anchorEdge);
        dropHintEl.style.setProperty(
          "--drop-target-top",
          `${anchorRect.top}px`,
        );
        dropHintEl.style.setProperty(
          "--drop-target-bottom",
          `${anchorRect.bottom}px`,
        );
        dropHintEl.style.setProperty(
          "--drop-target-left",
          `${anchorRect.left}px`,
        );
        dropHintEl.style.setProperty(
          "--drop-target-width",
          `${anchorRect.width}px`,
        );
      });

      dragGesture.addReleaseCallback(async (gestureInfo) => {
        clearDropHintDOM();
        dropHintEl?.remove();
        restoreCSSVars();

        // What THIS release means, from what the element said it can answer. A
        // throw is asked about first: it is the more insistent of the two, and a
        // hand that sent the thing across the screen has not asked for it to swap
        // places with whatever it happened to fly over.
        const hasDropTarget = currentBeforeElement !== undefined;
        const dropMeans = resolveDropMeaning({
          gestureInfo,
          hasDropTarget,
          canReorder,
          canToss,
          tossDistance,
          tossSpeed,
        });

        if (dropMeans === "toss") {
          // Bake the position the hand left it at, so the flight starts from
          // there rather than from where the clone was declared.
          setCloneViewportRect(cloneWrapper, cloneWrapper);
          gestureInfo.cancelPosition();
          const gone = await tossCloneAway(cloneWrapper, gestureInfo, onToss);
          if (!gone) {
            // It still exists, so the screen has to say so: the copy comes back
            // over the original, and taking it away then reveals the row in
            // place.
            await settleCloneBack(cloneWrapper, draggedElement);
          }
        } else if (dropMeans === "reorder" && hasDropTarget) {
          const clone = cloneWrapper.firstElementChild;
          // Bake the current visual position (transform included) into the CSS vars
          // so the clone stays where the user released it when we clear the transform.
          setCloneViewportRect(cloneWrapper, cloneWrapper);
          gestureInfo.cancelPosition();
          const fromId = getItemId(draggedElement);
          const toId = currentBeforeElement
            ? getItemId(currentBeforeElement)
            : null;
          // provide onReorder a way to synchronously move the clone to the drop target
          // (meant to be used inside a startViewTransition callback)
          const syncCloneWithDropTarget = () => {
            // Snap the CSS-var position to the drop target rect so the browser
            // captures the "new" state at the landing position.
            setCloneViewportRect(cloneWrapper, currentReleaseElement);
            // Removing this attr drops the CSS scale(1.15), so the browser
            // captures the clone at scale 1 as the "new" state.
            clone.removeAttribute("navi-drag-clone");
          };
          await onReorder(fromId, toId, syncCloneWithDropTarget);
        }
        draggedElement.removeAttribute("navi-drag-clone-source");
        cloneWrapper.remove();
      });

      return dragGesture;
    },
    {
      threshold,
      longPress,
      longPressDelay,
      longPressSlop,
      onPressStart,
      onPressCancel,
      onPress,
    },
  );
};

// Viewport coordinates, as getBoundingClientRect gives them: the clone is a
// fixed-position popover, so that is the space it lives in — and the one the
// pointer dragging it works in too.
const setCloneViewportRect = (cloneWrapper, el) => {
  const rect = el.getBoundingClientRect();
  cloneWrapper.style.setProperty("--clone-top", `${rect.top}px`);
  cloneWrapper.style.setProperty("--clone-left", `${rect.left}px`);
  cloneWrapper.style.setProperty("--clone-width", `${rect.width}px`);
  cloneWrapper.style.setProperty("--clone-height", `${rect.height}px`);
};

// Creates the two-layer clone structure used for drag-to-reorder.
//
// Layer 1 — wrapper (navi-drag-clone-wrapper):
//   Positioned absolutely via --clone-top/--clone-left CSS vars.
//   Carries the box-shadow and size. Moved every drag frame via dragStyleController.
//   Has a view-transition-name so the View Transitions API can animate it on release.
//
// Layer 2 — inner clone (navi-drag-clone):
//   A deep clone of the grabbed element.
//   Applies transform: scale(1.15) via the CSS rule for [navi-drag-clone],
//   giving the "lifted" feel. The transform-origin is set to the grab point
//   so the element expands naturally from where the user clicked.
//   On release, the `navi-drag-clone` attribute is removed inside
//   startViewTransition to drop the scale back to 1 as the "new" state.

// The chevron is the one the table's column drop preview uses, rotated by the
// CSS above so each cap points into the line.
const dropHintTemplate = /* html */ `
  <div
    class="navi_drop_hint"
    popover="manual"
  >
    <span class="navi_drop_hint_cap" data-side="start">
      <svg fill="currentColor" viewBox="0 0 30.727 30.727">
        <path
          d="M29.994,10.183L15.363,24.812L0.733,10.184c-0.977-0.978-0.977-2.561,0-3.536c0.977-0.977,2.559-0.976,3.536,0l11.095,11.093L26.461,6.647c0.977-0.976,2.559-0.976,3.535,0C30.971,7.624,30.971,9.206,29.994,10.183z"
        />
      </svg>
    </span>
    <span class="navi_drop_hint_cap" data-side="end">
      <svg fill="currentColor" viewBox="0 0 30.727 30.727">
        <path
          d="M29.994,10.183L15.363,24.812L0.733,10.184c-0.977-0.978-0.977-2.561,0-3.536c0.977-0.977,2.559-0.976,3.536,0l11.095,11.093L26.461,6.647c0.977-0.976,2.559-0.976,3.535,0C30.971,7.624,30.971,9.206,29.994,10.183z"
        />
      </svg>
    </span>
  </div>
`;
const createDropHint = () => {
  const div = document.createElement("div");
  div.innerHTML = dropHintTemplate.trim();
  return div.firstElementChild;
};

/**
 * The copy leaves the screen the way it was thrown, and the caller says what that
 * meant. Resolves true when it is really gone.
 *
 * The answer is asked for WHILE it flies rather than after: the thing is already
 * far away by the time the request lands, which is the whole point of a gesture
 * that means "get rid of this" — nobody waits to watch it go.
 */
const tossCloneAway = async (cloneWrapper, gestureInfo, onToss) => {
  const { xDelta, yDelta } = gestureInfo.layout;
  const distance = Math.hypot(xDelta, yDelta) || 1;
  cloneWrapper.dataset.tossed = "away";
  cloneWrapper.style.translate = `${(xDelta / distance) * TOSS_DISTANCE}px ${
    (yDelta / distance) * TOSS_DISTANCE
  }px`;
  try {
    await onToss?.({ gestureInfo });
    return true;
  } catch {
    return false;
  }
};

/**
 * It comes back where it came from, and only then is taken away — which is what
 * makes the original reappear in place rather than blink back into it.
 *
 * Flown home on `translate` rather than by rewriting the position vars: the vars
 * hold where the hand let go, the transition is on translate, and moving the vars
 * would put the copy there instantly instead of taking it there.
 */
const settleCloneBack = (cloneWrapper, sourceElement) => {
  const sourceRect = sourceElement.getBoundingClientRect();
  const releaseLeft = parseFloat(
    cloneWrapper.style.getPropertyValue("--clone-left"),
  );
  const releaseTop = parseFloat(
    cloneWrapper.style.getPropertyValue("--clone-top"),
  );
  cloneWrapper.dataset.tossed = "back";
  cloneWrapper.style.translate = `${sourceRect.left - releaseLeft}px ${
    sourceRect.top - releaseTop
  }px`;
  return new Promise((resolve) => {
    setTimeout(resolve, TOSS_DURATION_MS);
  });
};

const createDragClone = (element, pointerEvent) => {
  const rect = element.getBoundingClientRect();

  const wrapper = document.createElement("div");
  wrapper.setAttribute("navi-drag-clone-wrapper", "");
  // Manual: it is opened and closed with the drag, and must survive an Escape
  // or a click elsewhere (light dismiss would take it away mid-gesture).
  wrapper.setAttribute("popover", "manual");
  wrapper.viewTransitionName = "navi-drag-clone-wrapper";
  setCloneViewportRect(wrapper, element);
  // Grab point within the element — used as transform-origin so the
  // scale(1.15) expands from where the user clicked, not the element center.
  // These offsets are element-relative so viewport coords are correct here.
  wrapper.style.setProperty(
    "--drag-origin",
    `${pointerEvent.clientX - rect.left}px ${pointerEvent.clientY - rect.top}px`,
  );
  // The clone is appended to document.body, so it loses inherited styles
  // from the original parent. Copy the computed inherited properties that
  // are most likely to affect visual appearance.
  const computedStyle = getComputedStyle(element.parentElement);
  for (const property of INHERITED_PROPERTIES_TO_COPY_SET) {
    wrapper.style.setProperty(
      property,
      computedStyle.getPropertyValue(property),
    );
  }

  const elementClone = element.cloneNode(true);
  elementClone.setAttribute("navi-drag-clone", "");
  // What is held is the copy, so it is the copy that must LOOK held: the caller
  // dresses `[data-grabbed]` on its own element once, and the copy is that element.
  // (The original wears it too, but it is hidden — see navi-drag-clone-source.)
  elementClone.setAttribute("data-grabbed", "");
  elementClone.style.viewTransitionName = "navi-drag-clone";

  wrapper.appendChild(elementClone);
  document.body.appendChild(wrapper);

  return wrapper;
};
const INHERITED_PROPERTIES_TO_COPY_SET = new Set([
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  // in case the item has border-radius: inherit. The clone can inherit too
  "border-radius",
]);
