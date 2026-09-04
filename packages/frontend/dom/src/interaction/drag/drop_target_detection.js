/**
 * Detects the drop target based on what element is actually under the mouse cursor.
 * Uses document.elementsFromPoint() to respect visual stacking order naturally,
 * and falls back on the rectangles alone when the hit test cannot answer — which
 * is not only "over nothing": during a view transition the browser hands back the
 * root for every point of the page (see findTargetByGeometry).
 *
 * @param {Object} gestureInfo - Gesture information
 * @param {Element[]} targetElements - Array of potential drop target elements
 * @param {object} [options]
 * @param {Element} [options.dragElement] - The element being dragged. When provided and
 *   `fallbackToEdge` is true, used to compute the fallback rect.
 * @param {boolean} [options.fallbackToEdge=false] - When true and the drag element does
 *   not intersect any target, falls back to the first item (if above all items) or the
 *   last item (if below all items) so there is always a valid drop target at list edges.
 * @returns {Object|null} Drop target info with elementSide or null if no valid target found
 */
export const getDropTargetInfo = (
  gestureInfo,
  targetElements,
  { fallbackToEdge = false } = {},
) => {
  const dragElement = gestureInfo.elementImpacted || gestureInfo.element;
  const dragElementRect = dragElement.getBoundingClientRect();
  const intersectingTargets = [];
  let someTargetIsCol;
  let someTargetIsTr;
  for (const targetElement of targetElements) {
    const targetRect = targetElement.getBoundingClientRect();
    if (!rectangleAreIntersecting(dragElementRect, targetRect)) {
      continue;
    }
    if (!someTargetIsCol && targetElement.tagName === "COL") {
      someTargetIsCol = true;
    }
    if (!someTargetIsTr && targetElement.tagName === "TR") {
      someTargetIsTr = true;
    }
    intersectingTargets.push(targetElement);
  }

  if (intersectingTargets.length === 0) {
    if (fallbackToEdge) {
      const dragElement = gestureInfo.elementImpacted || gestureInfo.element;
      const dragElementRect = dragElement.getBoundingClientRect();
      const firstItem = targetElements[0];
      const lastItem = targetElements[targetElements.length - 1];
      if (
        firstItem &&
        dragElementRect.bottom < firstItem.getBoundingClientRect().top
      ) {
        // Drag element is above all items → treat as hovering the first item from the top.
        return {
          element: firstItem,
          elementSide: { x: "start", y: "start" },
          index: 0,
          intersectingIndex: 0,
          intersecting: [firstItem],
        };
      }
      if (
        lastItem &&
        dragElementRect.top > lastItem.getBoundingClientRect().bottom
      ) {
        // Drag element is below all items → treat as hovering the last item from the bottom.
        return {
          element: lastItem,
          elementSide: { x: "start", y: "end" },
          index: targetElements.length - 1,
          intersectingIndex: 0,
          intersecting: [lastItem],
        };
      }
    }
    return null;
  }

  const dragElementCenterX = dragElementRect.left + dragElementRect.width / 2;
  const dragElementCenterY = dragElementRect.top + dragElementRect.height / 2;
  // Clamp coordinates to viewport to avoid issues with elementsFromPoint
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const clientX =
    dragElementCenterX < 0
      ? 0
      : dragElementCenterX > viewportWidth
        ? viewportWidth - 1
        : dragElementCenterX;
  const clientY =
    dragElementCenterY < 0
      ? 0
      : dragElementCenterY > viewportHeight
        ? viewportHeight - 1
        : dragElementCenterY;

  // Find the first target element in the stack (topmost visible target)
  const elementsUnderDragElement = document.elementsFromPoint(clientX, clientY);
  let targetElement = null;
  let targetIndex = -1;
  let intersectingIndex = -1;
  for (const element of elementsUnderDragElement) {
    // First, check if the element itself is a target
    const directIndex = intersectingTargets.indexOf(element);
    if (directIndex !== -1) {
      targetElement = element;
      intersectingIndex = directIndex;
      break;
    }
    // Special case: if element is <td> or <th> and not in targets,
    // try to find its corresponding <col> element
    if (!isTableCell(element)) {
      continue;
    }
    try_col: {
      if (!someTargetIsCol) {
        break try_col;
      }
      const tableCellCol = findTableCellCol(element);
      if (!tableCellCol) {
        break try_col;
      }
      const colIndex = intersectingTargets.indexOf(tableCellCol);
      if (colIndex === -1) {
        break try_col;
      }
      targetElement = tableCellCol;
      intersectingIndex = colIndex;
      break;
    }
    try_tr: {
      if (!someTargetIsTr) {
        break try_tr;
      }
      const tableRow = element.closest("tr");
      const rowIndex = targetElements.indexOf(tableRow);
      if (rowIndex === -1) {
        break try_tr;
      }
      targetElement = tableRow;
      intersectingIndex = intersectingTargets.indexOf(tableRow);
      break;
    }
  }
  if (!targetElement) {
    // Nothing in the stack answered. The point may be over no target at all —
    // and it may also be over one the hit test cannot see: a view transition
    // covers the page with its pictures, and from then on every point of the
    // document reads as the root, whatever is really under it. Taking the first
    // of the overlapped targets then means taking the first one in DOM ORDER,
    // which has nothing to do with where the hand is: a piece carried onto the
    // place next door comes back down on the place it left, and the hint says so
    // by lighting up the wrong one.
    //
    // Geometry is what is left, and it is the reading the eye makes anyway: the
    // place the middle of the carried thing is IN, or — the middle being over a
    // gap — the one it covers most of.
    targetElement = findTargetByGeometry(intersectingTargets, dragElementRect);
    intersectingIndex = intersectingTargets.indexOf(targetElement);
  }
  targetIndex = targetElements.indexOf(targetElement);

  // Determine position within the target for both axes.
  //
  // Use the leading edge of the dragged element (in the direction of movement)
  // compared against the target's center:
  //   - Dragging down: "after" as soon as the bottom crosses the target center.
  //   - Dragging up:   "before" as soon as the top crosses the target center.
  //   - Not moving: center-vs-center fallback.
  //
  // This gives consistent, predictable thresholds regardless of element size.
  const targetRect = targetElement.getBoundingClientRect();
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const { intentGoingDown, intentGoingUp, intentGoingRight, intentGoingLeft } =
    gestureInfo;
  let sideY;
  if (intentGoingDown) {
    sideY = dragElementRect.bottom > targetCenterY ? "end" : "start";
  } else if (intentGoingUp) {
    sideY = dragElementRect.top < targetCenterY ? "start" : "end";
  } else {
    sideY = dragElementCenterY < targetCenterY ? "start" : "end";
  }
  let sideX;
  if (intentGoingRight) {
    sideX = dragElementRect.right > targetCenterX ? "end" : "start";
  } else if (intentGoingLeft) {
    sideX = dragElementRect.left < targetCenterX ? "start" : "end";
  } else {
    sideX = dragElementCenterX < targetCenterX ? "start" : "end";
  }
  const result = {
    // NOTE: avoid relying on `index` in application code. The targetElements
    // array may be dynamically filtered (e.g. excluding the grabbed element),
    // making this index inconsistent with the full list. Use `element` instead
    // and look up its position yourself from your own data source.
    index: targetIndex,
    element: targetElement,
    elementSide: {
      x: sideX,
      y: sideY,
    },
    // Index within the intersecting subset — could be useful to know how many
    // elements were overlapping, but rarely needed in practice
    intersectingIndex,
    intersecting: intersectingTargets,
  };
  return result;
};

