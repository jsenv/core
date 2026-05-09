import { dragAfterThreshold } from "./drag_gesture.js";
import { createDragToMoveGestureController } from "./drag_to_move.js";

// IDs are used as the intermediate between DOM elements and JS state because:
// 1. Not all DOM elements matching itemSelector may be valid drop targets
//    (holes in the structure), so DOM indices don't reliably map to state indices.
// 2. Virtual lists render fewer DOM nodes than the total item count, so
//    DOM-index-based counting would be completely wrong.
// By exchanging IDs, the caller can do its own lookup into whatever data
// structure it uses (full array, Map, signal, etc.).
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
  event.preventDefault();
  dragAfterThreshold(event, () => {
    const gestureController = createDragToMoveGestureController({
      cloneOnDrag: true,
      direction,
      dropTargetSelector: itemSelector,
      dropHint: true,
      applyDropEffect: (beforeElement, gestureInfo) => {
        const { grabElement } = gestureInfo;
        const fromId = getItemId(grabElement);
        const toId = beforeElement ? getItemId(beforeElement) : null;
        onReorder(fromId, toId);
      },
      ...options,
    });
    return gestureController.grabViaPointer(event, {
      element: draggedElement,
    });
  });
};
