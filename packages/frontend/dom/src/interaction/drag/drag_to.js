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
 * - **land**: it comes down ON something. Also a copy, and the closest to
 *   `reorder` — the difference is what a target IS: a row of a list is a place
 *   BETWEEN two others, whereas a square of a board is a place of its own, which
 *   may already be taken. So nothing is inserted and nothing is a no-op: the
 *   answer is "this one came down on that one", and what that means (take the
 *   place, swap the two, refuse) is the caller's. The answer says WHERE on it as
 *   well, which is all there is to say when the place is a surface — a plan, a
 *   map — with no element under the copy to name.
 * - **leave**: it is let go of AWAY from every place — off the plan it stood on,
 *   with nothing under it. Not a throw: slow and deliberate, judged after a
 *   landing was looked for and none was found. What that means is the caller's
 *   (the marker is removed, the court goes back to the row of unplaced ones).
 *
 * The caller lists which outcomes ITS element can answer, and only the machinery
 * those need runs: no copy for a move, no drop hint for something that can only be
 * thrown away, no landing looked for where nothing lands. `toss` and `leave` each
 * combine with `reorder`, with `land` and with each other (dropped on a row,
 * thrown off the screen, let go of beside the list); `leave` combines with `move`
 * as well — the element itself travels, and is either put down where it is or let
 * go of outside. `move` cannot combine with what carries a copy, and `reorder`
 * and `land` cannot both be true of one release; the caller is the one who must
 * not ask for both.
 *
 * A press that would be one of the five and is NOT has its own entry:
 * `refuseDragTo` reads the same intent, keeps the press where it landed, and
 * tells the caller at the instant the grab would have been acquired instead of
 * starting anything — a locked object that must not follow the hand, and must
 * say so.
 *
 * `createDragToMoveGestureController` below is the layer under all of that — the
 * translation, the auto-scroll, the constraints — and stays usable on its own for
 * anything that is none of the five (a table column being dragged, a sticky
 * frontier being moved).
 */

import { getScrollBox, getScrollport } from "../../position/dom_coords.js";
import { createStyleController } from "../../style/style_controller.js";
import { suppressClickAfterGesture } from "../click_suppression.js";
import { getScrollContainer } from "../scroll/scroll_container.js";
import {
  dragAfterIntent,
  keepTouchRefusable,
  markDragSource,
} from "./drag_after_intent.js";
import { initDragConstraints } from "./drag_constraint.js";
import { createDragElementPositioner } from "./drag_element_positioner.js";
import {
  createDragGestureController,
  isPrimaryButtonEvent,
} from "./drag_gesture.js";
import {
  getDropTargetInfo,
  rectangleAreIntersecting,
} from "./drop_target_detection.js";
import { applyStickyFrontiersToAutoScrollArea } from "./sticky_frontiers.js";

const dragStyleController = createStyleController("drag_to_move");

// How long the copy takes to leave the screen, and to come back. Written into the
// CSS below from here: the flight has to be waited for, and a duration living only
// in a stylesheet is a timing JS cannot read reliably.
const TOSS_DURATION_MS = 320;
// Far enough to be off any screen, in the direction the hand was going.
const TOSS_DISTANCE = 900;

