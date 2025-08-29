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

  // Identify the border pattern based on neighbor connections
  const connectionCount = [top, left, right, bottom].filter(Boolean).length;

  // Determine the specific pattern for documentation/debugging purposes
  let borderPattern;
  if (connectionCount === 0) {
    borderPattern = "isolated"; // All 4 borders
  } else if (connectionCount === 1) {
    if (top)
      borderPattern = "bottom-edge-connection"; // Connected from top, draw bottom 3 borders
    else if (bottom)
      borderPattern = "top-edge-connection"; // Connected from bottom, draw top 3 borders
    else if (left)
      borderPattern = "right-edge-connection"; // Connected from left, draw right 3 borders
    else if (right) borderPattern = "left-edge-connection"; // Connected from right, draw left 3 borders
  } else if (connectionCount === 2) {
    if (top && bottom)
      borderPattern = "vertical-tunnel"; // Connected top-bottom, draw left-right borders
    else if (left && right)
      borderPattern = "horizontal-tunnel"; // Connected left-right, draw top-bottom borders
    else if (top && left)
      borderPattern = "bottom-right-corner"; // Connected top-left, draw bottom-right corner
    else if (top && right)
      borderPattern = "bottom-left-corner"; // Connected top-right, draw bottom-left corner
    else if (bottom && left)
      borderPattern = "top-right-corner"; // Connected bottom-left, draw top-right corner
    else if (bottom && right) borderPattern = "top-left-corner"; // Connected bottom-right, draw top-left corner
  } else if (connectionCount === 3) {
    if (!top)
      borderPattern = "top-only"; // Connected on 3 sides except top
    else if (!bottom)
      borderPattern = "bottom-only"; // Connected on 3 sides except bottom
    else if (!left)
      borderPattern = "left-only"; // Connected on 3 sides except left
    else if (!right) borderPattern = "right-only"; // Connected on 3 sides except right
  } else {
    borderPattern = "fully-internal"; // Connected on all 4 sides, no borders
  }

  // Store pattern for potential debugging (can be removed in production)
  canvas.dataset.borderPattern = borderPattern;

  // Draw borders based on the identified pattern with anti-overlap logic
  drawBorderPattern(ctx, borderPattern, {
    canvasWidth,
    canvasHeight,
    neighborInfo: {
      top,
      left,
      right,
      bottom,
      topLeft,
      topRight,
      bottomLeft,
      bottomRight,
    },
  });

  return canvas;
};

