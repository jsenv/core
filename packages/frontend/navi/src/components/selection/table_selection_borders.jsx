import { useLayoutEffect } from "preact/hooks";
import { useSelection } from "./selection.jsx";

import.meta.css = /* css */ `
  /* Set default selection border color */
  :root {
    --selection-border-color: #0078d4;
    --selection-border-size: 2px;
  }

  /* All selection border elements need relative positioning for pseudo-elements */
  [data-selection-border-top],
  [data-selection-border-right],
  [data-selection-border-bottom],
  [data-selection-border-left] {
    position: relative;
  }

  /* Top border segments using ::before */
  [data-selection-border-top]::before {
    content: "";
    position: absolute;
    top: calc(-1 * var(--selection-border-size));
    left: var(--border-top-left, 0);
    right: var(--border-top-right, 0);
    height: var(--selection-border-size);
    background-color: var(--selection-border-color);
    pointer-events: none;
    z-index: 0;
  }

  /* Right border segments using ::after */
  [data-selection-border-right]::after {
    content: "";
    position: absolute;
    top: var(--border-right-top, 0);
    right: calc(-1 * var(--selection-border-size));
    bottom: var(--border-right-bottom, 0);
    width: var(--selection-border-size);
    background-color: var(--selection-border-color);
    pointer-events: none;
    z-index: 0;
  }

  /* Bottom border segments - need to avoid conflict with top border pseudo-element */
  [data-selection-border-bottom] {
    --bottom-pseudo-element: "";
  }
  [data-selection-border-bottom]::after {
    content: var(--bottom-pseudo-element, "");
    position: absolute;
    bottom: calc(-1 * var(--selection-border-size));
    left: var(--border-bottom-left, 0);
    right: var(--border-bottom-right, 0);
    height: var(--selection-border-size);
    background-color: var(--selection-border-color);
    pointer-events: none;
    z-index: 0;
  }

  /* Override for bottom borders when right border exists - use different approach */
  [data-selection-border-bottom][data-selection-border-right] {
    --bottom-pseudo-element: none;
  }
  [data-selection-border-bottom][data-selection-border-right]::before {
    content: "";
    position: absolute;
    bottom: calc(-1 * var(--selection-border-size));
    left: var(--border-bottom-left, 0);
    right: var(--border-bottom-right, 0);
    height: var(--selection-border-size);
    background-color: var(--selection-border-color);
    pointer-events: none;
    z-index: 0;
  }

  /* Left border segments - use different pseudo-element based on conflicts */
  [data-selection-border-left] {
    --left-pseudo-element: "";
  }
  [data-selection-border-left]::after {
    content: var(--left-pseudo-element, "");
    position: absolute;
    top: var(--border-left-top, 0);
    left: calc(-1 * var(--selection-border-size));
    bottom: var(--border-left-bottom, 0);
    width: var(--selection-border-size);
    background-color: var(--selection-border-color);
    pointer-events: none;
    z-index: 0;
  }

  /* Override for left borders when right border exists */
  [data-selection-border-left][data-selection-border-right] {
    --left-pseudo-element: none;
  }
  [data-selection-border-left][data-selection-border-right]::before {
    content: "";
    position: absolute;
    top: var(--border-left-top, 0);
    left: calc(-1 * var(--selection-border-size));
    bottom: var(--border-left-bottom, 0);
    width: var(--selection-border-size);
    background-color: var(--selection-border-color);
    pointer-events: none;
    z-index: 1;
  }

  /* Hide borders during drag selection */
  table[data-drag-selecting] [data-selection-border-top]::before,
  table[data-drag-selecting] [data-selection-border-right]::after,
  table[data-drag-selecting] [data-selection-border-bottom]::before,
  table[data-drag-selecting] [data-selection-border-bottom]::after,
  table[data-drag-selecting] [data-selection-border-left]::before,
  table[data-drag-selecting] [data-selection-border-left]::after {
    display: none;
  }

  /* Ensure table cells don't interfere with border positioning */
  table td,
  table th {
    position: relative;
  }
`;

export const useTableSelectionBorders = (
  tableRef,
  { color = "#0078d4", size = 2 } = {},
) => {
  const selection = useSelection();

  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) {
      return null;
    }

    // Set the border color CSS variable
    table.style.setProperty("--selection-border-color", color);

    return () => {
      // Clean up CSS variables
      table.style.removeProperty("--selection-border-color");
    };
  }, [color, size]);

  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) {
      return null;
    }

    const updateCellBorders = () => {
      // Clear all existing selection borders and CSS custom properties
      const allCells = table.querySelectorAll("td, th");
      allCells.forEach((cell) => {
        cell.removeAttribute("data-selection-border-top");
        cell.removeAttribute("data-selection-border-right");
        cell.removeAttribute("data-selection-border-bottom");
        cell.removeAttribute("data-selection-border-left");

        // Clear border positioning CSS variables
        cell.style.removeProperty("--border-top-left");
        cell.style.removeProperty("--border-top-right");
        cell.style.removeProperty("--border-right-top");
        cell.style.removeProperty("--border-right-bottom");
        cell.style.removeProperty("--border-bottom-left");
        cell.style.removeProperty("--border-bottom-right");
        cell.style.removeProperty("--border-left-top");
        cell.style.removeProperty("--border-left-bottom");
      });

      // Don't apply borders during drag selection
      if (table.hasAttribute("data-drag-selecting")) {
        return;
      }

      // Get all selected cells
      const selectedCells = getSelectedCells(table, selection);
      if (selectedCells.length === 0) {
        return;
      }

      // Create smart borders with proper intersection handling
      createSmartSelectionBorders(selectedCells, size);
    };

    // Initial border update
    updateCellBorders();

    // Listen for selection changes
    const unsubscribe = selection.channels.change.add(updateCellBorders);

    return () => {
      unsubscribe();
    };
  }, [tableRef, selection, size]);
};