const css = /* css */ `
  /* IT COSTS THE LIST NOTHING: the hint lands on the edge of a row, which for
     the last one is the very bottom of the scroll area — a line taking up room
     there would push the scrollable area a few pixels further and make a
     scrollbar appear (or hide the hint under it) exactly when one is trying to
     drop at the end. Being fixed is what avoids it: a fixed box has the
     viewport as containing block, so it is left out of the scrollable overflow
     of every ancestor and can overhang the list freely. Same for the clone it
     accompanies. */
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
     which costs nothing to a box left out of the scrollable area — and the more
     they stick out, the easier they are to spot. */
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

  /* WHERE IT LANDS, when landing is ON a thing rather than between two: the
     place itself is lit up, because there is no gap to draw a line in. Fixed
     and in the top layer for the same reasons as the line above. */
  .navi_drop_surface {
    position: fixed;
    inset: auto;
    top: var(--drop-target-top);
    left: var(--drop-target-left);
    display: none;
    box-sizing: border-box;
    width: var(--drop-target-width);
    height: var(--drop-target-height);
    margin: 0;
    padding: 0;
    color: inherit;
    background: var(--drop-surface-background-color, rgba(68, 118, 255, 0.16));
    border: var(--drop-surface-border-width, 2px) solid
      var(--drop-surface-border-color, #4476ff);
    border-radius: var(--drop-surface-border-radius, 6px);
    pointer-events: none;
    overflow: visible;
  }
  .navi_drop_surface[data-drop-over]:popover-open {
    display: block;
  }

  /* WHO CAN START A DRAG, said in the cursor.
     A handle exists only to drag, so it shows the hand. A source does not, and
     the gesture must not claim its cursor: it drags only once the intent shows
     (a few pixels of travel, or a long press), a plain click on it stays a
     click, and it is usually something else FIRST — a link, a card one opens.
     The cursor says what the element is, and a hand insisting on the one thing
     it can also be would talk over that. So it is left alone — default, and not
     an I-beam, because dragging across the text does not select it (the gesture
     takes the pointer; see the selectstart refused in drag_gesture.js) — and
     whoever puts the drag there asks for the hand when a grab really is the
     first thing the element offers.
     An opted-out area keeps both its cursor and its selection, and never starts
     a drag (see the check in startDragTo); a popover or a dialog anchored in a
     source is one without having to say so.
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
  }
  [data-drag-ignore],
  [data-self-interactions~="drag"],
  [data-self-interactions~="*"],
  [data-drag-source] [popover],
  [data-drag-source] dialog {
    cursor: auto;
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
    /* Carries the chain down to the copy, for an item whose own radius is an
       "inherit" from the list around it. */
    border-radius: inherit;
    opacity: 0.95;
    pointer-events: none;
    /* Nothing in a copy being carried by a pointer is text to select: the
       selection belongs to the original, which is still in the page. This is the
       one place the rule is unconditional — an element that can be dragged is
       usually selectable too (a link is both), and forcing it there would take
       away a selection made from outside the element.  */
    user-select: none;
    overflow: visible;
  }

  /* On its way home and still the object: the hand can reach for it there, so
     there it takes the pointer — which it must not do at any other moment of the
     gesture, or it would hide what it is being dropped on. */
  [navi-drag-clone-wrapper][data-catchable] {
    pointer-events: auto;
  }

  /* …and a FINGER reaching for it does not land on it: the pictures of the
     transition cover the page, so as far as the browser is concerned the touch
     began on the document root. What a touch may do is decided there and at that
     moment, so the root says it for as long as the copy can be caught — the pan
     is ours (nothing should scroll while something is landing), zoom stays the
     reader's. Half of a pair: without the non-passive listener put down at the
     same moment (see letCopyBeCaught) every touchmove arrives already
     non-cancelable and refusing it does nothing. */
  [data-drag-catchable] {
    touch-action: pinch-zoom;
  }

  /* Ce qui a été lancé continue dans la direction du geste jusqu'à sortir de
     l'écran; ce qui a été lâché dans le vide s'efface sur place (même attribut,
     sans translate). L'un comme l'autre revient par le même chemin si la
     réponse refuse. */
  [navi-drag-clone-wrapper][data-tossed] {
    transition:
      translate ${TOSS_DURATION_MS}ms ease-out,
      opacity ${TOSS_DURATION_MS}ms ease-out;
  }
  [navi-drag-clone-wrapper][data-tossed="away"] {
    opacity: 0;
  }

  [navi-drag-clone] {
    /* Where the copy sits in its wrapper is written inline on it, not here —
       see createDragClone. */
    /* Cast by the copy itself rather than by the box around it, so it takes the
       shape of the thing — a rounded row throws a rounded shadow. Its value is a
       var read on the copy, which IS the dragged element: what being carried
       looks like belongs to whoever owns the thing — a row lifted off a list
       wants this shadow, a sheet of paper leaving a board wants none, and its
       shade is a theme's business either way. */
    box-shadow: var(--drag-clone-shadow, 0 12px 28px rgba(0, 0, 0, 0.22));
    transform: scale(var(--drag-clone-scale, 1.03));
    transform-origin: var(--drag-origin);
    translate: none !important;
    transition:
      transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 0.15s ease;
  }

  @starting-style {
    [navi-drag-clone] {
      box-shadow: none;
      transform: scale(1);
    }
  }
`;
// At module scope, not inside startDragTo: the cursor rules above say who
// can start a drag, and they have to be true BEFORE anyone drags anything.
import.meta.css = css;