// Draw borders based on the specific pattern
function drawBorderPattern(
  ctx,
  pattern,
  { canvasWidth, canvasHeight, neighborInfo },
) {
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

  switch (pattern) {
    case "isolated":
      // All 4 borders - no neighbors
      drawTopBorder(ctx, canvasWidth, {
        hasTopNeighbor: false,
        hasLeftNeighbor: false,
        hasRightNeighbor: false,
        topLeft: false,
        topRight: false,
      });
      drawRightBorder(ctx, canvasWidth, canvasHeight, {
        hasRightNeighbor: false,
        hasTopNeighbor: false,
        hasBottomNeighbor: false,
        topRight: false,
        bottomRight: false,
      });
      drawBottomBorder(ctx, canvasWidth, canvasHeight, {
        hasBottomNeighbor: false,
        hasLeftNeighbor: false,
        hasRightNeighbor: false,
        bottomLeft: false,
        bottomRight: false,
      });
      drawLeftBorder(ctx, canvasHeight, {
        hasLeftNeighbor: false,
        hasTopNeighbor: false,
        hasBottomNeighbor: false,
        topLeft: false,
        bottomLeft: false,
        topRight: false,
      });
      break;

    case "bottom-edge-connection":
      // Connected from top - draw bottom, left, right borders
      drawRightBorder(ctx, canvasWidth, canvasHeight, {
        hasRightNeighbor: right,
        hasTopNeighbor: top,
        hasBottomNeighbor: bottom,
        topRight,
        bottomRight,
      });
      drawBottomBorder(ctx, canvasWidth, canvasHeight, {
        hasBottomNeighbor: bottom,
        hasLeftNeighbor: left,
        hasRightNeighbor: right,
        bottomLeft,
        bottomRight,
      });
      drawLeftBorder(ctx, canvasHeight, {
        hasLeftNeighbor: left,
        hasTopNeighbor: top,
        hasBottomNeighbor: bottom,
        topLeft,
        bottomLeft,
        topRight,
      });
      break;

    case "top-edge-connection":
      // Connected from bottom - draw top, left, right borders
      drawTopBorder(ctx, canvasWidth, {
        hasTopNeighbor: top,
        hasLeftNeighbor: left,
        hasRightNeighbor: right,
        topLeft,
        topRight,
      });
      drawRightBorder(ctx, canvasWidth, canvasHeight, {
        hasRightNeighbor: right,
        hasTopNeighbor: top,
        hasBottomNeighbor: bottom,
        topRight,
        bottomRight,
      });
      drawLeftBorder(ctx, canvasHeight, {
        hasLeftNeighbor: left,
        hasTopNeighbor: top,
        hasBottomNeighbor: bottom,
        topLeft,
        bottomLeft,
        topRight,
      });
      break;

    case "right-edge-connection":
      // Connected from left - draw top, bottom, right borders
      drawTopBorder(ctx, canvasWidth, {
        hasTopNeighbor: top,
        hasLeftNeighbor: left,
        hasRightNeighbor: right,
        topLeft,
        topRight,
      });
      drawRightBorder(ctx, canvasWidth, canvasHeight, {
        hasRightNeighbor: right,
        hasTopNeighbor: top,
        hasBottomNeighbor: bottom,
        topRight,
        bottomRight,
      });
      drawBottomBorder(ctx, canvasWidth, canvasHeight, {
        hasBottomNeighbor: bottom,
        hasLeftNeighbor: left,
        hasRightNeighbor: right,
        bottomLeft,
        bottomRight,
      });
      break;

    case "left-edge-connection":
      // Connected from right - draw top, bottom, left borders
      drawTopBorder(ctx, canvasWidth, {
        hasTopNeighbor: top,
        hasLeftNeighbor: left,
        hasRightNeighbor: right,
        topLeft,
        topRight,
      });
      drawBottomBorder(ctx, canvasWidth, canvasHeight, {
        hasBottomNeighbor: bottom,
        hasLeftNeighbor: left,
        hasRightNeighbor: right,
        bottomLeft,
        bottomRight,
      });
      drawLeftBorder(ctx, canvasHeight, {
        hasLeftNeighbor: left,
        hasTopNeighbor: top,
        hasBottomNeighbor: bottom,
        topLeft,
        bottomLeft,
        topRight,
      });
      break;

    case "vertical-tunnel":
      // Connected top-bottom - draw left, right borders
      drawRightBorder(ctx, canvasWidth, canvasHeight, {
        hasRightNeighbor: right,
        hasTopNeighbor: top,
        hasBottomNeighbor: bottom,
        topRight,
        bottomRight,
      });
      drawLeftBorder(ctx, canvasHeight, {
        hasLeftNeighbor: left,
        hasTopNeighbor: top,
        hasBottomNeighbor: bottom,
        topLeft,
        bottomLeft,
        topRight,
      });
      break;

    case "horizontal-tunnel":
      // Connected left-right - draw top, bottom borders
      drawTopBorder(ctx, canvasWidth, {
        hasTopNeighbor: top,
        hasLeftNeighbor: left,
        hasRightNeighbor: right,
        topLeft,
        topRight,
      });
      drawBottomBorder(ctx, canvasWidth, canvasHeight, {
        hasBottomNeighbor: bottom,
        hasLeftNeighbor: left,
        hasRightNeighbor: right,
        bottomLeft,
        bottomRight,
      });
      break;

    case "bottom-right-corner":
      // Connected top-left - draw bottom, right borders
      drawRightBorder(ctx, canvasWidth, canvasHeight, {
        hasRightNeighbor: right,
        hasTopNeighbor: top,
        hasBottomNeighbor: bottom,
        topRight,
        bottomRight,
      });
      drawBottomBorder(ctx, canvasWidth, canvasHeight, {
        hasBottomNeighbor: bottom,
        hasLeftNeighbor: left,
        hasRightNeighbor: right,
        bottomLeft,
        bottomRight,
      });
      break;

    case "bottom-left-corner":
      // Connected top-right - draw bottom, left borders
      drawBottomBorder(ctx, canvasWidth, canvasHeight, {
        hasBottomNeighbor: bottom,
        hasLeftNeighbor: left,
        hasRightNeighbor: right,
        bottomLeft,
        bottomRight,
      });
      drawLeftBorder(ctx, canvasHeight, {
        hasLeftNeighbor: left,
        hasTopNeighbor: top,
        hasBottomNeighbor: bottom,
        topLeft,
        bottomLeft,
        topRight,
      });
      break;

    case "top-right-corner":
      // Connected bottom-left - draw top, right borders
      drawTopBorder(ctx, canvasWidth, {
        hasTopNeighbor: top,
        hasLeftNeighbor: left,
        hasRightNeighbor: right,
        topLeft,
        topRight,
      });
      drawRightBorder(ctx, canvasWidth, canvasHeight, {
        hasRightNeighbor: right,
        hasTopNeighbor: top,
        hasBottomNeighbor: bottom,
        topRight,
        bottomRight,
      });
      break;

    case "top-left-corner":
      // Connected bottom-right - draw top, left borders
      drawTopBorder(ctx, canvasWidth, {
        hasTopNeighbor: top,
        hasLeftNeighbor: left,
        hasRightNeighbor: right,
        topLeft,
        topRight,
      });
      drawLeftBorder(ctx, canvasHeight, {
        hasLeftNeighbor: left,
        hasTopNeighbor: top,
        hasBottomNeighbor: bottom,
        topLeft,
        bottomLeft,
        topRight,
      });
      break;

    case "top-only":
      // Connected on 3 sides except top - draw top border only
      drawTopBorder(ctx, canvasWidth, {
        hasTopNeighbor: top,
        hasLeftNeighbor: left,
        hasRightNeighbor: right,
        topLeft,
        topRight,
      });
      break;

    case "bottom-only":
      // Connected on 3 sides except bottom - draw bottom border only
      drawBottomBorder(ctx, canvasWidth, canvasHeight, {
        hasBottomNeighbor: bottom,
        hasLeftNeighbor: left,
        hasRightNeighbor: right,
        bottomLeft,
        bottomRight,
      });
      break;

    case "left-only":
      // Connected on 3 sides except left - draw left border only
      drawLeftBorder(ctx, canvasHeight, {
        hasLeftNeighbor: left,
        hasTopNeighbor: top,
        hasBottomNeighbor: bottom,
        topLeft,
        bottomLeft,
        topRight,
      });
      break;

    case "right-only":
      // Connected on 3 sides except right - draw right border only
      drawRightBorder(ctx, canvasWidth, canvasHeight, {
        hasRightNeighbor: right,
        hasTopNeighbor: top,
        hasBottomNeighbor: bottom,
        topRight,
        bottomRight,
      });
      break;

    case "fully-internal":
      // Connected on all 4 sides - draw no borders
      break;

    default:
      console.warn(`Unknown border pattern: ${pattern}`);
      break;
  }
}

