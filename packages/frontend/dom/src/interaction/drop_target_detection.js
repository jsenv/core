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
 * @returns {Object|null} Drop target info with elementSide or null if no valid target found
 */
export const getDropTargetInfo = (gestureInfo, targetElements) => {
  const { positionedParent, scrollableParent } = gestureInfo;

  // Convert relative coordinates back to viewport coordinates for elementsFromPoint
  const parentRect = positionedParent.getBoundingClientRect();
  const mouseX = gestureInfo.x + parentRect.left - scrollableParent.scrollLeft;
  const mouseY = gestureInfo.y + parentRect.top - scrollableParent.scrollTop;

  // Get all elements under the mouse cursor (respects stacking order)
  const elementsUnderMouse = document.elementsFromPoint(mouseX, mouseY);
  console.log({ mouseX }, elementsUnderMouse);

  // Find the first target element in the stack (topmost visible target)
  let targetElement = null;
  let targetIndex = -1;

  const someTargetIsCol = targetElements.some((el) => el.tagName === "COL");

  for (const element of elementsUnderMouse) {
    // First, check if the element itself is a target
    const directIndex = targetElements.indexOf(element);
    if (directIndex !== -1) {
      targetElement = element;
      targetIndex = directIndex;
      break;
    }
    // Special case: if element is <td> or <th> and not in targets,
    // try to find its corresponding <col> element
    if (!someTargetIsCol) {
      continue;
    }
    const isTableCell = element.tagName === "TD" || element.tagName === "TH";
    if (!isTableCell) {
      continue;
    }
    const tableCellCol = findTableCellCol(element, targetElements);
    if (!tableCellCol) {
      continue;
    }
    const colIndex = targetElements.indexOf(tableCellCol);
    if (colIndex === -1) {
      continue;
    }
    targetElement = tableCellCol;
    targetIndex = colIndex;
    break;
  }

  if (!targetElement) {
    return null;
  }

  // Determine position within the target for both axes
  const targetBounds = targetElement.getBoundingClientRect();
  const targetCenterX = targetBounds.left + targetBounds.width / 2;
  const targetCenterY = targetBounds.top + targetBounds.height / 2;
  const result = {
    index: targetIndex,
    element: targetElement,
    elementSide: {
      x: mouseX < targetCenterX ? "start" : "end",
      y: mouseY < targetCenterY ? "start" : "end",
    },
  };
  return result;
};

/**
 * Find the corresponding <col> element for a given <td> or <th> cell
 * @param {Element} cellElement - The <td> or <th> element
 * @param {Element[]} targetColElements - Array of <col> elements to search in
 * @returns {Element|null} The corresponding <col> element or null if not found
 */
const findTableCellCol = (cellElement) => {
  const table = cellElement.closest("table");
  const colgroup = table.querySelector("colgroup");
  if (!colgroup) {
    return null;
  }
  const cols = Array.from(colgroup.querySelectorAll("col"));
  const row = cellElement.closest("tr");
  const cellsInRow = Array.from(row.children);
  const columnIndex = cellsInRow.indexOf(cellElement);
  const correspondingCol = cols[columnIndex];
  return correspondingCol;
};
