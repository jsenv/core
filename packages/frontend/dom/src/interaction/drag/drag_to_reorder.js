import { dragAfterIntent } from "./drag_after_intent.js";
import { isPrimaryButtonEvent } from "./drag_gesture.js";
import { createDragToMoveGestureController } from "./drag_to_move.js";
import { getDropTargetInfo } from "./drop_target_detection.js";
import { moveCSSVars } from "./move_css_vars.js";

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
     startDragToReorder).
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
  [data-drag-ignore] {
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
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22);
    opacity: 0.95;
    transition: box-shadow 0.15s ease;
    pointer-events: none;
    overflow: visible;
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
// At module scope, not inside startDragToReorder: the cursor rules above say who
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
 * @param {string} options.itemSelector
 *   CSS selector that matches all list items inside `containerElement`.
 *   Used for drop-target detection and no-op filtering.
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
export const startDragToReorder = (
  event,
  {
    draggedElement = event.currentTarget,
    containerElement = draggedElement.parentElement,
    itemSelector,
    getItemId,
    onReorder,
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
        ...options,
      });
      const dragGesture = gestureController.grabViaPointer(event, {
        element: draggedElement,
        elementToMove: cloneWrapper,
      });
      // getDropTargetInfo uses gestureInfo.elementImpacted to compute the dragged rect.
      // Point it at the clone so drop detection tracks the clone's current position.
      dragGesture.gestureInfo.elementImpacted = cloneWrapper;

      const dropHintEl = createDropHint();
      document.body.appendChild(dropHintEl);
      // The hint first, the clone second: that order is what stacks them in the
      // top layer.
      dropHintEl.showPopover();
      cloneWrapper.showPopover();

      // currentBeforeElement: element before which the grabbed item will be inserted (null = end)
      // currentReleaseElement: the actual hovered drop target — used to snap the clone on release
      let currentBeforeElement;
      let currentReleaseElement;

      const clearDropHintDOM = () => {
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
        dropHintEl.remove();
        restoreCSSVars();

        if (currentBeforeElement !== undefined) {
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
