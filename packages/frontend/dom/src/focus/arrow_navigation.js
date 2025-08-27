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
  const rowIndex = /** @type {HTMLTableRowElement} */ (currentRow).rowIndex;
  const cellIndex = /** @type {HTMLTableCellElement} */ (currentCell).cellIndex;

  // Iterate over subsequent cells in arrow direction and return the first focusable descendant
  const cellIterator = createCellIterator(key, rows, {
    rowIndex,
    cellIndex,
    originalCellIndex: cellIndex,
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
const createCellIterator = function* (
  key,
  rows,
  { rowIndex, cellIndex, originalCellIndex, loop },
) {
  if (!rows.length) {
    return;
  }

  const getNext = (r, c) =>
    getNextPositionInTable(key, rows, r, c, originalCellIndex, loop);

  // Compute the first candidate position from the current one
  let next = getNext(rowIndex, cellIndex);
  if (!next) {
    return; // cannot move in this direction without loop
  }
  const start = `${next.rowIndex}:${next.cellIndex}`;

  while (true) {
    const row = rows[next.rowIndex];
    const cell = row?.cells?.[next.cellIndex];
    if (cell) {
      yield cell;
    }
    next = getNext(next.rowIndex, next.cellIndex);
    if (!next) {
      return; // reached boundary and no loop
    }
    const keyPos = `${next.rowIndex}:${next.cellIndex}`;
    if (keyPos === start) {
      return; // completed a full loop
    }
  }
};

// Compute the next row/cell indices when moving in a table for a given arrow key
const getNextPositionInTable = (
  key,
  rows,
  rowIndex,
  cellIndex,
  originalCellIndex,
  loop,
) => {
  let nextRowIndex = rowIndex;
  let nextCellIndex = cellIndex;
  if (key === "ArrowRight") {
    nextCellIndex = cellIndex + 1;
    const currentRowCells = rows[rowIndex]?.cells || [];
    if (nextCellIndex >= currentRowCells.length) {
      nextRowIndex = rowIndex + 1;
      if (nextRowIndex >= rows.length) {
        if (!loop) return null;
        nextRowIndex = 0;
      }
      nextCellIndex = 0;
    }
  } else if (key === "ArrowLeft") {
    nextCellIndex = cellIndex - 1;
    if (nextCellIndex < 0) {
      nextRowIndex = rowIndex - 1;
      if (nextRowIndex < 0) {
        if (!loop) {
          return null;
        }
        nextRowIndex = rows.length - 1;
      }
      const prevRowCells = rows[nextRowIndex]?.cells || [];
      nextCellIndex = Math.max(0, prevRowCells.length - 1);
    }
  } else if (key === "ArrowDown") {
    nextRowIndex = rowIndex + 1;
    if (nextRowIndex >= rows.length) {
      if (!loop) {
        return null;
      }
      nextRowIndex = 0;
    }
    const targetRowCells = rows[nextRowIndex]?.cells || [];
    nextCellIndex = Math.min(
      originalCellIndex,
      Math.max(0, targetRowCells.length - 1),
    );
  } else if (key === "ArrowUp") {
    nextRowIndex = rowIndex - 1;
    if (nextRowIndex < 0) {
      if (!loop) {
        return null;
      }
      nextRowIndex = rows.length - 1;
    }
    const targetRowCells = rows[nextRowIndex]?.cells || [];
    nextCellIndex = Math.min(
      originalCellIndex,
      Math.max(0, targetRowCells.length - 1),
    );
  } else {
    return null;
  }
  return { rowIndex: nextRowIndex, cellIndex: nextCellIndex };
};