// What a press must not be read from at all. `data-drag-ignore` is said by
// something whose press is its own business — a text one wants to select, a
// control that reads the pointer itself — and it means every gesture at once.
// `data-self-interactions` says a narrower thing, and says which: an element
// declaring the interactions that are ITS own, whatever it happens to sit
// inside, the rest being left to what it sits in. Only the ones naming `drag`
// take the grab away from the surface (see also DRAG_EXCLUDED_SELECTOR in
// drag_to_travel.js) — an affordance that took the click alone is one a finger
// may still pick the object up by, which is what it is for when it covers a real
// part of that object. A popover or a dialog says it without being asked: it is
// a layer OVER the surface, so a press in it is aimed at the layer — yet it
// stays a descendant of whatever it is anchored in (a callout next to a button,
// in the card that carries both), and the press bubbles through the surface as
// if it had landed on it.
const DRAG_IGNORED_SELECTOR =
  '[data-drag-ignore],[data-self-interactions~="drag"],[data-self-interactions~="*"],[popover],dialog';

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
 * @param {("move"|"reorder"|"toss"|"land"|"leave")[]} effects
 *   What letting go of this element can mean. `reorder`, `toss` and `land` carry a
 *   copy; `move` carries the element itself, and `leave` goes with either. Asking
 *   for `move` and `reorder` together is asking one release to mean two things,
 *   and so is asking for `reorder` and `land`.
 * @param {object} [options]
 * @param {Element} [options.draggedElement=event.currentTarget]
 * @param {(detail: {gestureInfo: object, x: number, y: number}) => Promise|void} [options.onMove]
 *   It was put somewhere. It is left where the hand let go of it while this
 *   runs, and travels back if the promise rejects. Once it resolves the position
 *   has one owner: the caller's layout, when the caller drew the element
 *   somewhere while answering (a new `left`/`top` from state, a new `transform`,
 *   a node rebuilt), and the element's own translate otherwise, baked in — see
 *   settleMovedElement.
 * @param {(detail: {gestureInfo: object, x: number, y: number}) => Promise|void} [options.onLeave]
 *   It was let go of away from every place: with places (`itemSelector`), away
 *   from all of them; without, out of `outsideOf`. Beside `move` the element
 *   itself is left where the hand put it while this runs, and the answer says
 *   what becomes of that position — let go of on a resolve (the caller has
 *   removed the thing, or drawn it where it goes back to), travelled home on a
 *   reject. Beside a copy, the copy fades where it was let go of and comes back
 *   if the promise rejects. Picked up and put straight back down is a cancel:
 *   it has to have gone somewhere to be away from anything.
 * @param {(detail: {gestureInfo: object, x: number, y: number, outcome: "move"|"reorder"|"land"|"toss"|"leave"|null}) => void} [options.onRelease]
 *   The hand let go — the mirror of `onDragStart`, and the one thing that is told
 *   whatever the release meant, a cancelled gesture included. `outcome` is what
 *   the release means, `null` when it means nothing; the answer to it runs after,
 *   so what is set up at the grab can be taken down here without waiting for it.
 *   Told, not asked: what comes back is not waited on.
 * @param {Element} [options.outsideOf] The box a `leave` is outside of, when
 *   nothing is a place. Left out, what can be seen of the scroll container.
 *   Judged on the carried box no longer overlapping it — not on the pointer,
 *   which is still well inside the frame when a small thing has just left it.
 * @param {Element} [options.containerElement=draggedElement.parentElement]
 *   Where the places are looked for with `itemSelector`, and where the drop hint
 *   is drawn. The parent covers a list and a board, whose items are siblings of
 *   what is carried; anything else has to be said — a palette beside the surface
 *   it fills, a piece drawn INSIDE the place it can be put back on.
 * @param {string} [options.itemSelector] What matches the items of the list.
 *   Left out, nothing is a place: no hint is drawn and no landing can be
 *   answered, which is what a drag that only ever throws the thing away asks for.
 * @param {function} [options.getItemId] `getItemId(element) → id`. An id rather
 *   than a DOM index, because the two do not match: a list draws fewer rows than
 *   it has, a search reorders them, and the structure may have holes.
 * @param {function} [options.onReorder]
 *   `onReorder(fromId, toId, syncCloneWithDropTarget)` — see its own note below.
 * @param {(detail: {gestureInfo: object}) => Promise|void} [options.onToss]
 *   It was thrown away. The copy leaves the screen while this runs and comes back
 *   if the promise rejects, because the thing still exists and the screen has to
 *   say so.
 * @param {(detail: {fromId: string, toId: string, x: number, y: number, width: number, height: number, syncCloneWithDropTarget: Function}) => Promise|void} [options.onLand]
 *   It came down on `toId`, which is an element and never null: nothing under the
 *   copy is a cancelled release. `x`/`y`/`width`/`height` say WHERE on it, which
 *   is the whole answer when the place is a surface — a plan, a map — with no
 *   element under the copy to name. The copy is held until what comes back
 *   settles, exactly like `onReorder`. `syncCloneWithDropTarget` takes an element
 *   when the place is not the shape of what stands on it: the copy then takes
 *   THAT box instead of the target's.
 * @param {number} [options.tossDistance=110] How far a throw goes, in px.
 * @param {number} [options.tossSpeed=0.45] And how fast, in px/ms. BOTH are asked
 *   for: one without the other is moving the thing while hesitating, and nothing is
 *   thrown away on a hesitation. A throw is judged before any landing; a release
 *   with no place under it is `leave`'s, not a toss — there is no speed to it.
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
  // owns the gesture, a callout): the press there is none of our business.
  if (isPressIgnored(event.target, draggedElement)) {
    return undefined;
  }
  // A secondary button (right click and friends) is a context menu, not a grab.
  if (!isPrimaryButtonEvent(event)) {
    return undefined;
  }
  const canMove = effects.includes("move");
  const canReorder = effects.includes("reorder");
  const canToss = effects.includes("toss");
  const canLand = effects.includes("land");
  const canLeave = effects.includes("leave");
  // A `leave` on its own carries a copy too: nothing keeps the element where it
  // was put, so the original stays until the answer says it is gone.
  if (canReorder || canToss || canLand || (canLeave && !canMove)) {
    if (import.meta.dev && canMove) {
      console.warn(
        `startDragTo: "move" and "reorder"/"toss"/"land" cannot both answer one release — one keeps the element where it was put, the others carry a copy and put the original back. Ignoring "move".`,
      );
    }
    if (import.meta.dev && canReorder && canLand) {
      console.warn(
        `startDragTo: "reorder" and "land" cannot both answer one release — a release either takes a place between two items or comes down on one. "land" wins.`,
      );
    }
    return startDragToCarryCopy(event, {
      draggedElement,
      canReorder,
      canToss,
      canLand,
      canLeave,
      ...options,
    });
  }
  return startDragToMoveElement(event, {
    draggedElement,
    canLeave,
    ...options,
  });
};

/**
 * A press that WOULD be a drag, and is not.
 *
 * Recognized exactly as `startDragTo` recognizes it: the press stays this
 * element's, so a surface under it does not pan and nothing else answers it, and
 * the intent is established by the same threshold — a mouse travelling, a finger
 * holding still, the first pixel inside a `[data-drag-on-contact]`. What differs
 * is what happens once it is established: nothing is grabbed, nothing translates,
 * and `onRefuse` is told at the instant the grab would have been acquired.
 *
 * That instant is the whole point. An object that stays put under the hand and
 * says nothing reads as a screen that is broken, and the hand pulls harder; the
 * refusal has to be told where the grab would have been felt, which is the only
 * moment the press has of its own.
 *
 * @param {PointerEvent} event The `pointerdown` that would have become a drag.
 * @param {object} [options]
 * @param {Element} [options.draggedElement=event.currentTarget]
 * @param {(detail: {event: PointerEvent}) => void} [options.onRefuse]
 *   The hand pulled and there is no drag. Told, not asked: what comes back is
 *   not waited on. There is no `gestureInfo` to go with it — no gesture was ever
 *   started — so `event` is the press it was refused from.
 *
 * Everything else is forwarded to `dragAfterIntent` (`threshold`, `longPress`,
 * `longPressDelay`, `longPressSlop`).
 */
