/**
 * Detects the drop target index based on the position of a dragged element relative to potential drop targets.
 * Uses edge-based detection for more intuitive dropping behavior.
 *
 * @param {Object} params - Configuration object
 * @param {Element} params.draggedElement - The element being dragged (ghost/clone)
 * @param {Element[]} params.targetElements - Array of potential drop target elements
 * @param {string} params.axis - The axis to check ('x' or 'y')
 * @param {number} params.defaultIndex - Default index to return if no match found
 * @param {string} [params.mode='direct'] - 'direct' returns element index, 'frontier' returns before/after index
 * @returns {number} The index of the target element where the drop should occur
 */
export const getDropTargetInfo = ({ draggedElement, targetElements, axis }) => {
  const draggedRect = draggedElement.getBoundingClientRect();

  // Get the start and end positions of the dragged element based on axis
  let draggedStart;
  let draggedEnd;
  if (axis === "x") {
    draggedStart = draggedRect.left;
    draggedEnd = draggedRect.right;
  } else {
    draggedStart = draggedRect.top;
    draggedEnd = draggedRect.bottom;
  }

  for (let i = 0; i < targetElements.length; i++) {
    const targetElement = targetElements[i];
    const targetRect = targetElement.getBoundingClientRect();

    // Get target element bounds based on axis
    let targetStart;
    let targetEnd;
    if (axis === "x") {
      targetStart = targetRect.left;
      targetEnd = targetRect.right;
    } else {
      targetStart = targetRect.top;
      targetEnd = targetRect.bottom;
    }

    const targetCenter = targetStart + (targetEnd - targetStart) / 2;

    // Check if dragged element's start edge is in the left/top half of this target
    if (draggedStart >= targetStart && draggedStart < targetCenter) {
      return { element: targetElement, index: i, position: "start" };
    }

    // Check if dragged element's end edge is in the right/bottom half of this target
    if (draggedEnd > targetCenter && draggedEnd <= targetEnd) {
      return { element: targetElement, index: i, position: "end" };
    }
  }

  return null;
};