// Create smart selection borders with proper intersection handling
const createSmartSelectionBorders = (selectedCells, borderSize) => {
  // Create a map of selected cells by position for quick lookup
  const cellMap = new Map();
  const cellPositions = [];

  selectedCells.forEach((cell) => {
    const position = getCellPosition(cell);
    if (position) {
      cellMap.set(`${position.row},${position.col}`, cell);
      cellPositions.push({ cell, position });
    }
  });

  // Group cells by selection type
  const groupedCells = groupCellsBySelectionType(selectedCells);

  // Process each selection type
  Object.entries(groupedCells).forEach(([selectionType, cells]) => {
    if (selectionType === "row") {
      createRowSelectionBorders(cells, cellMap, borderSize);
    } else if (selectionType === "column") {
      createColumnSelectionBorders(cells, cellMap, borderSize);
    } else {
      // Regular cell selection
      createCellSelectionBorders(
        cellPositions.filter((cp) => cells.includes(cp.cell)),
        cellMap,
        borderSize,
      );
    }
  });
};

// Create borders for cell selections with smart intersection handling
const createCellSelectionBorders = (cellPositions, cellMap, borderSize) => {
  cellPositions.forEach(({ cell, position }) => {
    // Check which borders this cell needs
    const needsTop = !cellMap.has(`${position.row - 1},${position.col}`);
    const needsBottom = !cellMap.has(`${position.row + 1},${position.col}`);
    const needsLeft = !cellMap.has(`${position.row},${position.col - 1}`);
    const needsRight = !cellMap.has(`${position.row},${position.col + 1}`);

    // Calculate smart border positioning to avoid overlaps at corners
    if (needsTop) {
      const leftOffset = needsLeft ? `${borderSize}px` : "0px";
      const rightOffset = needsRight ? `${borderSize}px` : "0px";
      cell.setAttribute("data-selection-border-top", "");
      cell.style.setProperty("--border-top-left", leftOffset);
      cell.style.setProperty("--border-top-right", rightOffset);
    }

    if (needsBottom) {
      const leftOffset = needsLeft ? `${borderSize}px` : "0px";
      const rightOffset = needsRight ? `${borderSize}px` : "0px";
      cell.setAttribute("data-selection-border-bottom", "");
      cell.style.setProperty("--border-bottom-left", leftOffset);
      cell.style.setProperty("--border-bottom-right", rightOffset);
    }

    if (needsLeft) {
      const topOffset = needsTop ? `${borderSize}px` : "0px";
      const bottomOffset = needsBottom ? `${borderSize}px` : "0px";
      cell.setAttribute("data-selection-border-left", "");
      cell.style.setProperty("--border-left-top", topOffset);
      cell.style.setProperty("--border-left-bottom", bottomOffset);
    }

    if (needsRight) {
      const topOffset = needsTop ? `${borderSize}px` : "0px";
      const bottomOffset = needsBottom ? `${borderSize}px` : "0px";
      cell.setAttribute("data-selection-border-right", "");
      cell.style.setProperty("--border-right-top", topOffset);
      cell.style.setProperty("--border-right-bottom", bottomOffset);
    }
  });
};

// Create borders for row selections
const createRowSelectionBorders = (rowCells, cellMap, borderSize) => {
  rowCells.forEach((rowHeaderCell) => {
    const position = getCellPosition(rowHeaderCell);
    if (!position) return;

    // Check if we need borders
    const needsTop = !hasSelectedRowAt(cellMap, position.row - 1);
    const needsBottom = !hasSelectedRowAt(cellMap, position.row + 1);

    // Set border attributes for the row header cell
    if (needsTop) {
      rowHeaderCell.setAttribute("data-selection-border-top", "");
      rowHeaderCell.style.setProperty("--border-top-left", "0px");
      rowHeaderCell.style.setProperty("--border-top-right", "0px");
    }

    if (needsBottom) {
      rowHeaderCell.setAttribute("data-selection-border-bottom", "");
      rowHeaderCell.style.setProperty("--border-bottom-left", "0px");
      rowHeaderCell.style.setProperty("--border-bottom-right", "0px");
    }

    // Left and right borders always needed for row selections
    rowHeaderCell.setAttribute("data-selection-border-left", "");
    const leftTop = needsTop ? `-${borderSize}px` : "0px";
    const leftBottom = needsBottom ? `-${borderSize}px` : "0px";
    rowHeaderCell.style.setProperty("--border-left-top", leftTop);
    rowHeaderCell.style.setProperty("--border-left-bottom", leftBottom);

    rowHeaderCell.setAttribute("data-selection-border-right", "");
    const rightTop = needsTop ? `-${borderSize}px` : "0px";
    const rightBottom = needsBottom ? `-${borderSize}px` : "0px";
    rowHeaderCell.style.setProperty("--border-right-top", rightTop);
    rowHeaderCell.style.setProperty("--border-right-bottom", rightBottom);
  });
};