// Individual border drawing functions with anti-overlap logic
function drawTopBorder(
  ctx,
  canvasWidth,
  { hasTopNeighbor, hasLeftNeighbor, hasRightNeighbor, topLeft, topRight },
) {
  const yPosition = hasTopNeighbor ? 1 : 0;
  const startX = calculateTopBorderStartX(hasLeftNeighbor, topLeft);
  const endX = calculateTopBorderEndX(hasRightNeighbor, topRight, canvasWidth);
  const width = endX - startX;
  ctx.fillRect(startX, yPosition, width, 1);
}

function drawRightBorder(
  ctx,
  canvasWidth,
  canvasHeight,
  {
    hasRightNeighbor,
    hasTopNeighbor,
    hasBottomNeighbor,
    topRight,
    bottomRight,
  },
) {
  const xPosition = hasRightNeighbor ? canvasWidth - 2 : canvasWidth - 1;
  const startY = calculateRightBorderStartY(hasTopNeighbor, topRight);
  const endY = calculateRightBorderEndY(
    hasBottomNeighbor,
    bottomRight,
    canvasHeight,
  );
  const height = endY - startY;
  ctx.fillRect(xPosition, startY, 1, height);
}

function drawBottomBorder(
  ctx,
  canvasWidth,
  canvasHeight,
  {
    hasBottomNeighbor,
    hasLeftNeighbor,
    hasRightNeighbor,
    bottomLeft,
    bottomRight,
  },
) {
  const yPosition = hasBottomNeighbor ? canvasHeight - 2 : canvasHeight - 1;
  const startX = calculateBottomBorderStartX(hasLeftNeighbor, bottomLeft);
  const endX = calculateBottomBorderEndX(
    hasRightNeighbor,
    bottomRight,
    canvasWidth,
  );
  const width = endX - startX;
  ctx.fillRect(startX, yPosition, width, 1);
}

