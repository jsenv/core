/**
 * Detects the drop target based on what element is actually under the mouse cursor.
 * Uses document.elementsFromPoint() to respect visual stacking order naturally.
 *
 * @param {Object} gestureInfo - Gesture information containing mouse coordinates and direction
 * @param {number} gestureInfo.x - Mouse X position relative to positioned parent
 * @param {number} gestureInfo.y - Mouse Y position relative to positioned parent
 * @param {Object} gestureInfo.direction - Direction configuration {x: boolean, y: boolean}
 * @param {Element} gestureInfo.positionedParent - The positioned parent element
 * @param {Element} gestureInfo.scrollableParent - The scrollable parent element
 * @param {Element[]} targetElements - Array of potential drop target elements
 * @returns {Object|null} Drop target info with xSide/ySide or null if no valid target found
 */
export const getDropTargetInfo = (gestureInfo, targetElements) => {
  const { positionedParent, scrollableParent } = gestureInfo;

  // Convert relative coordinates back to viewport coordinates for elementsFromPoint
  const parentRect = positionedParent.getBoundingClientRect();
  const mouseX = gestureInfo.x + parentRect.left - scrollableParent.scrollLeft;
  const mouseY = gestureInfo.y + parentRect.top - scrollableParent.scrollTop;

  // Get all elements under the mouse cursor (respects stacking order)
  const elementsUnderMouse = document.elementsFromPoint(mouseX, mouseY);

  // Find the first target element in the stack (topmost visible target)
  let targetElement = null;
  let targetIndex = -1;

  for (const element of elementsUnderMouse) {
    const index = targetElements.indexOf(element);
    if (index !== -1) {
      targetElement = element;
      targetIndex = index;
      break;
    }
  }

  if (!targetElement) {
    return null;
  }

  // Determine position within the target for both axes
  const targetBounds = targetElement.getBoundingClientRect();
  const targetCenterX = targetBounds.left + targetBounds.width / 2;
  const targetCenterY = targetBounds.top + targetBounds.height / 2;
  const result = {
    element: targetElement,
    index: targetIndex,
    side: {
      x: mouseX < targetCenterX ? "start" : "end",
      y: mouseY < targetCenterY ? "start" : "end",
    },
  };
  return result;
};