// Create borders for column selections
const createColumnSelectionBorders = (columnCells, cellMap, borderSize) => {
  columnCells.forEach((columnHeaderCell) => {
    const position = getCellPosition(columnHeaderCell);
    if (!position) return;

    // Check if we need borders
    const needsLeft = !hasSelectedColumnAt(cellMap, position.col - 1);
    const needsRight = !hasSelectedColumnAt(cellMap, position.col + 1);

    // Set border attributes for the column header cell
    if (needsLeft) {
      columnHeaderCell.setAttribute("data-selection-border-left", "");
      columnHeaderCell.style.setProperty("--border-left-top", "0px");
      columnHeaderCell.style.setProperty("--border-left-bottom", "0px");
    }

    if (needsRight) {
      columnHeaderCell.setAttribute("data-selection-border-right", "");
      columnHeaderCell.style.setProperty("--border-right-top", "0px");
      columnHeaderCell.style.setProperty("--border-right-bottom", "0px");
    }

    // Top and bottom borders always needed for column selections
    columnHeaderCell.setAttribute("data-selection-border-top", "");
    const topLeft = needsLeft ? `-${borderSize}px` : "0px";
    const topRight = needsRight ? `-${borderSize}px` : "0px";
    columnHeaderCell.style.setProperty("--border-top-left", topLeft);
    columnHeaderCell.style.setProperty("--border-top-right", topRight);

    columnHeaderCell.setAttribute("data-selection-border-bottom", "");
    const bottomLeft = needsLeft ? `-${borderSize}px` : "0px";
    const bottomRight = needsRight ? `-${borderSize}px` : "0px";
    columnHeaderCell.style.setProperty("--border-bottom-left", bottomLeft);
    columnHeaderCell.style.setProperty("--border-bottom-right", bottomRight);
  });
};

// Get all selected cells based on the selection value
const getSelectedCells = (table, selection) => {
  const selectedCells = [];

  // Get all cells in the table
  const allCells = table.querySelectorAll("td, th");

  allCells.forEach((cell) => {
    // Check if this cell's value is in the selection
    const cellValue = getCellValue(cell);
    if (selection.isValueSelected(cellValue)) {
      selectedCells.push(cell);
    }
  });

  return selectedCells;
};

// Extract value from a cell (similar to getElementValue)
const getCellValue = (cell) => {
  if (cell.value !== undefined) {
    return cell.value;
  }
  if (cell.hasAttribute("data-value")) {
    return cell.getAttribute("data-value");
  }
  return cell;
};

// Group cells by their data-selection-name attribute
const groupCellsBySelectionType = (cells) => {
  const groups = {};

  cells.forEach((cell) => {
    const selectionName = cell.getAttribute("data-selection-name") || "cell";
    if (!groups[selectionName]) {
      groups[selectionName] = [];
    }
    groups[selectionName].push(cell);
  });

  return groups;
};

// Get cell position in the table grid
const getCellPosition = (cell) => {
  const row = cell.closest("tr");
  if (!row) return null;

  const table = row.closest("table");
  if (!table) return null;

  const rowIndex = Array.from(table.rows).indexOf(row);
  const colIndex = Array.from(row.cells).indexOf(cell);

  return { row: rowIndex, col: colIndex };
};

// Helper to check if there's a selected row at the given row index
const hasSelectedRowAt = (cellMap, rowIndex) => {
  for (const key of cellMap.keys()) {
    const [row] = key.split(",").map(Number);
    if (row === rowIndex) {
      const cell = cellMap.get(key);
      if (cell.getAttribute("data-selection-name") === "row") {
        return true;
      }
    }
  }
  return false;
};

// Helper to check if there's a selected column at the given column index
const hasSelectedColumnAt = (cellMap, colIndex) => {
  for (const key of cellMap.keys()) {
    const [, col] = key.split(",").map(Number);
    if (col === colIndex) {
      const cell = cellMap.get(key);
      if (cell.getAttribute("data-selection-name") === "column") {
        return true;
      }
    }
  }
  return false;
};

// Legacy component for backward compatibility - now just uses the hook
export const TableSelectionBorders = ({ tableRef, ...options }) => {
  useTableSelectionBorders(tableRef, options);
  return null;
};
