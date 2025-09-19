import { canInterceptKeys } from "../keyboard.js";
import {
  findAfter,
  findBefore,
  findDescendant,
  findLastDescendant,
} from "../traversal.js";
import { elementIsFocusable } from "./element_is_focusable.js";
import { getFocusGroup } from "./focus_group_registry.js";
import { markFocusNav } from "./focus_nav_event_marker.js";

const DEBUG = false;

export const performArrowNavigation = (
  event,
  element,
  { direction = "both", loop, name } = {},
) => {
  if (!canInterceptKeys(event)) {
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
    markFocusNav(event);
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

  // Check for Cmd/Ctrl + arrow keys for jumping to start/end of linear group
  const isJumpToEnd = event.metaKey || event.ctrlKey;

  if (isJumpToEnd) {
    return getJumpToEndTargetLinear(event, element, direction);
  }

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

// Handle Cmd/Ctrl + arrow keys for linear focus groups to jump to start/end
const getJumpToEndTargetLinear = (event, element, direction) => {
  // Check if this arrow key is valid for the given direction
  if (!isForwardArrow(event, direction) && !isBackwardArrow(event, direction)) {
    return null;
  }

  if (isBackwardArrow(event, direction)) {
    // Jump to first focusable element in the group
    return findDescendant(element, elementIsFocusable);
  }

  if (isForwardArrow(event, direction)) {
    // Jump to last focusable element in the group
    return findLastDescendant(element, elementIsFocusable);
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
  const arrowKey = event.key;

  // Only handle arrow keys
  if (
    arrowKey !== "ArrowRight" &&
    arrowKey !== "ArrowLeft" &&
    arrowKey !== "ArrowUp" &&
    arrowKey !== "ArrowDown"
  ) {
    return null;
  }

  const focusedElement = document.activeElement;
  const currentCell = focusedElement?.closest?.("td,th");

  // If we're not currently in a table cell, try to focus the first focusable element in the table
  if (!currentCell || !table.contains(currentCell)) {
    return findDescendant(table, elementIsFocusable) || null;
  }

  // Get the current position in the table grid
  const currentRow = currentCell.parentElement; // tr element
  const allRows = Array.from(table.rows);
  const currentRowIndex = /** @type {HTMLTableRowElement} */ (currentRow)
    .rowIndex;
  const currentColumnIndex = /** @type {HTMLTableCellElement} */ (currentCell)
    .cellIndex;

  // Check for Cmd/Ctrl + arrow keys for jumping to end of row/column
  const isJumpToEnd = event.metaKey || event.ctrlKey;

  if (isJumpToEnd) {
    return getJumpToEndTarget(
      arrowKey,
      allRows,
      currentRowIndex,
      currentColumnIndex,
    );
  }

  // Create an iterator that will scan through cells in the arrow direction
  // until it finds one with a focusable element inside
  const candidateCells = createTableCellIterator(arrowKey, allRows, {
    startRow: currentRowIndex,
    startColumn: currentColumnIndex,
    originalColumn: currentColumnIndex, // Used to maintain column alignment for vertical moves
    loopMode: normalizeLoop(loop),
  });

  // Find the first cell that is itself focusable
  for (const candidateCell of candidateCells) {
    if (elementIsFocusable(candidateCell)) {
      return candidateCell;
    }
  }

  return null; // No focusable cell found
};

// Handle Cmd/Ctrl + arrow keys to jump to the end of row/column
const getJumpToEndTarget = (
  arrowKey,
  allRows,
  currentRowIndex,
  currentColumnIndex,
) => {
  if (arrowKey === "ArrowRight") {
    // Jump to last focusable cell in current row
    const currentRow = allRows[currentRowIndex];
    if (!currentRow) return null;

    // Start from the last cell and work backwards to find focusable
    const cells = Array.from(currentRow.cells);
    for (let i = cells.length - 1; i >= 0; i--) {
      const cell = cells[i];
      if (elementIsFocusable(cell)) {
        return cell;
      }
    }
    return null;
  }

  if (arrowKey === "ArrowLeft") {
    // Jump to first focusable cell in current row
    const currentRow = allRows[currentRowIndex];
    if (!currentRow) return null;

    const cells = Array.from(currentRow.cells);
    for (const cell of cells) {
      if (elementIsFocusable(cell)) {
        return cell;
      }
    }
    return null;
  }

  if (arrowKey === "ArrowDown") {
    // Jump to last focusable cell in current column
    for (let rowIndex = allRows.length - 1; rowIndex >= 0; rowIndex--) {
      const row = allRows[rowIndex];
      const cell = row?.cells?.[currentColumnIndex];
      if (cell && elementIsFocusable(cell)) {
        return cell;
      }
    }
    return null;
  }

  if (arrowKey === "ArrowUp") {
    // Jump to first focusable cell in current column
    for (let rowIndex = 0; rowIndex < allRows.length; rowIndex++) {
      const row = allRows[rowIndex];
      const cell = row?.cells?.[currentColumnIndex];
      if (cell && elementIsFocusable(cell)) {
        return cell;
      }
    }
    return null;
  }

  return null;
};

// Create an iterator that yields table cells in the direction of arrow key movement.
// This scans through cells until it finds one with a focusable element or completes a full loop.
const createTableCellIterator = function* (
  arrowKey,
  allRows,
  { startRow, startColumn, originalColumn, loopMode },
) {
  if (allRows.length === 0) {
    return; // No rows to navigate
  }

  // Keep track of which column we should prefer for vertical movements
  // This helps maintain column alignment when moving up/down through rows of different lengths
  let preferredColumn = originalColumn;

  const normalizedLoopMode = normalizeLoop(loopMode);

  // Helper function to calculate the next position based on current position and arrow key
  const calculateNextPosition = (currentRow, currentColumn) =>
    getNextTablePosition(
      arrowKey,
      allRows,
      currentRow,
      currentColumn,
      preferredColumn,
      normalizedLoopMode,
    );

  // Start by calculating the first position to move to
  let nextPosition = calculateNextPosition(startRow, startColumn);
  if (!nextPosition) {
    return; // Cannot move in this direction (no looping enabled)
  }

  // Keep track of our actual starting position to detect when we've completed a full loop
  const actualStartingPosition = `${startRow}:${startColumn}`;

  while (true) {
    const [nextColumn, nextRow] = nextPosition; // Destructure [column, row]
    const targetRow = allRows[nextRow];
    const targetCell = targetRow?.cells?.[nextColumn];

    // Yield the cell if it exists
    if (targetCell) {
      yield targetCell;
    }

    // Update our preferred column based on movement:
    // - For horizontal moves, update to current column
    // - For vertical moves in flow mode at boundaries, advance to next/previous column
    if (arrowKey === "ArrowRight" || arrowKey === "ArrowLeft") {
      preferredColumn = nextColumn;
    } else if (arrowKey === "ArrowDown") {
      const isAtBottomRow = nextRow === allRows.length - 1;
      if (isAtBottomRow && normalizedLoopMode === "flow") {
        // Moving down from bottom row in flow mode: advance to next column
        const maxColumns = getMaxColumns(allRows);
        preferredColumn = preferredColumn + 1;
        if (preferredColumn >= maxColumns) {
          preferredColumn = 0; // Wrap to first column
        }
      }
    } else if (arrowKey === "ArrowUp") {
      const isAtTopRow = nextRow === 0;
      if (isAtTopRow && normalizedLoopMode === "flow") {
        // Moving up from top row in flow mode: go to previous column
        const maxColumns = getMaxColumns(allRows);
        if (preferredColumn === 0) {
          preferredColumn = maxColumns - 1; // Wrap to last column
        } else {
          preferredColumn = preferredColumn - 1;
        }
      }
    }

    // Calculate where to move next
    nextPosition = calculateNextPosition(nextRow, nextColumn);
    if (!nextPosition) {
      return; // Hit a boundary with no looping
    }

    // Check if we've completed a full loop by returning to our actual starting position
    const currentPositionKey = `${nextRow}:${nextColumn}`;
    if (currentPositionKey === actualStartingPosition) {
      return; // We've gone full circle back to where we started
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

// Calculate the next row and column position when moving in a table with arrow keys.
// Returns [column, row] for the next position, or null if movement is not possible.
const getNextTablePosition = (
  arrowKey,
  allRows,
  currentRow,
  currentColumn,
  preferredColumn, // Used for vertical movement to maintain column alignment
  loopMode,
) => {
  if (arrowKey === "ArrowRight") {
    const currentRowLength = allRows[currentRow]?.cells?.length || 0;
    const nextColumn = currentColumn + 1;

    // Can we move right within the same row?
    if (nextColumn < currentRowLength) {
      return [nextColumn, currentRow]; // [column, row]
    }

    // We're at the end of the row - handle boundary behavior
    if (loopMode === "flow") {
      // Flow mode: move to first cell of next row (wrap to top if at bottom)
      let nextRow = currentRow + 1;
      if (nextRow >= allRows.length) {
        nextRow = 0; // Wrap to first row
      }
      return [0, nextRow]; // [column, row]
    }

    if (loopMode === "wrap") {
      // Wrap mode: stay in same row, wrap to first column
      return [0, currentRow]; // [column, row]
    }

    // No looping: can't move
    return null;
  }

  if (arrowKey === "ArrowLeft") {
    const previousColumn = currentColumn - 1;

    // Can we move left within the same row?
    if (previousColumn >= 0) {
      return [previousColumn, currentRow]; // [column, row]
    }

    // We're at the beginning of the row - handle boundary behavior
    if (loopMode === "flow") {
      // Flow mode: move to last cell of previous row (wrap to bottom if at top)
      let previousRow = currentRow - 1;
      if (previousRow < 0) {
        previousRow = allRows.length - 1; // Wrap to last row
      }
      const previousRowLength = allRows[previousRow]?.cells?.length || 0;
      const lastColumnInPreviousRow = Math.max(0, previousRowLength - 1);
      return [lastColumnInPreviousRow, previousRow]; // [column, row]
    }

    if (loopMode === "wrap") {
      // Wrap mode: stay in same row, wrap to last column
      const currentRowLength = allRows[currentRow]?.cells?.length || 0;
      const lastColumnInCurrentRow = Math.max(0, currentRowLength - 1);
      return [lastColumnInCurrentRow, currentRow]; // [column, row]
    }

    // No looping: can't move
    return null;
  }

  if (arrowKey === "ArrowDown") {
    const nextRow = currentRow + 1;

    // Can we move down within the table?
    if (nextRow < allRows.length) {
      const nextRowLength = allRows[nextRow]?.cells?.length || 0;
      // Try to maintain the preferred column, but clamp to row length
      const targetColumn = Math.min(
        preferredColumn,
        Math.max(0, nextRowLength - 1),
      );
      return [targetColumn, nextRow]; // [column, row]
    }

    // We're at the bottom row - handle boundary behavior
    if (loopMode === "flow") {
      // Flow mode: advance to next column and go to top row
      const maxColumns = Math.max(1, getMaxColumns(allRows));
      let nextColumnInFlow = currentColumn + 1;
      if (nextColumnInFlow >= maxColumns) {
        nextColumnInFlow = 0; // Wrap to first column
      }
      const topRowLength = allRows[0]?.cells?.length || 0;
      const clampedColumn = Math.min(
        nextColumnInFlow,
        Math.max(0, topRowLength - 1),
      );
      return [clampedColumn, 0]; // [column, row]
    }

    if (loopMode === "wrap") {
      // Wrap mode: go to top row, maintaining preferred column
      const topRowLength = allRows[0]?.cells?.length || 0;
      const targetColumn = Math.min(
        preferredColumn,
        Math.max(0, topRowLength - 1),
      );
      return [targetColumn, 0]; // [column, row]
    }

    // No looping: can't move
    return null;
  }

  if (arrowKey === "ArrowUp") {
    const previousRow = currentRow - 1;

    // Can we move up within the table?
    if (previousRow >= 0) {
      const previousRowLength = allRows[previousRow]?.cells?.length || 0;
      // Try to maintain the preferred column, but clamp to row length
      const targetColumn = Math.min(
        preferredColumn,
        Math.max(0, previousRowLength - 1),
      );
      return [targetColumn, previousRow]; // [column, row]
    }

    // We're at the top row - handle boundary behavior
    if (loopMode === "flow") {
      // Flow mode: go to previous column and move to bottom row
      const maxColumns = Math.max(1, getMaxColumns(allRows));
      let previousColumnInFlow;
      if (currentColumn === 0) {
        previousColumnInFlow = maxColumns - 1; // Wrap to last column
      } else {
        previousColumnInFlow = currentColumn - 1;
      }
      const bottomRowIndex = allRows.length - 1;
      const bottomRowLength = allRows[bottomRowIndex]?.cells?.length || 0;
      const clampedColumn = Math.min(
        previousColumnInFlow,
        Math.max(0, bottomRowLength - 1),
      );
      return [clampedColumn, bottomRowIndex]; // [column, row]
    }

    if (loopMode === "wrap") {
      // Wrap mode: go to bottom row, maintaining preferred column
      const bottomRowIndex = allRows.length - 1;
      const bottomRowLength = allRows[bottomRowIndex]?.cells?.length || 0;
      const targetColumn = Math.min(
        preferredColumn,
        Math.max(0, bottomRowLength - 1),
      );
      return [targetColumn, bottomRowIndex]; // [column, row]
    }

    // No looping: can't move
    return null;
  }

  // Unknown arrow key
  return null;
};
