import { canInterceptKeys } from "../keyboard.js";
import {
  findAfter,
  findBefore,
  findDescendant,
  findLastDescendant,
} from "../traversal.js";
import { elementIsFocusable } from "./element_is_focusable.js";
import { createEventMarker } from "./event_marker.js";
import { getFocusGroup } from "./focus_group_registry.js";

const DEBUG = false;

const arrowFocusNavEventMarker = createEventMarker("arrow_focus_nav");
export const performArrowNavigation = (
  event,
  element,
  { direction = "both", loop, name } = {},
) => {
  if (!canInterceptKeys(event)) {
    return false;
  }
  if (arrowFocusNavEventMarker.isMarked(event)) {
    // Prevent double handling of the same event
    return false;
  }

  const activeElement = document.activeElement;

  const onTargetToFocus = (targetToFocus) => {
    console.debug(
      `Arrow navigation: ${event.key} from`,
      activeElement,
      "to",
      targetToFocus,
    );
    event.preventDefault();
    arrowFocusNavEventMarker.mark(event);
    targetToFocus.focus();
  };

  // Grid navigation: we support only TABLE element for now
  // A role="table" or an element with display: table could be used too but for now we need only TABLE support
  if (element.tagName === "TABLE") {
    const targetInGrid = getTargetInTableFocusGroup(event, element, { loop });
    if (!targetInGrid) {
      return false;
    }
    onTargetToFocus(targetInGrid);
    return true;
  }

  const targetInLinearGroup = getTargetInLinearFocusGroup(event, element, {
    direction,
    loop,
    name,
  });
  if (!targetInLinearGroup) {
    return false;
  }
  onTargetToFocus(targetInLinearGroup);
  return true;
};

const getTargetInLinearFocusGroup = (
  event,
  element,
  { direction, loop, name },
) => {
  const activeElement = document.activeElement;
  const isForward = isForwardArrow(event, direction);

  // Arrow Left/Up: move to previous focusable element in group
  backward: {
    if (!isBackwardArrow(event, direction)) {
      break backward;
    }
    const previousElement = findBefore(activeElement, elementIsFocusable, {
      root: element,
    });
    if (previousElement) {
      return previousElement;
    }
    const ancestorTarget = delegateArrowNavigation(event, element, {
      direction,
      loop,
      name,
    });
    if (ancestorTarget) {
      return ancestorTarget;
    }
    if (loop) {
      const lastFocusableElement = findLastDescendant(
        element,
        elementIsFocusable,
      );
      if (lastFocusableElement) {
        return lastFocusableElement;
      }
    }
    return null;
  }

  // Arrow Right/Down: move to next focusable element in group
  forward: {
    if (!isForward) {
      break forward;
    }
    const nextElement = findAfter(activeElement, elementIsFocusable, {
      root: element,
    });
    if (nextElement) {
      return nextElement;
    }
    const ancestorTarget = delegateArrowNavigation(event, element, {
      direction,
      loop,
      name,
    });
    if (ancestorTarget) {
      return ancestorTarget;
    }
    if (loop) {
      // No next element, wrap to first focusable in group
      const firstFocusableElement = findDescendant(element, elementIsFocusable);
      if (firstFocusableElement) {
        return firstFocusableElement;
      }
    }
    return null;
  }

  return null;
};
// Find parent focus group with the same name and try delegation
const delegateArrowNavigation = (event, currentElement, { name }) => {
  let ancestorElement = currentElement.parentElement;
  while (ancestorElement) {
    const ancestorFocusGroup = getFocusGroup(ancestorElement);
    if (!ancestorFocusGroup) {
      ancestorElement = ancestorElement.parentElement;
      continue;
    }

    // Check if groups should delegate to each other
    const shouldDelegate =
      name === undefined && ancestorFocusGroup.name === undefined
        ? true // Both unnamed - delegate based on ancestor relationship
        : ancestorFocusGroup.name === name; // Both have same explicit name

    if (shouldDelegate) {
      if (DEBUG) {
        console.debug(
          `Delegating navigation to parent focus group:`,
          ancestorElement,
          name === undefined ? "(unnamed group)" : `(name: ${name})`,
        );
      }
      // Try navigation in parent focus group
      return getTargetInLinearFocusGroup(event, ancestorElement, {
        direction: ancestorFocusGroup.direction,
        loop: ancestorFocusGroup.loop,
        name: ancestorFocusGroup.name,
      });
    }
  }
  return null;
};
const isBackwardArrow = (event, direction = "both") => {
  const backwardKeys = {
    both: ["ArrowLeft", "ArrowUp"],
    vertical: ["ArrowUp"],
    horizontal: ["ArrowLeft"],
  };
  return backwardKeys[direction]?.includes(event.key) ?? false;
};
const isForwardArrow = (event, direction = "both") => {
  const forwardKeys = {
    both: ["ArrowRight", "ArrowDown"],
    vertical: ["ArrowDown"],
    horizontal: ["ArrowRight"],
  };
  return forwardKeys[direction]?.includes(event.key) ?? false;
};