export const refuseDragTo = (
  event,
  { draggedElement = event.currentTarget, onRefuse, ...options } = {},
) => {
  if (isPressIgnored(event.target, draggedElement)) {
    return;
  }
  if (!isPrimaryButtonEvent(event)) {
    return;
  }
  event.preventDefault();
  dragAfterIntent(
    event,
    () => {
      // Nothing is carried, and the pointer is taken all the same: taking it is
      // how a gesture says the press is settled, and another wait counting on the
      // same finger reads it (see press_held.js). A `longpress` declared beside
      // the drag is answered by the grab when there is one; there must be no
      // difference when there is none.
      draggedElement.setPointerCapture(event.pointerId);
      // And the click the browser fires afterwards belongs to what answered the
      // press, a refusal included: something pulled and told to stay put must not
      // also be clicked. Lifted at the release rather than with the click, which
      // comes after it (see suppressClickAfterGesture).
      const clickSuppressionIsOver = suppressClickAfterGesture();
      const endRefusal = () => {
        window.removeEventListener("pointerup", endRefusal, true);
        window.removeEventListener("pointercancel", endRefusal, true);
        if (draggedElement.hasPointerCapture(event.pointerId)) {
          draggedElement.releasePointerCapture(event.pointerId);
        }
        clickSuppressionIsOver();
      };
      window.addEventListener("pointerup", endRefusal, true);
      window.addEventListener("pointercancel", endRefusal, true);
      onRefuse?.({ event });
      // Nothing to hold: a falsy gesture is how dragAfterIntent is told there is
      // none.
      return null;
    },
    options,
  );
};

/**
 * The element ITSELF is carried, and keeps the place the hand gave it — or is let
 * go of away from it, when it can `leave`.
 *
 * No copy, unlike the others: what is being moved is the thing and not a
 * stand-in for it, so there is nothing to put back and nothing to reveal.
 */
