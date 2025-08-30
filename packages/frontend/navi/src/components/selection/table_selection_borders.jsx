import { useLayoutEffect } from "preact/hooks";
import { useSelection } from "./selection.jsx";

import.meta.css = /* css */ `
  /* CSS-based selection borders using data attributes */

  /* Selection border colors using data attributes with opacity control */
  [data-selection-border-top] {
    border-top: 1px solid
      color-mix(
        in srgb,
        var(--selection-border-color)
          calc(var(--selection-border-opacity) * 100%),
        transparent
      ) !important;
  }

  [data-selection-border-right] {
    border-right: 1px solid
      color-mix(
        in srgb,
        var(--selection-border-color)
          calc(var(--selection-border-opacity) * 100%),
        transparent
      ) !important;
  }

  [data-selection-border-bottom] {
    border-bottom: 1px solid
      color-mix(
        in srgb,
        var(--selection-border-color)
          calc(var(--selection-border-opacity) * 100%),
        transparent
      ) !important;
  }

  [data-selection-border-left] {
    border-left: 1px solid
      color-mix(
        in srgb,
        var(--selection-border-color)
          calc(var(--selection-border-opacity) * 100%),
        transparent
      ) !important;
  }

  /* Hide borders during drag selection */
  table[data-drag-selecting] [data-selection-border-top],
  table[data-drag-selecting] [data-selection-border-right],
  table[data-drag-selecting] [data-selection-border-bottom],
  table[data-drag-selecting] [data-selection-border-left] {
    border-color: transparent !important;
  }
`;
export const useTableSelectionBorders = (
  tableRef,
  { color = "#0078d4", opacity = 1 } = {},
) => {
  const selection = useSelection();

  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) {
      return null;
    }

    const updateCellBorders = () => {
      // Clear all existing selection border attributes
      const allCells = table.querySelectorAll("td, th");
      allCells.forEach((cell) => {
        cell.removeAttribute("data-selection-border-top");
        cell.removeAttribute("data-selection-border-right");
        cell.removeAttribute("data-selection-border-bottom");
        cell.removeAttribute("data-selection-border-left");
        // Always set CSS variables even when clearing to avoid fallbacks
        cell.style.setProperty("--selection-border-color", color);
        cell.style.setProperty("--selection-border-opacity", opacity);
      });

      // Remove table-level selection marker (no longer needed)

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
      createSmartSelectionBorders(selectedCells, color, opacity);
    };

    // Initial border update
    updateCellBorders();

    // Listen for selection changes
    const unsubscribe = selection.channels.change.add(updateCellBorders);

    return () => {
      unsubscribe();
    };
  }, [tableRef, selection, color, opacity]);
};

// Create smart selection borders with proper intersection handling
const createSmartSelectionBorders = (selectedCells, color, opacity) => {
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
      createRowSelectionBorders(cells, cellMap, color, opacity);
    } else if (selectionType === "column") {
      createColumnSelectionBorders(cells, cellMap, color, opacity);
    } else {
      // Regular cell selection
      createCellSelectionBorders(
        cellPositions.filter((cp) => cells.includes(cp.cell)),
        color,
        opacity,
      );
    }
  });
};

// Helper function to apply CSS border attributes to a cell
const applyCellBorders = (cell, borderInfo, color, opacity) => {
  const { top, right, bottom, left } = borderInfo;

  // Set CSS custom properties for color and opacity
  cell.style.setProperty("--selection-border-color", color);
  cell.style.setProperty("--selection-border-opacity", opacity);

  // Apply border data attributes based on which borders should be shown
  if (top) cell.setAttribute("data-selection-border-top", "");
  if (right) cell.setAttribute("data-selection-border-right", "");
  if (bottom) cell.setAttribute("data-selection-border-bottom", "");
  if (left) cell.setAttribute("data-selection-border-left", "");
};

// Determine which borders a cell should have based on neighbor connections
const calculateCellBorders = (neighborInfo) => {
  const { top, left, right, bottom } = neighborInfo;

  // Default: show all borders for isolated cells
  let borders = { top: true, right: true, bottom: true, left: true };

  // Remove borders where we're connected to neighbors
  if (top) borders.top = false;
  if (right) borders.right = false;
  if (bottom) borders.bottom = false;
  if (left) borders.left = false;

  return borders;
};

// Create borders for cell selections with smart intersection handling
const createCellSelectionBorders = (cellPositions, color, opacity) => {
  if (cellPositions.length === 0) {
    return;
  }

  // Helper function to check if a position is covered by any selected cell (including spans)
  const isPositionSelected = (row, col) => {
    return cellPositions.some(({ position, cell }) => {
      const rowSpan = parseInt(cell.getAttribute("rowspan") || "1", 10);
      const colSpan = parseInt(cell.getAttribute("colspan") || "1", 10);

      return (
        row >= position.row &&
        row < position.row + rowSpan &&
        col >= position.col &&
        col < position.col + colSpan
      );
    });
  };

  cellPositions.forEach(({ cell, position }) => {
    const rowSpan = parseInt(cell.getAttribute("rowspan") || "1", 10);
    const colSpan = parseInt(cell.getAttribute("colspan") || "1", 10);

    // Check all 8 neighboring positions for border calculation
    const top = isPositionSelected(position.row - 1, position.col);
    const left = isPositionSelected(position.row, position.col - 1);
    const right = isPositionSelected(position.row, position.col + colSpan);
    const bottom = isPositionSelected(position.row + rowSpan, position.col);

    // Check diagonal neighbors to prevent edge overlaps
    const topRight = isPositionSelected(
      position.row - 1,
      position.col + colSpan,
    );
    const bottomRight = isPositionSelected(
      position.row + rowSpan,
      position.col + colSpan,
    );
    const bottomLeft = isPositionSelected(
      position.row + rowSpan,
      position.col - 1,
    );
    const topLeft = isPositionSelected(position.row - 1, position.col - 1);

    // Prepare neighbor information for border calculation
    const neighborInfo = {
      top,
      left,
      right,
      bottom,
      topRight,
      bottomRight,
      bottomLeft,
      topLeft,
    };

    // Calculate which borders this cell should display
    const borderInfo = calculateCellBorders(neighborInfo);

    // Apply CSS border attributes to the cell
    applyCellBorders(cell, borderInfo, color, opacity);
  });
};

// Create borders for row selections
const createRowSelectionBorders = (rowCells, cellMap, color, opacity) => {
  if (rowCells.length === 0) {
    return;
  }

  rowCells.forEach((rowHeaderCell) => {
    // For row selections, show all borders since they're independent
    const borderInfo = { top: true, right: true, bottom: true, left: true };
    applyCellBorders(rowHeaderCell, borderInfo, color, opacity);
  });
};

// Create borders for column selections
const createColumnSelectionBorders = (columnCells, cellMap, color, opacity) => {
  if (columnCells.length === 0) {
    return;
  }

  columnCells.forEach((columnHeaderCell) => {
    // For column selections, show all borders since they're independent
    const borderInfo = { top: true, right: true, bottom: true, left: true };
    applyCellBorders(columnHeaderCell, borderInfo, color, opacity);
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

// Legacy component for backward compatibility - now just uses the hook
export const TableSelectionBorders = ({ tableRef, ...options }) => {
  useTableSelectionBorders(tableRef, options);
  return null;
};
