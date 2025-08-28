import { useLayoutEffect } from "preact/hooks";
import { useSelection } from "./selection.jsx";

import.meta.css = /* css */ `
  /* Set default selection border color */
  :root {
    --selection-border-color: #0078d4;
  }

  /* All selection border elements need relative positioning for pseudo-elements */
  [data-selection-border-top],
  [data-selection-border-right],
  [data-selection-border-bottom],
  [data-selection-border-left] {
    position: relative;
  }

  /* Common pseudo-element properties for all border combinations */
  [data-selection-border-top]::before,
  [data-selection-border-right]::before,
  [data-selection-border-bottom]::before,
  [data-selection-border-left]::before {
    content: "";
    position: absolute;
    inset: -2px;
    pointer-events: none;
    z-index: 1;
  }

  /* Single border cases */
  [data-selection-border-top]:not([data-selection-border-right]):not(
      [data-selection-border-bottom]
    ):not([data-selection-border-left])::before {
    border-top: 2px solid var(--selection-border-color);
  }

  [data-selection-border-right]:not([data-selection-border-top]):not(
      [data-selection-border-bottom]
    ):not([data-selection-border-left])::before {
    border-right: 2px solid var(--selection-border-color);
  }

  [data-selection-border-bottom]:not([data-selection-border-top]):not(
      [data-selection-border-right]
    ):not([data-selection-border-left])::before {
    border-bottom: 2px solid var(--selection-border-color);
  }

  [data-selection-border-left]:not([data-selection-border-top]):not(
      [data-selection-border-right]
    ):not([data-selection-border-bottom])::before {
    border-left: 2px solid var(--selection-border-color);
  }

  /* Two border combinations */
  [data-selection-border-top][data-selection-border-right]:not(
      [data-selection-border-bottom]
    ):not([data-selection-border-left])::before {
    border-top: 2px solid var(--selection-border-color);
    border-right: 2px solid var(--selection-border-color);
  }

  [data-selection-border-top][data-selection-border-bottom]:not(
      [data-selection-border-right]
    ):not([data-selection-border-left])::before {
    border-top: 2px solid var(--selection-border-color);
    border-bottom: 2px solid var(--selection-border-color);
  }

  [data-selection-border-top][data-selection-border-left]:not(
      [data-selection-border-right]
    ):not([data-selection-border-bottom])::before {
    border-top: 2px solid var(--selection-border-color);
    border-left: 2px solid var(--selection-border-color);
  }

  [data-selection-border-right][data-selection-border-bottom]:not(
      [data-selection-border-top]
    ):not([data-selection-border-left])::before {
    border-right: 2px solid var(--selection-border-color);
    border-bottom: 2px solid var(--selection-border-color);
  }

  [data-selection-border-right][data-selection-border-left]:not(
      [data-selection-border-top]
    ):not([data-selection-border-bottom])::before {
    border-right: 2px solid var(--selection-border-color);
    border-left: 2px solid var(--selection-border-color);
  }

  [data-selection-border-bottom][data-selection-border-left]:not(
      [data-selection-border-top]
    ):not([data-selection-border-right])::before {
    border-bottom: 2px solid var(--selection-border-color);
    border-left: 2px solid var(--selection-border-color);
  }

  /* Three border combinations */
  [data-selection-border-top][data-selection-border-right][data-selection-border-bottom]:not(
      [data-selection-border-left]
    )::before {
    border-top: 2px solid var(--selection-border-color);
    border-right: 2px solid var(--selection-border-color);
    border-bottom: 2px solid var(--selection-border-color);
  }

  [data-selection-border-top][data-selection-border-right][data-selection-border-left]:not(
      [data-selection-border-bottom]
    )::before {
    border-top: 2px solid var(--selection-border-color);
    border-right: 2px solid var(--selection-border-color);
    border-left: 2px solid var(--selection-border-color);
  }

  [data-selection-border-top][data-selection-border-bottom][data-selection-border-left]:not(
      [data-selection-border-right]
    )::before {
    border-top: 2px solid var(--selection-border-color);
    border-bottom: 2px solid var(--selection-border-color);
    border-left: 2px solid var(--selection-border-color);
  }

  [data-selection-border-right][data-selection-border-bottom][data-selection-border-left]:not(
      [data-selection-border-top]
    )::before {
    border-right: 2px solid var(--selection-border-color);
    border-bottom: 2px solid var(--selection-border-color);
    border-left: 2px solid var(--selection-border-color);
  }

  /* Four border combination (full border) */
  [data-selection-border-top][data-selection-border-right][data-selection-border-bottom][data-selection-border-left]::before {
    border: 2px solid var(--selection-border-color);
  }

  /* Hide borders during drag selection */
  table[data-drag-selecting] [data-selection-border-top]::before,
  table[data-drag-selecting] [data-selection-border-right]::before,
  table[data-drag-selecting] [data-selection-border-bottom]::before,
  table[data-drag-selecting] [data-selection-border-left]::before {
    display: none;
  }
`;