const startDragToMoveElement = (
  event,
  {
    draggedElement,
    canLeave,
    onMove,
    onLeave,
    onRelease,
    outsideOf,
    // A thing that can be let go of outside has to be able to get there. Same
    // reason and same shape as the default of the copy path below.
    areaConstraint = canLeave ? "none" : undefined,
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
        areaConstraint,
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
          // Picked up and put back down: nothing moved, so no outcome is told.
          onRelease?.({ gestureInfo, x: xDelta, y: yDelta, outcome: null });
          gestureInfo.cancelPosition();
          return;
        }
        const leaving =
          canLeave &&
          !gestureInfo.cancelled &&
          isOutsideOf(gestureInfo, outsideOf);
        onRelease?.({
          gestureInfo,
          x: xDelta,
          y: yDelta,
          outcome: leaving ? "leave" : "move",
        });
        if (leaving) {
          // Left where the hand let go of it while the answer is asked — a thing
          // that snaps home with the request in flight says the gesture was not
          // understood. The answer then says what becomes of that position: let
          // go of on a resolve, since the caller has removed the thing or drawn
          // it where it goes back to; travelled home on a reject.
          try {
            await onLeave?.({ gestureInfo, x: xDelta, y: yDelta });
            gestureInfo.cancelPosition();
          } catch {
            gestureInfo.cancelPositionAnimated();
          }
          return;
        }
        // Kept where the hand let go of it while the answer is asked — a thing
        // that snaps home with the request in flight says the gesture was not
        // understood — and settled once the answer is in.
        const layoutBeforeAnswer = readOwnLayout(draggedElement);
        try {
          await onMove?.({ gestureInfo, x: xDelta, y: yDelta });
        } catch {
          gestureInfo.cancelPositionAnimated();
          return;
        }
        settleMovedElement(draggedElement, gestureInfo, layoutBeforeAnswer);
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

/**
 * Who holds the position of a moved element once the answer is in. Two owners
 * are possible and the element can only have one: the drag's own translate, for
 * a thing whose place is the hand's alone (a token on a free canvas), or the
 * caller's layout, for a thing drawn from state (a court at so many metres from
 * the place point, its `left`/`top` computed from that). Both kept, the thing
 * lands twice as far as the hand went.
 *
 * The answer does not say which, so the element is asked: drawn somewhere else
 * by the caller while the answer was given — a new `left`, a new inline
 * `transform`, a node thrown away and rebuilt — its layout holds the position
 * and the translate goes. Drawn nowhere, the translate is all there is, and it
 * is baked in. Read from the layout and never from the screen, so a page that
 * scrolled while the answer was awaited reads as nothing; and read from the
 * inline style rather than the computed one, which the translate itself is
 * part of.
 *
 * A caller that draws later than it answers (a store rendering on its own
 * schedule) has to make the answer wait for the draw: what is read here is what
 * has happened by then.
 */
const settleMovedElement = (element, gestureInfo, layoutBeforeAnswer) => {
  const layoutAfterAnswer = readOwnLayout(element);
  const drawnElsewhere =
    !layoutAfterAnswer.connected ||
    layoutAfterAnswer.offsetLeft !== layoutBeforeAnswer.offsetLeft ||
    layoutAfterAnswer.offsetTop !== layoutBeforeAnswer.offsetTop ||
    layoutAfterAnswer.transform !== layoutBeforeAnswer.transform ||
    layoutAfterAnswer.translate !== layoutBeforeAnswer.translate;
  if (drawnElsewhere) {
    gestureInfo.cancelPosition();
  } else {
    gestureInfo.commitPosition();
  }
};
const readOwnLayout = (element) => ({
  connected: element.isConnected,
  offsetLeft: element.offsetLeft,
  offsetTop: element.offsetTop,
  transform: element.style.transform,
  translate: element.style.translate,
});

// Far and fast, both at once: one without the other is moving the thing while
// hesitating, and nothing is thrown away on a hesitation — it comes back.
const TOSS_DISTANCE_TO_COMMIT = 110;
const TOSS_SPEED_TO_COMMIT = 0.45;

const resolveDropMeaning = ({
  gestureInfo,
  hasDropTarget,
  releasedOutside,
  canReorder,
  canToss,
  canLand,
  canLeave,
  tossDistance = TOSS_DISTANCE_TO_COMMIT,
  tossSpeed = TOSS_SPEED_TO_COMMIT,
}) => {
  if (gestureInfo.cancelled) {
    // Nobody let go of anything: the gesture was taken away mid-air (the
    // pointer cancelled, another gesture taking it). Where the thing happened
    // to be at that moment is not a place it was put.
    return "cancel";
  }
  if (canToss) {
    const { xDelta, yDelta } = gestureInfo.layout;
    const distance = Math.hypot(xDelta, yDelta);
    if (distance > tossDistance && gestureInfo.velocity > tossSpeed) {
      return "toss";
    }
  }
  if (hasDropTarget) {
    if (canLand) {
      return "land";
    }
    if (canReorder) {
      return "reorder";
    }
  }
  if (canLeave && releasedOutside) {
    // Let go of away from every place — off the plan and down, deliberate and
    // never a flick. It has to have gone somewhere to be away from anything:
    // picked up and put straight back down is a hand that changed its mind, not
    // a thing dropped over nothing.
    const { xDelta, yDelta } = gestureInfo.layout;
    if (xDelta || yDelta) {
      return "leave";
    }
  }
  return "cancel";
};

/**
 * A COPY of the element is carried, and the original keeps its place in the
 * layout — which is what makes a reorder possible at all: nothing else moves
 * while the hand looks for a place, so there is a stable row of items to look
 * between. A landing on a place of a board is the same, and a throw uses that copy
 * for the opposite reason: the original stays until the answer says it is really
 * gone.
 */
const startDragToCarryCopy = (
  event,
  {
    draggedElement,
    canReorder,
    canToss,
    canLand,
    canLeave,
    // Something that can be thrown away, or let go of outside, has to be able to
    // LEAVE. The default of the layer below keeps what is dragged inside its
    // scroll area, which is right for a reorder (a row belongs to its list) and
    // makes a throw impossible — the copy hits the edge of the list and no
    // distance is ever covered, so no throw ever happens and no sideways movement
    // is even visible.
    // Destructured with the default here rather than written at the call below: a
    // caller passing `areaConstraint: undefined` (which is what saying nothing
    // through an options object looks like) would otherwise put the layer below
    // back on its own default and undo this.
    areaConstraint = canToss || canLeave ? "none" : undefined,
    containerElement = draggedElement.parentElement,
    itemSelector,
    getItemId,
    onReorder,
    onLand,
    onToss,
    onLeave,
    onRelease,
    outsideOf,
    tossDistance,
    tossSpeed,
    // A list runs one way and reordering walks it; a board has places all around,
    // so something landing on one of them goes wherever the hand takes it — and
    // so does something that can leave, whichever edge it leaves by.
    direction = canLand || canLeave
      ? { x: true, y: true }
      : { x: false, y: true },
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
  // that owns the gesture, a callout): the press there is none of our business.
  if (isPressIgnored(event.target, draggedElement)) {
    return undefined;
  }
  // A secondary button (right click and friends) is a context menu, not a grab.
  if (!isPrimaryButtonEvent(event)) {
    return undefined;
  }
  // One press, one carry — and the same carry over again when the hand comes back
  // for the copy while it is still flying home (see settleCloneBack). Nothing is
  // made twice in that case: it is the same copy, taken in hand again where it
  // had got to.
  const startCarry = (pointerEvent, cloneWrapperCaught, onCarryStart) => {
    pointerEvent.preventDefault();
    return dragAfterIntent(
      pointerEvent,
      () => {
        // Here and nowhere else is where a press has turned into a carry — the
        // one moment both ways in (a finger held still, a mouse travelled)
        // agree on.
        onCarryStart?.();
        const cloneWrapper =
          cloneWrapperCaught || createDragClone(draggedElement, pointerEvent);
        if (cloneWrapperCaught) {
          liftDragClone(cloneWrapperCaught, pointerEvent);
        }
        draggedElement.setAttribute("navi-drag-clone-source", "");

        const gestureController = createDragToMoveGestureController({
          direction,
          releasePositionEffect: "manual",
          areaConstraint,
          ...options,
        });
        const dragGesture = gestureController.grabViaPointer(pointerEvent, {
          element: draggedElement,
          elementToMove: cloneWrapper,
        });
        // getDropTargetInfo uses gestureInfo.elementImpacted to compute the dragged rect.
        // Point it at the clone so drop detection tracks the clone's current position.
        dragGesture.gestureInfo.elementImpacted = cloneWrapper;

        // No place to land, no hint: an element that can only be thrown away has
        // nowhere to be put. What the hint LOOKS like follows what a place is here —
        // a line in the gap between two items, or the place itself lit up.
        const dropHintEl = canLand
          ? createDropSurface()
          : canReorder
            ? createDropHint()
            : null;
        if (dropHintEl) {
          // Among the places it lights up, which is where its own vars are set: the
          // shape of a drop hint is a property of the list or board it belongs to,
          // and reading it from there is inheritance rather than a hand-off. The
          // copy goes the other way (see createDragClone) — it is dressed by where
          // the thing it copies stands, which may be a palette far from here.
          containerElement.appendChild(dropHintEl);
        }
        // The hint first, the clone second: that order is what stacks them in the
        // top layer. A copy taken back in hand is already up there, and the hint
        // just went above it — shown again it returns to the top, where what the
        // hand carries belongs.
        dropHintEl?.showPopover();
        if (cloneWrapperCaught) {
          cloneWrapper.hidePopover();
        }
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
          dropHintEl.removeAttribute("data-drop-over");
          dropHintEl.style.removeProperty("--drop-target-top");
          dropHintEl.style.removeProperty("--drop-target-bottom");
          dropHintEl.style.removeProperty("--drop-target-left");
          dropHintEl.style.removeProperty("--drop-target-width");
          dropHintEl.style.removeProperty("--drop-target-height");
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
            // The copy in hand is a clone of an item, attributes included, and it
            // lives in this same parent: it matches the selector without being
            // an item. Excluded here rather than by stripping attributes off the
            // clone, because a custom itemSelector (a class, a tag) would still
            // match it.
            if (cloneWrapper.contains(el)) {
              continue;
            }
            allItems.push(el);
            if (el !== draggedElement) {
              items.push(el);
            }
          }

          const dropTargetInfo = getDropTargetInfo(gestureInfo, items, {
            // The edges of a LIST: above the first row means the top of it, below
            // the last one means the end of it. A board has no such reading — away
            // from every place is away from every place.
            fallbackToEdge: !canLand,
          });
          gestureInfo.dropTargetInfo = dropTargetInfo || null;
          if (!dropTargetInfo) {
            clearDropHint();
            return;
          }
          if (canLand) {
            // The whole element is the target, so which of its edges the copy came
            // in by says nothing: there is no gap to be on one side of.
            const dropElement = dropTargetInfo.element;
            if (dropElement === currentReleaseElement) {
              return;
            }
            currentReleaseElement = dropElement;
            const dropRect = dropElement.getBoundingClientRect();
            dropHintEl.setAttribute("data-drop-over", "");
            dropHintEl.style.setProperty(
              "--drop-target-top",
              `${dropRect.top}px`,
            );
            dropHintEl.style.setProperty(
              "--drop-target-left",
              `${dropRect.left}px`,
            );
            dropHintEl.style.setProperty(
              "--drop-target-width",
              `${dropRect.width}px`,
            );
            dropHintEl.style.setProperty(
              "--drop-target-height",
              `${dropRect.height}px`,
            );
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

          // What THIS release means, from what the element said it can answer. A
          // throw is asked about first: it is the more insistent of the two, and a
          // hand that sent the thing across the screen has not asked for it to swap
          // places with whatever it happened to fly over.
          const hasDropTarget = canLand
            ? currentReleaseElement !== undefined
            : currentBeforeElement !== undefined;
          // "Away from every place" is the last frame's answer, not
          // `hasDropTarget`: a row let go of where it already was has no place
          // to INSERT it at and still has a place under it. With nothing that is
          // a place, it is out of the box the thing belongs to.
          const releasedOutside =
            canLeave &&
            (dropHintEl
              ? !gestureInfo.dropTargetInfo
              : isOutsideOf(gestureInfo, outsideOf));
          const dropMeans = resolveDropMeaning({
            gestureInfo,
            hasDropTarget,
            releasedOutside,
            canReorder,
            canToss,
            canLand,
            canLeave,
            tossDistance,
            tossSpeed,
          });
          // The hand has let go, and what that means is already known — the
          // answer to it has not run yet. Told, not asked: nothing here waits on
          // what comes back, because the outcome below is what the copy waits on.
          const { xDelta, yDelta } = gestureInfo.layout;
          onRelease?.({
            gestureInfo,
            x: xDelta,
            y: yDelta,
            outcome: dropMeans === "cancel" ? null : dropMeans,
          });

          // Let go of and still on the screen: from here until it is taken away
          // the copy can be taken back in hand (see letCopyBeCaught).
          const copyLetGoOf = letCopyBeCaught(
            cloneWrapper,
            (pointerDownEvent, whenCarried) =>
              startCarry(pointerDownEvent, cloneWrapper, whenCarried),
          );

          // The copy stops where the hand left it, and the answer is given a way to
          // take it the rest of the way — synchronously, inside a view transition, so
          // it is captured where it lands rather than where it was let go of.
          const landCopyOn = async (targetElement, answer) => {
            const clone = cloneWrapper.firstElementChild;
            // Bake the current visual position (transform included) into the CSS vars
            // so the copy stays where the user released it when the transform goes.
            setCloneViewportRect(cloneWrapper, cloneWrapper);
            gestureInfo.cancelPosition();
            // Where the copy comes down is not always the thing it came down ON: a
            // place of a board can be larger than what stands on it, and the copy
            // has to keep its own size and land where the item will be. Said with
            // an element, because the caller has one — the piece already standing
            // there, the empty slot waiting.
            const syncCloneWithDropTarget = (
              landingElement = targetElement,
            ) => {
              setCloneViewportRect(cloneWrapper, landingElement);
              // Removing this attr drops the CSS scale, so the browser captures the
              // copy at scale 1 as the "new" state.
              clone.removeAttribute("navi-drag-clone");
            };
            await answer(syncCloneWithDropTarget);
          };

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
          } else if (dropMeans === "leave") {
            setCloneViewportRect(cloneWrapper, cloneWrapper);
            gestureInfo.cancelPosition();
            const gone = await letCloneGo(cloneWrapper, gestureInfo, onLeave);
            if (!gone) {
              await settleCloneBack(cloneWrapper, draggedElement);
            }
          } else if (dropMeans === "land") {
            // Read before the copy is put down: landing bakes its position and
            // drops the transform, and where it came down is where the hand let
            // go of it.
            const landedAt = getRectInside(cloneWrapper, currentReleaseElement);
            await landCopyOn(currentReleaseElement, (syncCloneWithDropTarget) =>
              onLand({
                fromId: getItemId(draggedElement),
                toId: getItemId(currentReleaseElement),
                ...landedAt,
                syncCloneWithDropTarget,
              }),
            );
          } else if (dropMeans === "reorder") {
            await landCopyOn(currentReleaseElement, (syncCloneWithDropTarget) =>
              onReorder(
                getItemId(draggedElement),
                currentBeforeElement ? getItemId(currentBeforeElement) : null,
                syncCloneWithDropTarget,
              ),
            );
          }
          if (await copyLetGoOf.settled()) {
            // In a hand again: the copy, and the place kept for it, are the new
            // gesture's — this one has nothing left to take away.
            return;
          }
          draggedElement.removeAttribute("navi-drag-clone-source");
          cloneWrapper.remove();
        });

        return dragGesture;
      },
      {
        threshold,
        // A copy caught on its way home is not an ambiguous press: the hand
        // reached for something moving, and the press was already matched
        // against the copy's own box before it got here. The wait a finger is
        // asked for elsewhere tells a scroll from a drag, and there is no scroll
        // to tell it from — the copy covers that spot from the top layer. Asked
        // for anyway it cannot even be answered: the wait is about as long as the
        // journey, so the thing is home before the proof is done, while a mouse
        // takes it in five pixels.
        longPress: cloneWrapperCaught ? false : longPress,
        longPressDelay,
        longPressSlop,
        onPressStart,
        onPressCancel,
        onPress,
      },
    );
  };
  return startCarry(event);
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