// Handle arrow navigation inside an HTMLTableElement as a grid.
// Moves focus to adjacent cell in the direction of the arrow key.
const getTargetInTableFocusGroup = (event, table, { loop }) => {
  const key = event.key;
  if (
    key !== "ArrowRight" &&
    key !== "ArrowLeft" &&
    key !== "ArrowUp" &&
    key !== "ArrowDown"
  ) {
    return null;
  }

  const active = document.activeElement;
  // Find current cell (td or th)
  const currentCell = active?.closest?.("td,th");
  if (!currentCell || !table.contains(currentCell)) {
    // Not currently inside a cell: focus the first focusable element in the table, if any
    return findDescendant(table, elementIsFocusable) || null;
  }

  const currentRow = currentCell.parentElement; // tr
  const rows = Array.from(table.rows);
  const y = /** @type {HTMLTableRowElement} */ (currentRow).rowIndex; // row index
  const x = /** @type {HTMLTableCellElement} */ (currentCell).cellIndex; // column index

  // Iterate over subsequent cells in arrow direction and return the first focusable descendant
  const cellIterator = createCellIterator(key, rows, {
    y,
    x,
    originalX: x,
    loop,
  });
  for (const cell of cellIterator) {
    const target = findDescendant(cell, elementIsFocusable);
    if (target) {
      return target;
    }
  }
  return null;
};

// Create an iterator over cells in a table following arrow key direction
const createCellIterator = function* (key, rows, { y, x, originalX, loop }) {
  if (!rows.length) {
    return;
  }

  // Maintain a column anchor used to keep vertical moves aligned
  let anchorX = originalX;
  const loopMode = normalizeLoop(loop);
  const getNext = (y0, x0) =>
    getNextPositionInTable(key, rows, y0, x0, anchorX, loopMode);

  // Compute the first candidate position from the current one
  let next = getNext(y, x);
  if (!next) {
    return; // cannot move in this direction without loop
  }
  const start = `${next.y}:${next.x}`;

  while (true) {
    const row = rows[next.y];
    const cell = row?.cells?.[next.x];
    if (cell) {
      yield cell;
    }
    // Update anchor when horizontal moved, or when vertical flow crosses columns
    if (key === "ArrowRight" || key === "ArrowLeft") {
      anchorX = next.x;
    } else if (key === "ArrowDown") {
      const atBottom = next.y === rows.length - 1;
      if (atBottom && loopMode === "flow") {
        // Next will be top row of next column in flow mode
        anchorX = (anchorX + 1) % getMaxColumns(rows);
      }
    } else if (key === "ArrowUp") {
      const atTop = next.y === 0;
      if (atTop && loopMode === "flow") {
        const maxCols = getMaxColumns(rows);
        anchorX = (anchorX - 1 + maxCols) % maxCols;
      }
    }

    next = getNext(next.y, next.x);
    if (!next) {
      return; // reached boundary and no loop
    }
    const keyPos = `${next.y}:${next.x}`;
    if (keyPos === start) {
      return; // completed a full loop
    }
  }
};

