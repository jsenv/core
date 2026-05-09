import { dragAfterThreshold } from "./drag_gesture.js";
import { createDragToMoveGestureController } from "./drag_to_move.js";

/**
 * Starts a drag-to-reorder interaction on a list item.
 *
 * Wraps `dragAfterThreshold` + `createDragToMoveGestureController` with
 * sensible defaults for reorderable lists (clone on drag, drop hint, y-axis).
 *
 * @param {PointerEvent} event - The pointerdown event from the drag handle.
 * @param {Element} draggedElement - The list item element being dragged.
 * @param {object} options
 * @param {string} options.itemSelector
 *   CSS selector that matches all list items inside the scroll container.
 * @param {function} options.onReorder
 *   Called when the user drops the item in a new position.
 *   Signature: `onReorder(fromIndex, toIndex)`.
 *   - `fromIndex`: index in the items list where the drag started.
 *   - `toIndex`: index where the item should be inserted.
 * @param {object} [options.direction={ x: false, y: true }]
 *   Axes along which dragging is allowed.
 */
export const startDragToReorder = (
  event,
  draggedElement,
  { itemSelector, onReorder, direction = { x: false, y: true } },
) => {
  event.preventDefault();
  dragAfterThreshold(event, () => {
    const gestureController = createDragToMoveGestureController({
      cloneOnDrag: true,
      direction,
      dropTargetSelector: itemSelector,
      dropHint: true,
      applyDropEffect: (beforeElement, gestureInfo) => {
        const { grabElement, scrollContainer } = gestureInfo;
        const items = Array.from(
          scrollContainer.querySelectorAll(itemSelector),
        );
        const fromIndex = items.indexOf(grabElement);
        let toIndex;
        if (beforeElement === null) {
          toIndex = items.length;
        } else {
          toIndex = items.indexOf(beforeElement);
        }
        const adjustedToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
        onReorder(fromIndex, adjustedToIndex);
      },
    });
    return gestureController.grabViaPointer(event, {
      element: draggedElement,
    });
  });
};
