import { useLayoutEffect } from "preact/hooks";
import { useSelection } from "./selection.jsx";

import.meta.css = /* css */ `
  /* Set default selection border color */
  :root {
    --selection-border-color: #0078d4;
  }

  /* Selection border using single pseudo-element with SVG background */
  [data-selection-borders]::before {
    content: "";
    position: absolute;
    top: -2px; /* Above 2px cell border */
    left: -2px; /* Above 2px cell border */
    right: -2px;
    bottom: -2px;
    pointer-events: none;
    z-index: 1;
    background-image: var(--selection-border-svg);
    background-repeat: no-repeat;
    background-size: 100% 100%;
  }

  /* Hide borders during drag selection */
  table[data-drag-selecting] [data-selection-borders]::before {
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
  { color = "#0078d4" } = {},
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
  }, [color]);

  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) {
      return null;
    }

    const updateCellBorders = () => {
      // Clear all existing selection borders and CSS custom properties
      const allCells = table.querySelectorAll("td, th");
      allCells.forEach((cell) => {
        cell.removeAttribute("data-selection-borders");

        // Clear SVG border CSS variable
        cell.style.removeProperty("--selection-border-svg");
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
      createSmartSelectionBorders(selectedCells);
    };

    // Initial border update
    updateCellBorders();

    // Listen for selection changes
    const unsubscribe = selection.channels.change.add(updateCellBorders);

    return () => {
      unsubscribe();
    };
  }, [tableRef, selection]);
};

// Create smart selection borders with proper intersection handling
const createSmartSelectionBorders = (selectedCells) => {
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
      createRowSelectionBorders(cells, cellMap);
    } else if (selectionType === "column") {
      createColumnSelectionBorders(cells, cellMap);
    } else {
      // Regular cell selection
      createCellSelectionBorders(
        cellPositions.filter((cp) => cells.includes(cp.cell)),
        cellMap,
      );
    }
  });
};

// Helper function to create SVG path for selection borders
const createSelectionBorderSVG = (
  needsTop,
  needsRight,
  needsBottom,
  needsLeft,
  borderColor = "#0078d4",
) => {
  const borderWidth = 1; // Border thickness in percentage of the SVG viewBox (1% for 1px visual)

  let pathData = "";

  // Create SVG path for each needed border - overlapping at corners to eliminate gaps
  if (needsTop) {
    // Top border extends full width when no corner overlaps are needed
    const x1 = 0;
    const x2 = 100;
    const y1 = 0;
    const y2 = borderWidth;
    pathData += `M ${x1},${y1} L ${x2},${y1} L ${x2},${y2} L ${x1},${y2} Z `;
  }

  if (needsRight) {
    // Right border extends full height, overlaps with top/bottom if they exist
    const x1 = 100 - borderWidth;
    const x2 = 100;
    const y1 = 0;
    const y2 = 100;
    pathData += `M ${x1},${y1} L ${x2},${y1} L ${x2},${y2} L ${x1},${y2} Z `;
  }

  if (needsBottom) {
    // Bottom border extends full width
    const x1 = 0;
    const x2 = 100;
    const y1 = 100 - borderWidth;
    const y2 = 100;
    pathData += `M ${x1},${y1} L ${x2},${y1} L ${x2},${y2} L ${x1},${y2} Z `;
  }

  if (needsLeft) {
    // Left border extends full height, overlaps with top/bottom if they exist
    const x1 = 0;
    const x2 = borderWidth;
    const y1 = 0;
    const y2 = 100;
    pathData += `M ${x1},${y1} L ${x2},${y1} L ${x2},${y2} L ${x1},${y2} Z `;
  }

  if (!pathData) return "none";

  // Create data URI for SVG with actual color value
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">
    <path d="${pathData}" fill="${borderColor}" />
  </svg>`;

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

// Helper function to get the actual border color
const getBorderColor = (element) => {
  const computed = getComputedStyle(element.ownerDocument.documentElement);
  return (
    computed.getPropertyValue("--selection-border-color").trim() || "#0078d4"
  );
};

// Create borders for cell selections with smart intersection handling
const createCellSelectionBorders = (cellPositions, cellMap) => {
  if (cellPositions.length === 0) return;

  // Get the border color from CSS
  const borderColor = getBorderColor(cellPositions[0].cell);

  cellPositions.forEach(({ cell, position }) => {
    // Check which borders this cell needs
    const needsTop = !cellMap.has(`${position.row - 1},${position.col}`);
    const needsBottom = !cellMap.has(`${position.row + 1},${position.col}`);
    const needsLeft = !cellMap.has(`${position.row},${position.col - 1}`);
    const needsRight = !cellMap.has(`${position.row},${position.col + 1}`);

    // Generate SVG for this cell's border configuration
    const svgDataUri = createSelectionBorderSVG(
      needsTop,
      needsRight,
      needsBottom,
      needsLeft,
      borderColor,
    );

    if (svgDataUri !== "none") {
      cell.setAttribute("data-selection-borders", "");
      cell.style.setProperty("--selection-border-svg", svgDataUri);
    }
  });
};

// Create borders for row selections
const createRowSelectionBorders = (rowCells, cellMap) => {
  if (rowCells.length === 0) return;

  // Get the border color from CSS
  const borderColor = getBorderColor(rowCells[0]);

  rowCells.forEach((rowHeaderCell) => {
    const position = getCellPosition(rowHeaderCell);
    if (!position) return;

    // Check if we need borders
    const needsTop = !hasSelectedRowAt(cellMap, position.row - 1);
    const needsBottom = !hasSelectedRowAt(cellMap, position.row + 1);

    // Row selections always need left and right borders, top/bottom depend on adjacent rows
    const svgDataUri = createSelectionBorderSVG(
      needsTop,
      true,
      needsBottom,
      true,
      borderColor,
    );

    rowHeaderCell.setAttribute("data-selection-borders", "");
    rowHeaderCell.style.setProperty("--selection-border-svg", svgDataUri);
  });
};

// Create borders for column selections
const createColumnSelectionBorders = (columnCells, cellMap) => {
  if (columnCells.length === 0) return;

  // Get the border color from CSS
  const borderColor = getBorderColor(columnCells[0]);

  columnCells.forEach((columnHeaderCell) => {
    const position = getCellPosition(columnHeaderCell);
    if (!position) return;

    // Check if we need borders
    const needsLeft = !hasSelectedColumnAt(cellMap, position.col - 1);
    const needsRight = !hasSelectedColumnAt(cellMap, position.col + 1);

    // Column selections always need top and bottom borders, left/right depend on adjacent columns
    const svgDataUri = createSelectionBorderSVG(
      true,
      needsRight,
      true,
      needsLeft,
      borderColor,
    );

    columnHeaderCell.setAttribute("data-selection-borders", "");
    columnHeaderCell.style.setProperty("--selection-border-svg", svgDataUri);
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