/**
 * Which of the overlapped targets the carried thing is on, said with rectangles
 * alone: the one holding its centre, or the one it covers the most of. Used when
 * the hit test cannot answer (see its caller).
 */
const findTargetByGeometry = (targetElements, dragElementRect) => {
  const dragCenterX = dragElementRect.left + dragElementRect.width / 2;
  const dragCenterY = dragElementRect.top + dragElementRect.height / 2;
  let bestElement = null;
  let bestOverlapArea = -1;
  for (const targetElement of targetElements) {
    const targetRect = targetElement.getBoundingClientRect();
    if (
      dragCenterX >= targetRect.left &&
      dragCenterX <= targetRect.right &&
      dragCenterY >= targetRect.top &&
      dragCenterY <= targetRect.bottom
    ) {
      return targetElement;
    }
    const overlapWidth =
      Math.min(targetRect.right, dragElementRect.right) -
      Math.max(targetRect.left, dragElementRect.left);
    const overlapHeight =
      Math.min(targetRect.bottom, dragElementRect.bottom) -
      Math.max(targetRect.top, dragElementRect.top);
    const overlapArea = overlapWidth * overlapHeight;
    if (overlapArea > bestOverlapArea) {
      bestOverlapArea = overlapArea;
      bestElement = targetElement;
    }
  }
  return bestElement;
};

export const rectangleAreIntersecting = (r1, r2) => {
  return !(
    r2.left > r1.right ||
    r2.right < r1.left ||
    r2.top > r1.bottom ||
    r2.bottom < r1.top
  );
};

const isTableCell = (el) => {
  return el.tagName === "TD" || el.tagName === "TH";
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
  const cols = colgroup.querySelectorAll("col");
  const columnIndex = cellElement.cellIndex;
  const correspondingCol = cols[columnIndex];
  return correspondingCol;
};
