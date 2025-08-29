import { useLayoutEffect } from "preact/hooks";
import { useSelection } from "./selection.jsx";

import.meta.css = /* css */ `
  /* Canvas-based selection borders */
  [data-selection-borders] > .selection-border-canvas {
    position: absolute;
    inset: -2px; /* Extend 2px to sit on cell border edge */
    pointer-events: none;
    width: calc(100% + 4px);
    height: calc(100% + 4px);
  }

  /* Hide borders during drag selection */
  table[data-drag-selecting]
    [data-selection-borders]
    > .selection-border-canvas {
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
  { color = "#0078d4", opacity = 1 } = {},
) => {
  const selection = useSelection();

  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) {
      return null;
    }

    const updateCellBorders = () => {
      // Clear all existing selection borders and injected canvases
      const allCells = table.querySelectorAll("td, th");
      allCells.forEach((cell) => {
        cell.removeAttribute("data-selection-borders");

        // Remove any injected canvas elements
        const existingCanvas = cell.querySelector(".selection-border-canvas");
        if (existingCanvas) {
          existingCanvas.remove();
        }
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
      createSmartSelectionBorders(selectedCells, color, opacity);
    };

    // Initial border update
    updateCellBorders();

    // Listen for selection changes
    const unsubscribe = selection.channels.change.add(updateCellBorders);

    return () => {
      unsubscribe();
    };
  }, [tableRef, selection, color]);
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

// Helper function to create canvas element with drawn borders
const createSelectionBorderCanvas = (
  segments, // Keep for now for compatibility, but we'll use borderPattern instead
  borderColor = "#0078d4",
  opacity = 1,
  neighborInfo = {},
  cellRect,
) => {
  // Create canvas with high-DPI support for crisp rendering
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // Get device pixel ratio for high-DPI displays
  const devicePixelRatio = window.devicePixelRatio || 1;

  // Set canvas size to cell size + 4px border extension
  const canvasWidth = cellRect.width + 4;
  const canvasHeight = cellRect.height + 4;

  // Set actual canvas size for high-DPI
  canvas.width = canvasWidth * devicePixelRatio;
  canvas.height = canvasHeight * devicePixelRatio;

  // Set CSS size to desired visual size
  canvas.className = "selection-border-canvas";

  // Scale the drawing context for high-DPI
  ctx.scale(devicePixelRatio, devicePixelRatio);

  // Set up drawing context for pixel-perfect filled rectangles
  ctx.fillStyle = borderColor;
  ctx.globalAlpha = opacity;

  // Ensure pixel-perfect rendering
  ctx.imageSmoothingEnabled = false;

  // Extract neighbor information for pattern identification
  const {
    top = false,
    left = false,
    right = false,
    bottom = false,
    bottomRight = false,
    topLeft = false,
    topRight = false,
    bottomLeft = false,
  } = neighborInfo;

  // Identify and draw the border pattern based on neighbor connections
  const borderPattern = drawBorder(ctx, canvasWidth, canvasHeight, {
    top,
    left,
    right,
    bottom,
    topLeft,
    topRight,
    bottomLeft,
    bottomRight,
  });

  // Store pattern for potential debugging (can be removed in production)
  canvas.dataset.borderPattern = borderPattern;

  return canvas;
};

// Draw borders and return the pattern name
function drawBorder(ctx, canvasWidth, canvasHeight, neighborInfo) {
  const {
    top,
    left,
    right,
    bottom,
    topLeft,
    topRight,
    bottomLeft,
    bottomRight,
  } = neighborInfo;
  const connectionCount = [top, left, right, bottom].filter(Boolean).length;

  // Case 1: Isolated cell (no connections) - draw all 4 borders
  if (connectionCount === 0) {
    // Top border (owns top-left and top-right corners)
    ctx.fillRect(0, 0, canvasWidth, 1);
    // Right border (excludes corners already owned by top/bottom)
    ctx.fillRect(canvasWidth - 1, 1, 1, canvasHeight - 2);
    // Bottom border (owns bottom-left and bottom-right corners)
    ctx.fillRect(0, canvasHeight - 1, canvasWidth, 1);
    // Left border (excludes corners already owned by top/bottom)
    ctx.fillRect(0, 1, 1, canvasHeight - 2);
    return "isolated";
  }

  // Case 2: Single connection - draw 3 borders
  if (connectionCount === 1) {
    if (top) {
      // Connected from top - draw bottom, left, right borders
      // Bottom border (owns both bottom corners)
      const bottomY = bottom ? canvasHeight - 2 : canvasHeight - 1;
      const bottomStartX = left ? 2 : bottomLeft ? 1 : 0;
      const bottomEndX = right
        ? canvasWidth - 1
        : bottomRight
          ? canvasWidth - 2
          : canvasWidth;
      ctx.fillRect(bottomStartX, bottomY, bottomEndX - bottomStartX, 1);

      // Right border (excludes bottom corner)
      const rightX = right ? canvasWidth - 2 : canvasWidth - 1;
      const rightStartY = topRight ? 2 : 2;
      const rightEndY = bottom
        ? canvasHeight - 1
        : bottomRight
          ? canvasHeight - 2
          : canvasHeight - 1;
      ctx.fillRect(rightX, rightStartY, 1, rightEndY - rightStartY);

      // Left border (excludes bottom corner)
      const leftX = left ? 1 : 0;
      const leftStartY = topLeft ? 2 : 2;
      const leftEndY = bottom
        ? canvasHeight - 1
        : bottomLeft
          ? canvasHeight - 1
          : canvasHeight - 1;
      ctx.fillRect(leftX, leftStartY, 1, leftEndY - leftStartY);

      return "bottom-edge-connection";
    }

    if (bottom) {
      // Connected from bottom - draw top, left, right borders
      // Top border (owns both top corners)
      const topY = top ? 1 : 0;
      const topStartX = left ? 2 : topLeft ? 1 : 0;
      const topEndX = right
        ? canvasWidth
        : topRight
          ? canvasWidth - 2
          : canvasWidth;
      ctx.fillRect(topStartX, topY, topEndX - topStartX, 1);

      // Right border (excludes top corner)
      const rightX = right ? canvasWidth - 2 : canvasWidth - 1;
      const rightStartY = top ? 1 : topRight ? 2 : 1;
      const rightEndY = bottomRight ? canvasHeight - 2 : canvasHeight;
      ctx.fillRect(rightX, rightStartY, 1, rightEndY - rightStartY);

      // Left border (excludes top corner)
      const leftX = left ? 1 : 0;
      const leftStartY = top ? 1 : topLeft ? 2 : 1;
      const leftEndY = bottomLeft ? canvasHeight - 1 : canvasHeight;
      ctx.fillRect(leftX, leftStartY, 1, leftEndY - leftStartY);

      return "top-edge-connection";
    }

    if (left) {
      // Connected from left - draw top, bottom, right borders
      // Top border (owns top-left corner, excludes top-right)
      const topY = top ? 1 : 0;
      const topStartX = topLeft ? 1 : 0;
      const topEndX = right
        ? canvasWidth - 1
        : topRight
          ? canvasWidth - 2
          : canvasWidth - 1;
      ctx.fillRect(topStartX, topY, topEndX - topStartX, 1);

      // Bottom border (owns bottom-left corner, excludes bottom-right)
      const bottomY = bottom ? canvasHeight - 2 : canvasHeight - 1;
      const bottomStartX = bottomLeft ? 1 : 0;
      const bottomEndX = right
        ? canvasWidth - 1
        : bottomRight
          ? canvasWidth - 2
          : canvasWidth - 1;
      ctx.fillRect(bottomStartX, bottomY, bottomEndX - bottomStartX, 1);

      // Right border (owns top-right and bottom-right corners)
      const rightX = right ? canvasWidth - 2 : canvasWidth - 1;
      const rightStartY = top ? 2 : topRight ? 2 : 0;
      const rightEndY = bottom
        ? canvasHeight
        : bottomRight
          ? canvasHeight - 2
          : canvasHeight;
      ctx.fillRect(rightX, rightStartY, 1, rightEndY - rightStartY);

      return "right-edge-connection";
    }

    if (right) {
      // Connected from right - draw top, bottom, left borders
      // Top border (owns top-right corner, excludes top-left)
      const topY = top ? 1 : 0;
      const topStartX = left ? 2 : topLeft ? 1 : 1;
      const topEndX = topRight ? canvasWidth - 2 : canvasWidth;
      ctx.fillRect(topStartX, topY, topEndX - topStartX, 1);

      // Bottom border (owns bottom-right corner, excludes bottom-left)
      const bottomY = bottom ? canvasHeight - 2 : canvasHeight - 1;
      const bottomStartX = left ? 2 : bottomLeft ? 1 : 1;
      const bottomEndX = bottomRight ? canvasWidth - 2 : canvasWidth;
      ctx.fillRect(bottomStartX, bottomY, bottomEndX - bottomStartX, 1);

      // Left border (owns top-left and bottom-left corners)
      const leftX = left ? 1 : 0;
      const leftStartY = top ? 2 : topLeft ? 2 : 0;
      const leftEndY = bottom
        ? canvasHeight
        : bottomLeft
          ? canvasHeight - 1
          : canvasHeight;
      ctx.fillRect(leftX, leftStartY, 1, leftEndY - leftStartY);

      return "left-edge-connection";
    }
  }

  // Case 3: Two connections
  if (connectionCount === 2) {
    if (top && bottom) {
      // Vertical tunnel - draw left, right borders (no corners to manage)
      // Right border
      const rightX = right ? canvasWidth - 2 : canvasWidth - 1;
      const rightStartY = topRight ? 2 : 2;
      const rightEndY = bottomRight ? canvasHeight - 2 : canvasHeight - 2;
      ctx.fillRect(rightX, rightStartY, 1, rightEndY - rightStartY);

      // Left border
      const leftX = left ? 1 : 0;
      const leftStartY = topLeft ? 2 : 2;
      const leftEndY = bottomLeft ? canvasHeight - 1 : canvasHeight - 2;
      ctx.fillRect(leftX, leftStartY, 1, leftEndY - leftStartY);

      return "vertical-tunnel";
    }

    if (left && right) {
      // Horizontal tunnel - draw top, bottom borders (no corners to manage)
      // Top border
      const topY = top ? 1 : 0;
      const topStartX = topLeft ? 1 : 2;
      const topEndX = topRight ? canvasWidth - 2 : canvasWidth - 2;
      ctx.fillRect(topStartX, topY, topEndX - topStartX, 1);

      // Bottom border
      const bottomY = bottom ? canvasHeight - 2 : canvasHeight - 1;
      const bottomStartX = bottomLeft ? 1 : 2;
      const bottomEndX = bottomRight ? canvasWidth - 2 : canvasWidth - 2;
      ctx.fillRect(bottomStartX, bottomY, bottomEndX - bottomStartX, 1);

      return "horizontal-tunnel";
    }

    if (top && left) {
      // Bottom-right corner - bottom border owns bottom-right corner
      // Bottom border (owns bottom-right corner)
      const bottomY = bottom ? canvasHeight - 2 : canvasHeight - 1;
      const bottomStartX = bottomLeft ? 1 : 0;
      const bottomEndX = right
        ? canvasWidth - 1
        : bottomRight
          ? canvasWidth - 2
          : canvasWidth;
      ctx.fillRect(bottomStartX, bottomY, bottomEndX - bottomStartX, 1);

      // Right border (excludes bottom-right corner)
      const rightX = right ? canvasWidth - 2 : canvasWidth - 1;
      const rightStartY = topRight ? 2 : 2;
      const rightEndY = bottom
        ? canvasHeight - 1
        : bottomRight
          ? canvasHeight - 2
          : canvasHeight - 1;
      ctx.fillRect(rightX, rightStartY, 1, rightEndY - rightStartY);

      return "bottom-right-corner";
    }

    if (top && right) {
      // Bottom-left corner - bottom border owns bottom-left corner
      // Bottom border (owns bottom-left corner)
      const bottomY = bottom ? canvasHeight - 2 : canvasHeight - 1;
      const bottomStartX = left ? 2 : bottomLeft ? 1 : 0;
      const bottomEndX = bottomRight ? canvasWidth - 2 : canvasWidth;
      ctx.fillRect(bottomStartX, bottomY, bottomEndX - bottomStartX, 1);

      // Left border (excludes bottom-left corner)
      const leftX = left ? 1 : 0;
      const leftStartY = topLeft ? 2 : 2;
      const leftEndY = bottom
        ? canvasHeight - 1
        : bottomLeft
          ? canvasHeight - 1
          : canvasHeight - 1;
      ctx.fillRect(leftX, leftStartY, 1, leftEndY - leftStartY);

      return "bottom-left-corner";
    }

    if (bottom && left) {
      // Top-right corner - top border owns top-right corner
      // Top border (owns top-right corner)
      const topY = top ? 1 : 0;
      const topStartX = topLeft ? 1 : 0;
      const topEndX = right
        ? canvasWidth
        : topRight
          ? canvasWidth - 2
          : canvasWidth;
      ctx.fillRect(topStartX, topY, topEndX - topStartX, 1);

      // Right border (excludes top-right corner)
      const rightX = right ? canvasWidth - 2 : canvasWidth - 1;
      const rightStartY = top ? 1 : topRight ? 2 : 1;
      const rightEndY = bottomRight ? canvasHeight - 2 : canvasHeight;
      ctx.fillRect(rightX, rightStartY, 1, rightEndY - rightStartY);

      return "top-right-corner";
    }

    if (bottom && right) {
      // Top-left corner - top border owns top-left corner
      // Top border (owns top-left corner)
      const topY = top ? 1 : 0;
      const topStartX = left ? 2 : topLeft ? 1 : 0;
      const topEndX = topRight ? canvasWidth - 2 : canvasWidth;
      ctx.fillRect(topStartX, topY, topEndX - topStartX, 1);

      // Left border (excludes top-left corner)
      const leftX = left ? 1 : 0;
      const leftStartY = top ? 1 : topLeft ? 2 : 1;
      const leftEndY = bottomLeft ? canvasHeight - 1 : canvasHeight;
      ctx.fillRect(leftX, leftStartY, 1, leftEndY - leftStartY);

      return "top-left-corner";
    }
  }

  // Case 4: Three connections - draw single border
  if (connectionCount === 3) {
    if (!top) {
      // Top border only
      const topY = 0;
      const topStartX = left ? 2 : topLeft ? 1 : 0;
      const topEndX = right
        ? canvasWidth
        : topRight
          ? canvasWidth - 2
          : canvasWidth;
      ctx.fillRect(topStartX, topY, topEndX - topStartX, 1);
      return "top-only";
    }

    if (!bottom) {
      // Bottom border only
      const bottomY = canvasHeight - 1;
      const bottomStartX = left ? 2 : bottomLeft ? 1 : 0;
      const bottomEndX = right
        ? canvasWidth - 1
        : bottomRight
          ? canvasWidth - 2
          : canvasWidth;
      ctx.fillRect(bottomStartX, bottomY, bottomEndX - bottomStartX, 1);
      return "bottom-only";
    }

    if (!left) {
      // Left border only
      const leftX = 0;
      const leftStartY = top ? 2 : topLeft ? 2 : 0;
      const leftEndY = bottom
        ? canvasHeight
        : bottomLeft
          ? canvasHeight - 1
          : canvasHeight;
      ctx.fillRect(leftX, leftStartY, 1, leftEndY - leftStartY);
      return "left-only";
    }

    if (!right) {
      // Right border only
      const rightX = canvasWidth - 1;
      const rightStartY = top ? 2 : topRight ? 2 : 0;
      const rightEndY = bottom
        ? canvasHeight
        : bottomRight
          ? canvasHeight - 2
          : canvasHeight;
      ctx.fillRect(rightX, rightStartY, 1, rightEndY - rightStartY);
      return "right-only";
    }
  }

  // Case 5: Four connections - no borders
  return "fully-internal";
}

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

    // Generate canvas for this cell's segments
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

    // Get cell dimensions for canvas sizing
    const cellRect = cell.getBoundingClientRect();
    const canvasElement = createSelectionBorderCanvas(
      segments,
      color,
      opacity,
      neighborInfo,
      cellRect,
    );

    if (canvasElement) {
      cell.setAttribute("data-selection-borders", "");

      // Remove any existing canvas
      const existingCanvas = cell.querySelector(".selection-border-canvas");
      if (existingCanvas) {
        existingCanvas.remove();
      }

      // Inject the canvas directly into the cell
      cell.appendChild(canvasElement);
    } else {
      // Clean up if no borders needed
      cell.removeAttribute("data-selection-borders");
      const existingCanvas = cell.querySelector(".selection-border-canvas");
      if (existingCanvas) {
        existingCanvas.remove();
      }
    }
  });
};

// Create borders for row selections
const createRowSelectionBorders = (rowCells, cellMap, color, opacity) => {
  if (rowCells.length === 0) {
    return;
  }

  rowCells.forEach((rowHeaderCell) => {
    const position = getCellPosition(rowHeaderCell);
    if (!position) return;

    // Check if we need borders
    const needsTop = !hasSelectedRowAt(cellMap, position.row - 1);
    const needsBottom = !hasSelectedRowAt(cellMap, position.row + 1);

    // Row selections always need left and right borders, top/bottom depend on adjacent rows
    const segments = [];
    if (needsTop) segments.push("top-edge");
    segments.push("right-edge");
    if (needsBottom) segments.push("bottom-edge");
    segments.push("left-edge");

    const cellRect = rowHeaderCell.getBoundingClientRect();
    const canvasElement = createSelectionBorderCanvas(
      segments,
      color,
      opacity,
      {},
      cellRect,
    );

    rowHeaderCell.setAttribute("data-selection-borders", "");

    // Remove any existing canvas
    const existingCanvas = rowHeaderCell.querySelector(
      ".selection-border-canvas",
    );
    if (existingCanvas) {
      existingCanvas.remove();
    }

    rowHeaderCell.appendChild(canvasElement);
  });
};

// Create borders for column selections
const createColumnSelectionBorders = (columnCells, cellMap, color, opacity) => {
  if (columnCells.length === 0) {
    return;
  }

  columnCells.forEach((columnHeaderCell) => {
    const position = getCellPosition(columnHeaderCell);
    if (!position) return;

    // Check if we need borders
    const needsLeft = !hasSelectedColumnAt(cellMap, position.col - 1);
    const needsRight = !hasSelectedColumnAt(cellMap, position.col + 1);

    // Column selections always need top and bottom borders, left/right depend on adjacent columns
    const segments = [];
    segments.push("top-edge");
    if (needsRight) segments.push("right-edge");
    segments.push("bottom-edge");
    if (needsLeft) segments.push("left-edge");

    const cellRect = columnHeaderCell.getBoundingClientRect();
    const canvasElement = createSelectionBorderCanvas(
      segments,
      color,
      opacity,
      {},
      cellRect,
    );

    columnHeaderCell.setAttribute("data-selection-borders", "");

    // Remove any existing canvas
    const existingCanvas = columnHeaderCell.querySelector(
      ".selection-border-canvas",
    );
    if (existingCanvas) {
      existingCanvas.remove();
    }

    columnHeaderCell.appendChild(canvasElement);
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