function drawLeftBorder(
  ctx,
  canvasHeight,
  {
    hasLeftNeighbor,
    hasTopNeighbor,
    hasBottomNeighbor,
    topLeft,
    bottomLeft,
    topRight,
  },
) {
  const xPosition = hasLeftNeighbor ? 1 : 0;
  const startY = calculateLeftBorderStartY(hasTopNeighbor, topLeft, topRight);
  const endY = calculateLeftBorderEndY(
    hasBottomNeighbor,
    bottomLeft,
    canvasHeight,
  );
  const height = endY - startY;
  ctx.fillRect(xPosition, startY, 1, height);
}

// Helper functions for calculating border coordinates with anti-overlap logic
function calculateTopBorderStartX(hasLeftNeighbor, hasTopLeftDiagonal) {
  if (hasLeftNeighbor) return 2; // Leave space for left cell's border
  if (hasTopLeftDiagonal) return 1; // Small space for diagonal
  return 0; // Full edge
}

function calculateTopBorderEndX(
  hasRightNeighbor,
  hasTopRightDiagonal,
  canvasWidth,
) {
  if (hasRightNeighbor) return canvasWidth; // Extend to connect
  if (hasTopRightDiagonal) return canvasWidth - 2; // Leave space for diagonal
  return canvasWidth; // Full edge
}

function calculateRightBorderStartY(hasTopNeighbor, hasTopRightDiagonal) {
  if (hasTopNeighbor) return 2; // Leave space for top cell's border
  if (hasTopRightDiagonal) return 2; // Leave space for diagonal
  return 0; // Full edge
}

function calculateRightBorderEndY(
  hasBottomNeighbor,
  hasBottomRightDiagonal,
  canvasHeight,
) {
  if (hasBottomNeighbor) return canvasHeight; // Extend to connect
  if (hasBottomRightDiagonal) return canvasHeight - 2; // Leave space for diagonal
  return canvasHeight; // Full edge
}

function calculateBottomBorderStartX(hasLeftNeighbor, hasBottomLeftDiagonal) {
  if (hasLeftNeighbor) return 2; // Leave space for left cell's border
  if (hasBottomLeftDiagonal) return 1; // Small space for diagonal
  return 0; // Full edge
}

function calculateBottomBorderEndX(
  hasRightNeighbor,
  hasBottomRightDiagonal,
  canvasWidth,
) {
  if (hasRightNeighbor) return canvasWidth - 1; // Leave space for right cell
  if (hasBottomRightDiagonal) return canvasWidth - 2; // Leave space for diagonal
  return canvasWidth; // Full edge
}

function calculateLeftBorderStartY(
  hasTopNeighbor,
  hasTopLeftDiagonal,
  hasTopRightDiagonal,
) {
  if (hasTopNeighbor) return 2; // Leave space for top cell's border
  if (hasTopLeftDiagonal) return 2; // Leave space for diagonal
  if (hasTopRightDiagonal) return 2; // Leave space for opposite diagonal
  return 0; // Full edge
}

function calculateLeftBorderEndY(
  hasBottomNeighbor,
  hasBottomLeftDiagonal,
  canvasHeight,
) {
  if (hasBottomNeighbor) return canvasHeight; // Extend to connect
  if (hasBottomLeftDiagonal) return canvasHeight - 1; // Leave space for diagonal
  return canvasHeight; // Full edge
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