// Normalize loop option to a mode string or false
const normalizeLoop = (loop) => {
  if (loop === true) return "wrap";
  if (loop === "wrap") return "wrap";
  if (loop === "flow") return "flow";
  return false;
};

const getMaxColumns = (rows) =>
  rows.reduce((max, r) => Math.max(max, r?.cells?.length || 0), 0);

// Compute the next row/cell indices when moving in a table for a given arrow key
const getNextPositionInTable = (
  keyboardKey,
  rows,
  y,
  x,
  originalX,
  loopMode,
) => {
  const mode = normalizeLoop(loopMode);

  if (keyboardKey === "ArrowRight") {
    const rowLen = rows[y]?.cells?.length || 0;
    const nextX = x + 1;
    if (nextX < rowLen) {
      return { y, x: nextX };
    }
    // boundary
    if (mode === "flow") {
      const nextY = (y + 1) % rows.length;
      return { y: nextY, x: 0 };
    }
    if (mode === "wrap") {
      return { y, x: 0 };
    }
    return null;
  }

  if (keyboardKey === "ArrowLeft") {
    const prevX = x - 1;
    if (prevX >= 0) {
      return { y, x: prevX };
    }
    // boundary
    if (mode === "flow") {
      const prevY = (y - 1 + rows.length) % rows.length;
      const prevRowLen = rows[prevY]?.cells?.length || 0;
      const lastX = Math.max(0, prevRowLen - 1);
      return { y: prevY, x: lastX };
    }
    if (mode === "wrap") {
      const rowLen = rows[y]?.cells?.length || 0;
      const lastX = Math.max(0, rowLen - 1);
      return { y, x: lastX };
    }
    return null;
  }

  if (keyboardKey === "ArrowDown") {
    const nextY = y + 1;
    if (nextY < rows.length) {
      const targetRowLen = rows[nextY]?.cells?.length || 0;
      const nextX = Math.min(originalX, Math.max(0, targetRowLen - 1));
      return { y: nextY, x: nextX };
    }
    // boundary
    if (mode === "flow") {
      const maxCols = getMaxColumns(rows);
      const flowedX = (x + 1) % Math.max(1, maxCols);
      const topRowLen = rows[0]?.cells?.length || 0;
      const clampedX = Math.min(flowedX, Math.max(0, topRowLen - 1));
      return { y: 0, x: clampedX };
    }
    if (mode === "wrap") {
      const topRowLen = rows[0]?.cells?.length || 0;
      const nextX = Math.min(originalX, Math.max(0, topRowLen - 1));
      return { y: 0, x: nextX };
    }
    return null;
  }

  if (keyboardKey === "ArrowUp") {
    const prevY = y - 1;
    if (prevY >= 0) {
      const targetRowLen = rows[prevY]?.cells?.length || 0;
      const nextX = Math.min(originalX, Math.max(0, targetRowLen - 1));
      return { y: prevY, x: nextX };
    }
    // boundary
    if (mode === "flow") {
      const maxCols = getMaxColumns(rows);
      const flowedX = (x - 1 + Math.max(1, maxCols)) % Math.max(1, maxCols);
      const bottomRowIndex = rows.length - 1;
      const bottomRowLen = rows[bottomRowIndex]?.cells?.length || 0;
      const clampedX = Math.min(flowedX, Math.max(0, bottomRowLen - 1));
      return { y: bottomRowIndex, x: clampedX };
    }
    if (mode === "wrap") {
      const bottomRowIndex = rows.length - 1;
      const bottomRowLen = rows[bottomRowIndex]?.cells?.length || 0;
      const nextX = Math.min(originalX, Math.max(0, bottomRowLen - 1));
      return { y: bottomRowIndex, x: nextX };
    }
    return null;
  }

  return null;
};
