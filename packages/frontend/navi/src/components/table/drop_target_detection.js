/**
 * Detects the drop target index based on the position of a dragged element relative to potential drop targets.
 * Uses edge-based detection for more intuitive dropping behavior.
 * When multiple targets overlap, picks the one with the best overlap or closest center.
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
  let draggedCenter;
  if (axis === "x") {
    draggedStart = draggedRect.left;
    draggedEnd = draggedRect.right;
    draggedCenter = draggedStart + (draggedEnd - draggedStart) / 2;
  } else {
    draggedStart = draggedRect.top;
    draggedEnd = draggedRect.bottom;
    draggedCenter = draggedStart + (draggedEnd - draggedStart) / 2;
  }

  const candidates = [];
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
      const overlapAmount = Math.min(draggedEnd, targetCenter) - draggedStart;
      const distanceToCenter = Math.abs(draggedCenter - targetCenter);
      candidates.push({
        element: targetElement,
        index: i,
        position: "start",
        overlapAmount,
        distanceToCenter,
      });
    }

    // Check if dragged element's end edge is in the right/bottom half of this target
    if (draggedEnd > targetCenter && draggedEnd <= targetEnd) {
      const overlapAmount = draggedEnd - Math.max(draggedStart, targetCenter);
      const distanceToCenter = Math.abs(draggedCenter - targetCenter);
      candidates.push({
        element: targetElement,
        index: i,
        position: "end",
        overlapAmount,
        distanceToCenter,
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  // Multiple candidates - pick the best one
  // Strategy: prioritize by overlap amount, then by distance to center
  candidates.sort((a, b) => {
    // First, prefer larger overlap
    const overlapDiff = b.overlapAmount - a.overlapAmount;
    if (Math.abs(overlapDiff) > 1) {
      // Use small threshold to handle floating point precision
      return overlapDiff;
    }
    // If overlap is similar, prefer closer to center
    return a.distanceToCenter - b.distanceToCenter;
  });

  return candidates[0];
};
