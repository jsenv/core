import { dragAfterThreshold } from "./drag_gesture.js";
import {
  createDragToMoveGestureController,
  dragStyleController,
} from "./drag_to_move.js";
import { getDropTargetInfo } from "./drop_target_detection.js";
import { moveCSSVars } from "./move_css_vars.js";

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
    transform: scale(var(--drag-clone-scale, 1.15));
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

const dragCSSVars = [
  "--drop-hint-size",
  "--drop-hint-background-color",
  "--drop-hint-border-radius",
  "--drop-hint-margin-x",
  "--drop-hint-margin-y",
  "--drag-clone-scale",
];

/**
 * Starts a drag-to-reorder interaction on a list item.
 *
 * Handles the full reorder UX:
 * - Activates only after a short movement threshold (avoids accidental reorders on clicks).
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
 * @param {PointerEvent} event
 *   The `pointerdown` event from the drag handle.
 * @param {Element} draggedElement
 *   The list item element to drag. Typically `event.currentTarget`.
 * @param {object} options
 * @param {string} options.itemSelector
 *   CSS selector that matches all list items inside the scroll container.
 *   Used for drop-target detection and no-op filtering.
 * @param {function} options.getItemId
 *   Returns the stable ID for a given DOM element.
 *   Signature: `getItemId(element) → id`.
 * @param {function} options.onReorder
 *   Called when the user drops the item in a new position.
 *   Signature: `onReorder(fromId, toId)`.
 *   - `fromId`: stable ID of the dragged item.
 *   - `toId`: stable ID of the item to insert before, or `null` to append at the end.
 *   Called inside `document.startViewTransition` so the resulting DOM mutation is
 *   animated by the View Transitions API.
 * @param {object} [options.direction={ x: false, y: true }]
 *   Axes along which dragging is allowed. Passed to `createDragToMoveGestureController`.
 * @param {...*} [options]
 *   Any remaining options are forwarded to `createDragToMoveGestureController`
 *   (e.g. `areaConstraint`, `autoScrollAreaPadding`, `stickyFrontiers`).
 *   `releasePositionEffect` is always set to `"manual"` internally and cannot be overridden.
 */
export const startDragToReorder = (
  event,
  draggedElement,
  {
    itemSelector,
    getItemId,
    onReorder,
    direction = { x: false, y: true },
    ...options
  },
) => {
  import.meta.css = css;
  event.preventDefault();
  return dragAfterThreshold(event, () => {
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

    const scrollContainer = dragGesture.gestureInfo.scrollContainer;
    const getTargets = () => {
      return Array.from(scrollContainer.querySelectorAll(itemSelector));
    };

    const dropHintEl = document.createElement("div");
    dropHintEl.className = "navi_drop_hint";
    scrollContainer.appendChild(dropHintEl);

    // currentBeforeElement: element before which the grabbed item will be inserted (null = end)
    // currentReleaseElement: the actual hovered drop target — used to snap the clone on release
    let currentBeforeElement;
    let currentReleaseElement;

    const clearDropHintDOM = () => {
      scrollContainer.removeAttribute("data-drop-edge");
      scrollContainer.style.removeProperty("--drop-target-top");
      scrollContainer.style.removeProperty("--drop-target-bottom");
      scrollContainer.style.removeProperty("--drop-target-left");
      scrollContainer.style.removeProperty("--drop-target-width");
    };

    const clearDropHint = () => {
      currentBeforeElement = undefined;
      currentReleaseElement = undefined;
      clearDropHintDOM();
    };

    dragGesture.addDragCallback((gestureInfo) => {
      const items = getTargets();
      const dropTargetInfo = getDropTargetInfo(gestureInfo, items);
      gestureInfo.dropTargetInfo = dropTargetInfo || null;
      // When hovering over the grabbed element, treat it as no drop target.
      if (!dropTargetInfo || dropTargetInfo.element === draggedElement) {
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
      const elementIndex = items.indexOf(draggedElement);
      const elementNextItem = items[elementIndex + 1] ?? null;
      const isNoop =
        beforeElement === draggedElement || beforeElement === elementNextItem;
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
      const anchorEl =
        beforeElement || items.findLast((el) => el !== draggedElement);
      const anchorEdge = beforeElement !== null ? "top" : "bottom";
      const containerRect = scrollContainer.getBoundingClientRect();
      const anchorRect = anchorEl.getBoundingClientRect();
      const isPositioned =
        getComputedStyle(scrollContainer).position !== "static";
      const scrollOffsetLeft = isPositioned ? scrollContainer.scrollLeft : 0;
      const scrollOffsetTop = isPositioned ? scrollContainer.scrollTop : 0;
      scrollContainer.setAttribute("data-drop-edge", anchorEdge);
      scrollContainer.style.setProperty(
        "--drop-target-top",
        `${anchorRect.top - containerRect.top + scrollOffsetTop}px`,
      );
      scrollContainer.style.setProperty(
        "--drop-target-bottom",
        `${anchorRect.bottom - containerRect.top + scrollOffsetTop}px`,
      );
      scrollContainer.style.setProperty(
        "--drop-target-left",
        `${anchorRect.left - containerRect.left + scrollOffsetLeft}px`,
      );
      scrollContainer.style.setProperty(
        "--drop-target-width",
        `${anchorRect.width}px`,
      );
    });

    dragGesture.addReleaseCallback(async () => {
      clearDropHintDOM();
      dropHintEl.remove();
      restoreCSSVars();

      if (currentBeforeElement !== undefined) {
        const clone = cloneWrapper.firstElementChild;
        // Bake the current visual position (transform included) into the CSS vars
        // so the clone stays where the user released it when we clear the transform.
        setCloneDocumentRect(cloneWrapper, cloneWrapper);
        dragStyleController.clear(cloneWrapper);
        const viewTransition = document.startViewTransition(() => {
          // Snap the CSS-var position to the drop target rect so the browser
          // captures the "new" state at the landing position.
          setCloneDocumentRect(cloneWrapper, currentReleaseElement);
          // Removing this attr drops the CSS scale(1.15), so the browser
          // captures the clone at scale 1 as the "new" state.
          clone.removeAttribute("navi-drag-clone");

          const fromId = getItemId(draggedElement);
          const toId = currentBeforeElement
            ? getItemId(currentBeforeElement)
            : null;
          onReorder(fromId, toId);
        });
        await viewTransition.finished;
      }
      draggedElement.removeAttribute("navi-drag-clone-source");
      cloneWrapper.remove();
    });

    return dragGesture;
  });
};

// getBoundingClientRect() returns viewport-relative coords.
// The clone wrapper is position:absolute inside document.body, so we need
// document-relative coords (viewport coords + current page scroll).
const setCloneDocumentRect = (cloneWrapper, el) => {
  const rect = el.getBoundingClientRect();
  const scrollLeft = document.documentElement.scrollLeft;
  const scrollTop = document.documentElement.scrollTop;
  cloneWrapper.style.setProperty("--clone-top", `${rect.top + scrollTop}px`);
  cloneWrapper.style.setProperty("--clone-left", `${rect.left + scrollLeft}px`);
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
const createDragClone = (element, pointerEvent) => {
  const rect = element.getBoundingClientRect();

  const wrapper = document.createElement("div");
  wrapper.setAttribute("navi-drag-clone-wrapper", "");
  wrapper.viewTransitionName = "navi-drag-clone-wrapper";
  setCloneDocumentRect(wrapper, element);
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
]);