export const useTableSelectionBorders = (tableRef, options = {}) => {
  const { borderColor = "#0078d4" } = options;
  const selection = useSelection();
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table || !selection) {
      return undefined;
    }

    const updateCellBorders = () => {
      // Clear all existing selection borders
      const allCells = table.querySelectorAll("td, th");
      allCells.forEach((cell) => {
        cell.removeAttribute("data-selection-border-top");
        cell.removeAttribute("data-selection-border-right");
        cell.removeAttribute("data-selection-border-bottom");
        cell.removeAttribute("data-selection-border-left");
        cell.style.removeProperty("--selection-border-color");
      });

      // Don't apply borders during drag selection - CSS will hide them
      if (table.hasAttribute("data-drag-selecting")) {
        return;
      }

      // Get all selected cells
      const selectedCells = getSelectedCells(table, selection);
      if (selectedCells.length === 0) {
        return;
      }

      // Set the border color on selected cells
      selectedCells.forEach((cell) => {
        cell.style.setProperty("--selection-border-color", borderColor);
      });

      // Apply borders based on selection type and adjacent cells
      applySelectionBorders(selectedCells);
    };

    // Initial border update
    updateCellBorders();

    // Listen for selection changes
    const unsubscribe = selection.channels.change.add(updateCellBorders);

    return () => {
      unsubscribe();
      // Clean up borders on unmount
      const allCells = table.querySelectorAll("td, th");
      allCells.forEach((cell) => {
        cell.removeAttribute("data-selection-border-top");
        cell.removeAttribute("data-selection-border-right");
        cell.removeAttribute("data-selection-border-bottom");
        cell.removeAttribute("data-selection-border-left");
        cell.style.removeProperty("--selection-border-color");
      });
    };
  }, [tableRef, selection, borderColor]);
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

// Apply borders to selected cells based on their position and selection type
const applySelectionBorders = (selectedCells) => {
  if (selectedCells.length === 0) return;

  // Create a map of selected cells by position for quick lookup
  const cellMap = new Map();

  selectedCells.forEach((cell) => {
    const position = getCellPosition(cell);
    if (position) {
      cellMap.set(`${position.row},${position.col}`, cell);
    }
  });

  // Group cells by selection type
  const groupedCells = groupCellsBySelectionType(selectedCells);

  // Apply borders for each selection type
  Object.entries(groupedCells).forEach(([selectionType, cells]) => {
    if (selectionType === "row") {
      applyRowSelectionBorders(cells, cellMap);
    } else if (selectionType === "column") {
      applyColumnSelectionBorders(cells, cellMap);
    } else {
      // Regular cell selection
      applyCellSelectionBorders(cells, cellMap);
    }
  });
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

// Apply borders for row selections
const applyRowSelectionBorders = (rowCells, cellMap) => {
  // For row selections, we apply borders to all data cells in the selected rows
  rowCells.forEach((rowHeaderCell) => {
    const position = getCellPosition(rowHeaderCell);
    if (!position) return;

    const table = rowHeaderCell.closest("table");
    const row = table.rows[position.row];

    // Apply borders to all data cells in this row (excluding first column)
    Array.from(row.cells).forEach((cell, colIndex) => {
      if (colIndex === 0) return; // Skip row header

      const cellPos = { row: position.row, col: colIndex };

      // Top border: if no selected row above
      if (!hasSelectedRowAt(cellMap, cellPos.row - 1)) {
        cell.setAttribute("data-selection-border-top", "");
      }

      // Bottom border: if no selected row below
      if (!hasSelectedRowAt(cellMap, cellPos.row + 1)) {
        cell.setAttribute("data-selection-border-bottom", "");
      }

      // Left border: leftmost data cell
      if (colIndex === 1) {
        cell.setAttribute("data-selection-border-left", "");
      }

      // Right border: rightmost cell
      if (colIndex === row.cells.length - 1) {
        cell.setAttribute("data-selection-border-right", "");
      }
    });
  });
};

// Apply borders for column selections
const applyColumnSelectionBorders = (columnCells, cellMap) => {
  // For column selections, we apply borders to all data cells in the selected columns
  columnCells.forEach((columnHeaderCell) => {
    const position = getCellPosition(columnHeaderCell);
    if (!position) return;

    const table = columnHeaderCell.closest("table");

    // Apply borders to all data cells in this column (excluding header row)
    Array.from(table.rows).forEach((row, rowIndex) => {
      if (rowIndex === 0) return; // Skip header row

      const cell = row.cells[position.col];
      if (!cell) return;

      // Top border: first data row
      if (rowIndex === 1) {
        cell.setAttribute("data-selection-border-top", "");
      }

      // Bottom border: last row
      if (rowIndex === table.rows.length - 1) {
        cell.setAttribute("data-selection-border-bottom", "");
      }

      // Left border: if no selected column to the left
      if (!hasSelectedColumnAt(cellMap, position.col - 1)) {
        cell.setAttribute("data-selection-border-left", "");
      }

      // Right border: if no selected column to the right
      if (!hasSelectedColumnAt(cellMap, position.col + 1)) {
        cell.setAttribute("data-selection-border-right", "");
      }
    });
  });
};

// Apply borders for regular cell selections
const applyCellSelectionBorders = (cells, cellMap) => {
  cells.forEach((cell) => {
    const position = getCellPosition(cell);
    if (!position) return;

    // Top border: if no selected cell above
    if (!cellMap.has(`${position.row - 1},${position.col}`)) {
      cell.setAttribute("data-selection-border-top", "");
    }

    // Bottom border: if no selected cell below
    if (!cellMap.has(`${position.row + 1},${position.col}`)) {
      cell.setAttribute("data-selection-border-bottom", "");
    }

    // Left border: if no selected cell to the left
    if (!cellMap.has(`${position.row},${position.col - 1}`)) {
      cell.setAttribute("data-selection-border-left", "");
    }

    // Right border: if no selected cell to the right
    if (!cellMap.has(`${position.row},${position.col + 1}`)) {
      cell.setAttribute("data-selection-border-right", "");
    }
  });
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