// Where one box sits inside another, in that other's own content: its border and
// its scroll are taken out, so the numbers say where IN the thing rather than
// where in what is visible of it at that moment.
const getRectInside = (element, containerElement) => {
  const rect = element.getBoundingClientRect();
  const containerRect = containerElement.getBoundingClientRect();
  return {
    x:
      rect.left -
      containerRect.left -
      containerElement.clientLeft +
      containerElement.scrollLeft,
    y:
      rect.top -
      containerRect.top -
      containerElement.clientTop +
      containerElement.scrollTop,
    width: rect.width,
    height: rect.height,
  };
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

const createDropSurface = () => {
  const div = document.createElement("div");
  div.className = "navi_drop_surface";
  // Manual, like the copy it accompanies: it is opened and closed with the drag
  // and must survive an Escape or a click elsewhere.
  div.setAttribute("popover", "manual");
  return div;
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
 * The copy fades where the hand let go of it, and the caller says what being let
 * go of there meant. Resolves true when it is really gone.
 *
 * No flight, unlike a throw: nothing was thrown. The thing was put down over
 * nothing, and it goes from there — the same attribute as a throw, so that a
 * refusal brings it back the same way.
 */
const letCloneGo = async (cloneWrapper, gestureInfo, onLeave) => {
  cloneWrapper.dataset.tossed = "away";
  try {
    const { xDelta, yDelta } = gestureInfo.layout;
    await onLeave?.({ gestureInfo, x: xDelta, y: yDelta });
    return true;
  } catch {
    return false;
  }
};

// Whether what is carried has left the box entirely. The box rather than the
// pointer: a small thing dragged past the edge of its frame has left it while
// the hand is still well inside.
const isOutsideOf = (gestureInfo, outsideOf) => {
  const carried = gestureInfo.elementImpacted || gestureInfo.element;
  const carriedRect = carried.getBoundingClientRect();
  const frameRect = outsideOf
    ? outsideOf.getBoundingClientRect()
    : getVisibleRect(gestureInfo.scrollContainer);
  return !rectangleAreIntersecting(carriedRect, frameRect);
};

// What can be seen of a scroll container, in viewport coordinates.
const getVisibleRect = (scrollContainer) => {
  if (scrollContainer === document.documentElement) {
    const { clientWidth, clientHeight } = scrollContainer;
    return { left: 0, top: 0, right: clientWidth, bottom: clientHeight };
  }
  const rect = scrollContainer.getBoundingClientRect();
  const left = rect.left + scrollContainer.clientLeft;
  const top = rect.top + scrollContainer.clientTop;
  return {
    left,
    top,
    right: left + scrollContainer.clientWidth,
    bottom: top + scrollContainer.clientHeight,
  };
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

/**
 * The copy is let go of, and it is still there: flying home, coming down on a
 * place, waiting on an answer. It is still the object for all that time — a hand
 * reaching for it there is reaching for the thing, and the answer is to give it
 * back.
 *
 * Left alone the press finds nothing: the copy does not take the pointer (it must
 * not, while it is carried, or it would hide what it is being dropped on) and the
 * original is hidden underneath it. The press falls through to the page, which
 * answers a held finger with the system context menu — on the very gesture that
 * meant "I am taking it back". So the copy takes the pointer for exactly this
 * stretch of the gesture, and for no other.
 *
 * It is not stopped where it is caught: it finishes what it was doing under the
 * hand and is picked up from wherever it got to, which is where it visibly is —
 * a press has to be held a moment before it counts as a carry, about as long as
 * these journeys last. What catching it does change is that the copy is not taken
 * away while a hand is on it: `settled()` waits the press out, so a carry has the
 * time to be born.
 *
 * THE PRESS IS READ AT THE DOCUMENT, and the copy's own box is only the shape it
 * is matched against. A press landing on it does not always reach it: an answer
 * that runs a view transition (which is the usual answer — it is what makes a
 * landing continuous) has the browser cover the page with its pictures, and every
 * press then goes to the document root whatever those pictures are told about
 * pointer events. Read from the document and matched against the box, it is
 * caught either way. Same reason, same shape as the box of travelling pages
 * (see route_travel.jsx in navi).
 *
 * @returns {{settled: function}} `settled()` resolves to whether the copy was
 * taken back in hand — and then it belongs to the new gesture, not to this one.
 */
const letCopyBeCaught = (cloneWrapper, carryAgain) => {
  let caught = false;
  let pressIsOver = Promise.resolve();
  const onPointerDown = (pointerDownEvent) => {
    const { left, right, top, bottom } = cloneWrapper.getBoundingClientRect();
    const { clientX, clientY } = pointerDownEvent;
    if (
      clientX < left ||
      clientX > right ||
      clientY < top ||
      clientY > bottom
    ) {
      // Somewhere else on the page: this press is not about the copy.
      return;
    }
    let pressIsOverResolve;
    pressIsOver = new Promise((resolve) => {
      pressIsOverResolve = resolve;
    });
    const onPointerEnd = () => {
      window.removeEventListener("pointerup", onPointerEnd, true);
      window.removeEventListener("pointercancel", onPointerEnd, true);
      pressIsOverResolve();
    };
    window.addEventListener("pointerup", onPointerEnd, true);
    window.addEventListener("pointercancel", onPointerEnd, true);
    carryAgain(pointerDownEvent, () => {
      caught = true;
      onPointerEnd();
    });
  };
  // The attribute is what gives the copy the pointer (see the stylesheet): read
  // at the document or not, a press meant for the copy must land ON it, so the
  // gesture holds what it grabbed rather than whatever was behind.
  cloneWrapper.setAttribute("data-catchable", "");
  document.addEventListener("pointerdown", onPointerDown, true);
  // The touch half of the same reach, said on the root because that is where a
  // finger pressing through the pictures lands (see the stylesheet). Both go
  // down before the copy sets off, since what a touch may do is settled when it
  // begins: put down later, the press is still read, the carry still starts, and
  // the browser cancels the pointer one move afterwards — a copy that cannot be
  // caught with a finger and can with a mouse.
  const root = document.documentElement;
  root.setAttribute("data-drag-catchable", "");
  root.addEventListener("touchmove", keepTouchRefusable, { passive: false });

  return {
    settled: async () => {
      // A hand that lets go and presses again while the copy is still there is
      // one more press to wait out, not a press that was already over.
      let awaited;
      while (awaited !== pressIsOver) {
        awaited = pressIsOver;
        await awaited;
      }
      cloneWrapper.removeAttribute("data-catchable");
      document.removeEventListener("pointerdown", onPointerDown, true);
      root.removeAttribute("data-drag-catchable");
      root.removeEventListener("touchmove", keepTouchRefusable);
      return caught;
    },
  };
};

// What a copy is given when it is picked up: the point it lifts FROM, and the
// lift itself. Both are lost by a copy that has already been let go of — a
// landing drops the lift (see syncCloneWithDropTarget) and the hand catching it
// again is somewhere else on it — so taking one back hands it both again.
const liftDragClone = (cloneWrapper, pointerEvent) => {
  const rect = cloneWrapper.getBoundingClientRect();
  cloneWrapper.style.setProperty(
    "--drag-origin",
    `${pointerEvent.clientX - rect.left}px ${pointerEvent.clientY - rect.top}px`,
  );
  cloneWrapper.firstElementChild.setAttribute("navi-drag-clone", "");
};

const createDragClone = (element, pointerEvent) => {
  const rect = element.getBoundingClientRect();

  const wrapper = document.createElement("div");
  wrapper.setAttribute("navi-drag-clone-wrapper", "");
  // A copy can be caught on its way home (see settleCloneBack), which is a press
  // that may become a drag — so it carries what such a press needs, and it
  // carries it from the moment it exists: what a touch may do is decided when the
  // touch begins, and by then this has to have been true for a while.
  markDragSource(wrapper);
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
  const elementClone = element.cloneNode(true);
  // A deep copy copies the ids too, and two elements answering to one id is a
  // document that lies: getElementById picks whichever comes first, an anchor
  // resolves to the wrong one, a view-transition-name is claimed twice and the
  // transition is dropped. The copy is a picture of the thing, not another one of
  // it — so it answers to no name at all.
  elementClone.removeAttribute("id");
  for (const descendantWithId of elementClone.querySelectorAll("[id]")) {
    descendantWithId.removeAttribute("id");
  }
  elementClone.setAttribute("navi-drag-clone", "");
  // What is held is the copy, so it is the copy that must LOOK held: the caller
  // dresses `[data-grabbed]` on its own element once, and the copy is that element.
  // (The original wears it too, but it is hidden — see navi-drag-clone-source.)
  elementClone.setAttribute("data-grabbed", "");
  elementClone.style.viewTransitionName = "navi-drag-clone";
  // The copy takes the wrapper's box, and nothing the page said about where the
  // ORIGINAL stands may place it: a piece drawn at "left: 40px; top: 130px" on
  // its board, a marker centred by a translate, a card pushed by a margin — the
  // deep copy carries all of that, inline styles included, and would sit that far
  // from the wrapper's corner, so from the hand. Written inline on the copy
  // because that is the one place that outranks both the inline values it copied
  // and any rule of the page's, without a stylesheet having to shout !important.
  elementClone.style.position = "absolute";
  elementClone.style.inset = "0";
  elementClone.style.margin = "0";
  elementClone.style.translate = "none";

  wrapper.appendChild(elementClone);
  // Beside the thing it copies, so it stands where that thing stands: every
  // inherited value and every custom property the original reads, the copy reads
  // too, and a rule written for an item in this list finds the copy as well. The
  // top layer is what lets it stay there — a popover is painted above the page
  // whatever its depth in the tree, and being fixed keeps it out of the
  // scrollable overflow of the list it sits in.
  element.parentElement.appendChild(wrapper);

  return wrapper;
};

// The nearest word about the press wins: an opted-out area INSIDE the dragged
// element takes the press away from it, one AROUND it does not — a list
// reordered inside a dialog, or a dialog carried by its own handle, is itself the
// last thing said before the finger.
const isPressIgnored = (target, draggedElement) => {
  if (!target.closest) {
    return false;
  }
  const ignored = target.closest(DRAG_IGNORED_SELECTOR);
  return Boolean(ignored) && !ignored.contains(draggedElement);
};
