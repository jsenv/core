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
    inset: -2px; /* Extend 2px to sit on cell border edge */
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
      );
    }
  });
};

// Helper function to create SVG path for selection borders
const createSelectionBorderSVG = (
  segments,
  borderColor = "#0078d4",
  neighborInfo = {},
) => {
  let pathData = "";

  // Check which segments we have to adjust edge positioning
  const hasTopRightCorner = segments.includes("top-right-corner");
  const hasBottomRightCorner = segments.includes("bottom-right-corner");
  const hasTopLeftCorner = segments.includes("top-left-corner");
  const hasBottomLeftCorner = segments.includes("bottom-left-corner");

  // Extract neighbor information for smart edge adjustment
  const {
    bottomRight = false,
    topRight = false,
    bottomLeft = false,
    topLeft = false,
  } = neighborInfo;

  // Draw each segment that's needed for this cell's contribution to the selection perimeter
  segments.forEach((segment) => {
    switch (segment) {
      case "top-left-corner":
        pathData += `M 0,0 L 1,0 L 1,1 L 0,1 Z `;
        break;
      case "top-edge": {
        // Adjust top edge to not overlap with corners
        const topStartX = hasTopLeftCorner ? 1 : 0;
        const topEndX = hasTopRightCorner ? 99 : topRight ? 99 : 100;
        pathData += `M ${topStartX},0 L ${topEndX},0 L ${topEndX},1 L ${topStartX},1 Z `;
        break;
      }
      case "top-right-corner":
        pathData += `M 99,0 L 100,0 L 100,1 L 99,1 Z `;
        break;
      case "right-edge": {
        // Adjust right edge to not overlap with corners
        const rightStartY = hasTopRightCorner ? 1 : 0;
        const rightEndY = hasBottomRightCorner ? 99 : bottomRight ? 99 : 100;
        pathData += `M 99,${rightStartY} L 100,${rightStartY} L 100,${rightEndY} L 99,${rightEndY} Z `;
        break;
      }
      case "bottom-right-corner":
        pathData += `M 99,99 L 100,99 L 100,100 L 99,100 Z `;
        break;
      case "bottom-edge": {
        // Adjust bottom edge to not overlap with corners
        const bottomStartX = hasBottomLeftCorner ? 1 : bottomLeft ? 1 : 0;
        const bottomEndX = hasBottomRightCorner ? 99 : bottomRight ? 99 : 100;
        pathData += `M ${bottomStartX},99 L ${bottomEndX},99 L ${bottomEndX},100 L ${bottomStartX},100 Z `;
        break;
      }
      case "bottom-left-corner":
        pathData += `M 0,99 L 1,99 L 1,100 L 0,100 Z `;
        break;
      case "left-edge": {
        // Adjust left edge to not overlap with corners
        const leftStartY = hasTopLeftCorner ? 1 : topLeft ? 1 : 0;
        const leftEndY = hasBottomLeftCorner ? 99 : bottomLeft ? 99 : 100;
        pathData += `M 0,${leftStartY} L 1,${leftStartY} L 1,${leftEndY} L 0,${leftEndY} Z `;
        break;
      }
      default:
        // Unknown segment, ignore
        break;
    }
  });

  if (!pathData) return "none";

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
const createCellSelectionBorders = (cellPositions) => {
  if (cellPositions.length === 0) return;

  // Get the border color from CSS
  const borderColor = getBorderColor(cellPositions[0].cell);

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

    // Determine which 8 segments this cell should draw based on surrounding selection
    const segments = [];

    // Check all 8 neighboring positions
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

    // Top-left corner: draw if no top AND no left neighbors
    if (!top && !left) {
      segments.push("top-left-corner");
    }

    // Top edge: draw if no top neighbor
    if (!top) {
      segments.push("top-edge");
    }

    // Top-right corner: draw if no top AND no right neighbors
    if (!top && !right) {
      segments.push("top-right-corner");
    }

    // Right edge: draw if no right neighbor
    if (!right) {
      segments.push("right-edge");
    }

    // Bottom-right corner: draw if no bottom AND no right neighbors
    if (!bottom && !right) {
      segments.push("bottom-right-corner");
    }

    // Bottom edge: draw if no bottom neighbor
    if (!bottom) {
      segments.push("bottom-edge");
    }

    // Bottom-left corner: draw if no bottom AND no left neighbors
    if (!bottom && !left) {
      segments.push("bottom-left-corner");
    }

    // Left edge: draw if no left neighbor
    if (!left) {
      segments.push("left-edge");
    }

    // Generate SVG for this cell's segments
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
    const svgDataUri = createSelectionBorderSVG(
      segments,
      borderColor,
      neighborInfo,
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
