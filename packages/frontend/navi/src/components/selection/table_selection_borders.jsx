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
    top: 0;
    left: var(--border-top-start, 0);
    width: var(--border-top-width, 100%);
    height: var(--selection-border-size);
    background-color: var(--selection-border-color);
    pointer-events: none;
    z-index: 0;
    transform: translateY(-100%);
  }

  /* Right border segments using ::after - highest priority */
  [data-selection-border-right]::after {
    content: "";
    position: absolute;
    top: var(--border-right-start, 0);
    right: 0;
    width: var(--selection-border-size);
    height: var(--border-right-height, 100%);
    background-color: var(--selection-border-color);
    pointer-events: none;
    z-index: 0;
    transform: translateX(100%);
  }

  /* Bottom border segments using ::before when no top border */
  [data-selection-border-bottom]:not([data-selection-border-top])::before {
    content: "";
    position: absolute;
    bottom: 0;
    left: var(--border-bottom-start, 0);
    width: var(--border-bottom-width, 100%);
    height: var(--selection-border-size);
    background-color: var(--selection-border-color);
    pointer-events: none;
    z-index: 0;
    transform: translateY(100%);
  }

  /* Bottom border segments using a custom approach when top border exists */
  [data-selection-border-bottom][data-selection-border-top] {
    box-shadow:
      0 calc(100% + var(--selection-border-size)) 0 0
        var(--selection-border-color),
      var(--border-bottom-start, 0) calc(100% + var(--selection-border-size)) 0
        0 transparent,
      calc(var(--border-bottom-start, 0) + var(--border-bottom-width, 100%))
        calc(100% + var(--selection-border-size)) 0 0 transparent;
  }

  /* Left border segments using ::after when no right border, handled through transform offset */
  [data-selection-border-left]:not([data-selection-border-right])::after {
    content: "";
    position: absolute;
    top: var(--border-left-start, 0);
    left: 0;
    width: var(--selection-border-size);
    height: var(--border-left-height, 100%);
    background-color: var(--selection-border-color);
    pointer-events: none;
    z-index: 0;
    transform: translateX(-100%);
  }

  /* Left border when right border also exists - use box-shadow approach */
  [data-selection-border-left][data-selection-border-right] {
    box-shadow:
      calc(-1 * var(--selection-border-size)) 0 0 0
        var(--selection-border-color),
      calc(-1 * var(--selection-border-size)) var(--border-left-start, 0) 0 0
        transparent,
      calc(-1 * var(--selection-border-size))
        calc(var(--border-left-start, 0) + var(--border-left-height, 100%)) 0 0
        transparent;
  }

  /* Hide borders during drag selection */
  table[data-drag-selecting] [data-selection-border-top]::before,
    table[data-drag-selecting] [data-selection-border-right]::after,
    table[data-drag-selecting] [data-selection-border-bottom]::before,
    /* Hide borders during drag selection */
    table[data-drag-selecting] [data-selection-border-top]::before,
    table[data-drag-selecting] [data-selection-border-right]::after,
    table[data-drag-selecting] [data-selection-border-bottom]::before,
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
        cell.style.removeProperty("--border-top-start");
        cell.style.removeProperty("--border-top-width");
        cell.style.removeProperty("--border-right-start");
        cell.style.removeProperty("--border-right-height");
        cell.style.removeProperty("--border-bottom-start");
        cell.style.removeProperty("--border-bottom-width");
        cell.style.removeProperty("--border-left-start");
        cell.style.removeProperty("--border-left-height");
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

    // Calculate smart border positioning to avoid overlaps but maintain visual continuity
    if (needsTop) {
      const leftOffset = needsLeft ? borderSize : 0;
      const rightOffset = needsRight ? borderSize : 0;
      cell.setAttribute("data-selection-border-top", "");
      cell.style.setProperty("--border-top-start", `${leftOffset}px`);
      cell.style.setProperty(
        "--border-top-width",
        `calc(100% - ${leftOffset + rightOffset}px)`,
      );
    }

    if (needsBottom) {
      const leftOffset = needsLeft ? borderSize : 0;
      const rightOffset = needsRight ? borderSize : 0;
      cell.setAttribute("data-selection-border-bottom", "");
      cell.style.setProperty("--border-bottom-start", `${leftOffset}px`);
      cell.style.setProperty(
        "--border-bottom-width",
        `calc(100% - ${leftOffset + rightOffset}px)`,
      );
    }

    if (needsLeft) {
      const topOffset = needsTop ? borderSize : 0;
      const bottomOffset = needsBottom ? borderSize : 0;
      cell.setAttribute("data-selection-border-left", "");
      cell.style.setProperty("--border-left-start", `${topOffset}px`);
      cell.style.setProperty(
        "--border-left-height",
        `calc(100% - ${topOffset + bottomOffset}px)`,
      );
    }

    if (needsRight) {
      const topOffset = needsTop ? borderSize : 0;
      const bottomOffset = needsBottom ? borderSize : 0;
      cell.setAttribute("data-selection-border-right", "");
      cell.style.setProperty("--border-right-start", `${topOffset}px`);
      cell.style.setProperty(
        "--border-right-height",
        `calc(100% - ${topOffset + bottomOffset}px)`,
      );
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
      rowHeaderCell.style.setProperty("--border-top-start", "0px");
      rowHeaderCell.style.setProperty("--border-top-width", "100%");
    }

    if (needsBottom) {
      rowHeaderCell.setAttribute("data-selection-border-bottom", "");
      rowHeaderCell.style.setProperty("--border-bottom-start", "0px");
      rowHeaderCell.style.setProperty("--border-bottom-width", "100%");
    }

    // Left and right borders always needed for row selections
    rowHeaderCell.setAttribute("data-selection-border-left", "");
    rowHeaderCell.style.setProperty(
      "--border-left-start",
      needsTop ? `-${borderSize}px` : "0px",
    );
    rowHeaderCell.style.setProperty(
      "--border-left-height",
      needsTop && needsBottom
        ? `calc(100% + ${borderSize * 2}px)`
        : needsTop || needsBottom
          ? `calc(100% + ${borderSize}px)`
          : "100%",
    );

    rowHeaderCell.setAttribute("data-selection-border-right", "");
    rowHeaderCell.style.setProperty(
      "--border-right-start",
      needsTop ? `-${borderSize}px` : "0px",
    );
    rowHeaderCell.style.setProperty(
      "--border-right-height",
      needsTop && needsBottom
        ? `calc(100% + ${borderSize * 2}px)`
        : needsTop || needsBottom
          ? `calc(100% + ${borderSize}px)`
          : "100%",
    );
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
      columnHeaderCell.style.setProperty("--border-left-start", "0px");
      columnHeaderCell.style.setProperty("--border-left-height", "100%");
    }

    if (needsRight) {
      columnHeaderCell.setAttribute("data-selection-border-right", "");
      columnHeaderCell.style.setProperty("--border-right-start", "0px");
      columnHeaderCell.style.setProperty("--border-right-height", "100%");
    }

    // Top and bottom borders always needed for column selections
    columnHeaderCell.setAttribute("data-selection-border-top", "");
    columnHeaderCell.style.setProperty(
      "--border-top-start",
      needsLeft ? `-${borderSize}px` : "0px",
    );
    columnHeaderCell.style.setProperty(
      "--border-top-width",
      needsLeft && needsRight
        ? `calc(100% + ${borderSize * 2}px)`
        : needsLeft || needsRight
          ? `calc(100% + ${borderSize}px)`
          : "100%",
    );

    columnHeaderCell.setAttribute("data-selection-border-bottom", "");
    columnHeaderCell.style.setProperty(
      "--border-bottom-start",
      needsLeft ? `-${borderSize}px` : "0px",
    );
    columnHeaderCell.style.setProperty(
      "--border-bottom-width",
      needsLeft && needsRight
        ? `calc(100% + ${borderSize * 2}px)`
        : needsLeft || needsRight
          ? `calc(100% + ${borderSize}px)`
          : "100%",
    );
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
