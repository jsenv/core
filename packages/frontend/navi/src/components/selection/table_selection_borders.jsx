import { useLayoutEffect } from "preact/hooks";
import { useSelection } from "./selection.jsx";

const TABLE_BORDER_WIDTH = 1;

import.meta.css = /* css */ `
  /* Canvas-based selection borders */
  [data-selection-borders] > .selection-border-canvas {
    position: absolute;
    inset: -${TABLE_BORDER_WIDTH}px; /* Extend 2px to sit on cell border edge */
    pointer-events: none;
    width: calc(100% + ${TABLE_BORDER_WIDTH * 2}px);
    height: calc(100% + ${TABLE_BORDER_WIDTH * 2}px);
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
  borderColor = "#0078d4",
  opacity = 1,
  neighborInfo = {},
  cellRect,
  cellPosition = null,
  allCellPositions = [],
) => {
  // Create canvas with high-DPI support for crisp rendering
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // Get device pixel ratio for high-DPI displays
  const devicePixelRatio = window.devicePixelRatio || 1;

  // Set canvas size to cell size + 4px border extension
  const canvasWidth = cellRect.width + TABLE_BORDER_WIDTH * 2;
  const canvasHeight = cellRect.height + TABLE_BORDER_WIDTH * 2;

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
  const borderPattern = drawBorder(
    ctx,
    canvasWidth,
    canvasHeight,
    {
      top,
      left,
      right,
      bottom,
      topLeft,
      topRight,
      bottomLeft,
      bottomRight,
    },
    cellPosition,
    allCellPositions,
  );

  // Store pattern for potential debugging (can be removed in production)
  canvas.setAttribute("data-border", borderPattern);
  return canvas;
};

/**
 * Draw borders and return the pattern name
 *
 * BORDER COORDINATION CHALLENGE:
 * ==============================
 *
 * When multiple cells are selected, they form a contiguous selection area that needs
 * a seamless 1px perimeter border. The challenge is that each cell draws its own borders
 * independently, but they must coordinate to avoid:
 *
 * 1. OVERLAPS: Two adjacent cells drawing the same pixel (creates thick/dark borders)
 * 2. GAPS: No cell drawing a required pixel (creates broken borders)
 *
 * JUNCTION RESPONSIBILITY SYSTEM:
 * ==============================
 *
 * At the junction between two cells, exactly ONE cell must be responsible for drawing
 * the shared border pixels. We use these rules:
 *
 * - CORNER OWNERSHIP: Top/bottom borders own corners (draw full width including corners)
 *                     Left/right borders avoid corners (start at Y=1, end at Y=height-1)
 *
 * - JUNCTION EXTENSION: The "earlier" cell (top-left priority) extends into junction areas:
 *   • Vertical junctions: TOP cell extends DOWN into the junction
 *   • Horizontal junctions: LEFT cell extends RIGHT into the junction
 *
 * COORDINATE CALCULATION:
 * ======================
 *
 * Each border segment needs precise start/end coordinates:
 *
 * - Normal borders: Start=0, End=canvasWidth/canvasHeight (full edge)
 * - Connected borders: Adjust by TABLE_BORDER_WIDTH to avoid drawing over connections
 * - Junction borders: Extend to full width/height when responsible for junction
 *
 * The ±1 pixel offsets are applied based on:
 * - Whether this cell has responsibility for the junction
 * - Which direction the connection/junction is in
 * - Corner ownership rules to prevent overlap
 *
 * This creates a pixel-perfect perimeter where each pixel is drawn exactly once.
 */
const drawBorder = (
  ctx,
  canvasWidth,
  canvasHeight,
  neighborInfo,
  cellPosition,
  allCellPositions,
) => {
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

  // UNIFIED BORDER COORDINATE CALCULATION SYSTEM
  // ============================================

  // Helper function to determine if this cell should extend into a junction
  const shouldExtendIntoJunction = (direction) => {
    if (!cellPosition || !allCellPositions) return false;

    if (direction === "right") {
      // Left cell extends right into horizontal junction
      return allCellPositions.some(
        ({ position }) =>
          position.row === cellPosition.row &&
          position.col === cellPosition.col + 1,
      );
    }
    if (direction === "left") {
      // Right cell never extends left (left cell handles it)
      return false;
    }
    if (direction === "down") {
      // Top cell extends down into vertical junction
      return allCellPositions.some(
        ({ position }) =>
          position.row === cellPosition.row + 1 &&
          position.col === cellPosition.col,
      );
    }
    if (direction === "up") {
      // Bottom cell never extends up (top cell handles it)
      return false;
    }
    return false;
  };

  // Calculate border coordinates with junction responsibility
  const getBorderCoordinates = (
    borderSide,
    connections,
    diagonalAdjustments = {},
  ) => {
    const {
      left: hasLeft,
      right: hasRight,
      top: hasTop,
      bottom: hasBottom,
    } = connections;

    if (borderSide === "top") {
      let startX = hasLeft ? 1 : 0; // Avoid left junction if connected
      let endX;

      if (hasRight) {
        // Connected on right - extend to right edge for seamless connection
        endX = canvasWidth;
      } else {
        // Not connected on right - check if we should extend into junction
        endX = shouldExtendIntoJunction("right") ? canvasWidth : canvasWidth;
      }

      // Apply diagonal adjustments
      if (diagonalAdjustments.topLeft) startX = Math.max(startX, 1);
      if (diagonalAdjustments.topRight) endX = Math.min(endX, canvasWidth - 1);

      return {
        x: startX,
        y: 0,
        width: Math.max(0, endX - startX),
        height: 1,
      };
    }
    if (borderSide === "bottom") {
      let startX = hasLeft ? 1 : 0; // Avoid left junction if connected
      let endX;

      if (hasRight) {
        // Connected on right - extend to right edge for seamless connection
        endX = canvasWidth;
      } else {
        // Not connected on right - check if we should extend into junction
        endX = shouldExtendIntoJunction("right") ? canvasWidth : canvasWidth;
      }

      // Apply diagonal adjustments
      if (diagonalAdjustments.bottomLeft) startX = Math.max(startX, 1);
      if (diagonalAdjustments.bottomRight)
        endX = Math.min(endX, canvasWidth - 1);

      return {
        x: startX,
        y: canvasHeight - 1,
        width: Math.max(0, endX - startX),
        height: 1,
      };
    }
    if (borderSide === "left") {
      let startY = 1; // Start below top corner by default (top border owns corners)
      let endY = canvasHeight - 1; // Stop above bottom corner by default (bottom border owns corners)

      // For vertical connections, use junction responsibility to avoid overlaps
      if (hasTop && shouldExtendIntoJunction("up")) {
        startY = 0; // Only extend up if this cell is responsible for the junction
      }
      if (hasBottom && shouldExtendIntoJunction("down")) {
        endY = canvasHeight; // Only extend down if this cell is responsible for the junction
      }

      // Apply diagonal adjustments
      if (diagonalAdjustments.topLeft) startY = Math.max(startY, 1);
      if (diagonalAdjustments.bottomLeft)
        endY = Math.min(endY, canvasHeight - 1);

      return {
        x: 0,
        y: startY,
        width: 1,
        height: Math.max(0, endY - startY),
      };
    }
    if (borderSide === "right") {
      let startY = 1; // Start below top corner by default (top border owns corners)
      let endY = canvasHeight - 1; // Stop above bottom corner by default (bottom border owns corners)

      // For vertical connections, use junction responsibility to avoid overlaps
      if (hasTop && shouldExtendIntoJunction("up")) {
        startY = 0; // Only extend up if this cell is responsible for the junction
      }
      if (hasBottom && shouldExtendIntoJunction("down")) {
        endY = canvasHeight; // Only extend down if this cell is responsible for the junction
      }

      // Apply diagonal adjustments
      if (diagonalAdjustments.topRight) startY = Math.max(startY, 1);
      if (diagonalAdjustments.bottomRight)
        endY = Math.min(endY, canvasHeight - 1);

      return {
        x: canvasWidth - 1,
        y: startY,
        width: 1,
        height: Math.max(0, endY - startY),
      };
    }
    return { x: 0, y: 0, width: 0, height: 0 };
  };

  // Helper function to draw a border with calculated coordinates
  const drawBorderSegment = (
    borderSide,
    connections,
    diagonalAdjustments = {},
  ) => {
    const coords = getBorderCoordinates(
      borderSide,
      connections,
      diagonalAdjustments,
    );

    if (coords.width > 0 && coords.height > 0) {
      ctx.fillRect(coords.x, coords.y, coords.width, coords.height);
    }
  };

  // Connection state object for easy passing
  const connections = { top, left, right, bottom };

  // Helper function to determine if this cell should draw junction pixels
  const shouldDrawJunction = (junctionType) => {
    if (!cellPosition || !allCellPositions) {
      return false;
    }

    // For vertical connections: top cell extends down, bottom cell stays short
    if (junctionType === "bottom-junction") {
      // Find the cell below us
      const bottomNeighbor = allCellPositions.find(
        ({ position }) =>
          position.row === cellPosition.row + 1 &&
          position.col === cellPosition.col,
      );
      // Top cell draws the bottom junction (extends down into neighbor)
      return bottomNeighbor !== undefined;
    }

    if (junctionType === "top-junction") {
      // Bottom cell never draws into top junction (top cell handles it)
      return false;
    }

    // For horizontal connections: left cell extends right, right cell stays short
    if (junctionType === "right-junction") {
      // Find the cell to the right of us
      const rightNeighbor = allCellPositions.find(
        ({ position }) =>
          position.row === cellPosition.row &&
          position.col === cellPosition.col + 1,
      );
      // Left cell draws the right junction (extends right into neighbor)
      return rightNeighbor !== undefined;
    }

    if (junctionType === "left-junction") {
      // Right cell never draws into left junction (left cell handles it)
      return false;
    }

    return false;
  };

  // Case 1: Isolated cell (no connections) - draw all 4 borders with corner ownership
  if (connectionCount === 0) {
    const diagonalAdjustments = {
      topLeft: topLeft && !top && !left,
      topRight: topRight && !top && !right,
      bottomLeft: bottomLeft && !bottom && !left,
      bottomRight: bottomRight && !bottom && !right,
    };
    drawBorderSegment("top", connections, diagonalAdjustments);
    drawBorderSegment("right", connections, diagonalAdjustments);
    drawBorderSegment("bottom", connections, diagonalAdjustments);
    drawBorderSegment("left", connections, diagonalAdjustments);
    return "all";
  }

  // Case 2: Single connection - draw 3 borders with junction responsibility and diagonal awareness
  if (connectionCount === 1) {
    if (top) {
      const diagonalAdjustments = {
        bottomLeft: bottomLeft && !left,
        bottomRight: bottomRight && !right,
      };
      drawBorderSegment("bottom", connections, diagonalAdjustments);
      drawBorderSegment("left", connections, diagonalAdjustments);
      drawBorderSegment("right", connections, diagonalAdjustments);
      return "bottom_left_right";
    }

    if (bottom) {
      const diagonalAdjustments = {
        topLeft: topLeft && !left,
        topRight: topRight && !right,
      };
      drawBorderSegment("top", connections, diagonalAdjustments);
      drawBorderSegment("left", connections, diagonalAdjustments);
      drawBorderSegment("right", connections, diagonalAdjustments);
      return "top_left_right";
    }
    if (left) {
      const diagonalAdjustments = {
        topRight: topRight && !top,
        bottomRight: bottomRight && !bottom,
      };
      drawBorderSegment("top", connections, diagonalAdjustments);
      drawBorderSegment("bottom", connections, diagonalAdjustments);
      drawBorderSegment("right", connections, diagonalAdjustments);
      return "top_bottom_right";
    }
    if (right) {
      const diagonalAdjustments = {
        topLeft: topLeft && !top,
        bottomLeft: bottomLeft && !bottom,
      };
      drawBorderSegment("top", connections, diagonalAdjustments);
      drawBorderSegment("bottom", connections, diagonalAdjustments);
      drawBorderSegment("left", connections, diagonalAdjustments);
      return "top_bottom_left";
    }
  }

  // Case 3: Two connections - coordinate junction responsibility
  if (connectionCount === 2) {
    if (top && bottom) {
      // Vertical tunnel - manual coordination to avoid overlaps and gaps
      const hasNeighborBelow = allCellPositions.some(
        ({ position }) =>
          position.row === cellPosition.row + 1 &&
          position.col === cellPosition.col,
      );

      // Left border - coordinate with vertical neighbors
      const leftX = 0;
      const leftStartY = 1; // Start below top corner to avoid overlap with top neighbor's bottom border
      const leftEndY = hasNeighborBelow ? canvasHeight : canvasHeight - 1; // Top cell extends down, bottom cell stops short
      ctx.fillRect(leftX, leftStartY, 1, leftEndY - leftStartY);

      // Right border - coordinate with vertical neighbors
      const rightX = canvasWidth - 1;
      const rightStartY = 1; // Start below top corner to avoid overlap with top neighbor's bottom border
      const rightEndY = hasNeighborBelow ? canvasHeight : canvasHeight - 1; // Top cell extends down, bottom cell stops short
      ctx.fillRect(rightX, rightStartY, 1, rightEndY - rightStartY);

      return "left_right";
    }

    if (left && right) {
      // Horizontal tunnel - coordinate junction responsibility for seamless borders
      // Top border (coordinate with neighbors for seamless connection)
      const topY = 0;
      let topStartX = TABLE_BORDER_WIDTH; // Avoid left connection area by default
      let topEndX = canvasWidth - TABLE_BORDER_WIDTH; // Avoid right connection area by default
      // Extend top border into junction areas if we're responsible
      if (shouldDrawJunction("left-junction")) {
        topStartX = 0; // Draw into left junction
      }
      if (shouldDrawJunction("right-junction")) {
        topEndX = canvasWidth; // Draw into right junction
      }
      ctx.fillRect(topStartX, topY, topEndX - topStartX, 1);

      // Bottom border (coordinate with neighbors for seamless connection)
      const bottomY = canvasHeight - 1;
      let bottomStartX = TABLE_BORDER_WIDTH; // Avoid left connection area by default
      let bottomEndX = canvasWidth - TABLE_BORDER_WIDTH; // Avoid right connection area by default
      // Extend bottom border into junction areas if we're responsible
      if (shouldDrawJunction("left-junction")) {
        bottomStartX = 0; // Draw into left junction
      }
      if (shouldDrawJunction("right-junction")) {
        bottomEndX = canvasWidth; // Draw into right junction
      }
      ctx.fillRect(bottomStartX, bottomY, bottomEndX - bottomStartX, 1);

      return "top_bottom";
    }

    if (top && left) {
      // Bottom-right corner - only draw non-connected borders
      // Bottom border (only this cell draws the bottom edge)
      const bottomY = canvasHeight - 1;
      const bottomStartX = 0; // Start from left edge
      const bottomEndX = right ? canvasWidth - 1 : canvasWidth; // Avoid right neighbor
      ctx.fillRect(bottomStartX, bottomY, bottomEndX - bottomStartX, 1);

      // Right border (only this cell draws the right edge)
      const rightX = canvasWidth - 1;
      const rightStartY = TABLE_BORDER_WIDTH; // Start below top connection area
      const rightEndY = canvasHeight - 1; // Stop at bottom corner (owned by bottom border)
      ctx.fillRect(rightX, rightStartY, 1, rightEndY - rightStartY);

      return "bottom_right";
    }

    if (top && right) {
      // Bottom-left corner - only draw non-connected borders
      // Bottom border (only this cell draws the bottom edge)
      const bottomY = canvasHeight - 1;
      const bottomStartX = left ? 1 : 0; // Avoid left neighbor
      const bottomEndX = canvasWidth - 1;
      ctx.fillRect(bottomStartX, bottomY, bottomEndX - bottomStartX, 1);

      // Left border (only this cell draws the left edge)
      const leftX = 0;
      const leftStartY = 1;
      const leftEndY = canvasHeight - 1; // Stop at bottom corner (owned by bottom border)
      ctx.fillRect(leftX, leftStartY, 1, leftEndY - leftStartY);

      return "bottom_left";
    }

    if (bottom && left) {
      // Top-right corner - only draw non-connected borders
      // Top border (only this cell draws the top edge)
      const topY = 0;
      const topStartX = 1; // Start from left edge
      const topEndX = right ? canvasWidth - 1 : canvasWidth; // Avoid right neighbor
      ctx.fillRect(topStartX, topY, topEndX - topStartX, 1);

      // Right border (only this cell draws the right edge)
      const rightX = canvasWidth - 1;
      const rightStartY = 1; // Start below top corner (owned by top border)
      const rightEndY = canvasHeight;
      ctx.fillRect(rightX, rightStartY, 1, rightEndY - rightStartY);

      return "top_right";
    }

    if (bottom && right) {
      // Top-left corner - only draw non-connected borders
      // Top border (only this cell draws the top edge)
      const topY = 0;
      const topStartX = left ? 1 : 0; // Avoid left neighbor
      const topEndX = canvasWidth - 1; // Extend to right edge
      ctx.fillRect(topStartX, topY, topEndX - topStartX, 1);

      // Left border (only this cell draws the left edge)
      const leftX = 0;
      const leftStartY = 1; // Start below top corner (owned by top border)
      const leftEndY = canvasHeight; // Stop above bottom connection area
      ctx.fillRect(leftX, leftStartY, 1, leftEndY - leftStartY);

      return "top_left";
    }
  }

  // Case 4: Three connections - draw single border with junction responsibility
  if (connectionCount === 3) {
    if (!top) {
      // Top border only (avoid neighbor junction areas)
      const topY = 0;
      const topStartX = left ? 1 : 0; // Avoid left neighbor's junction
      const topEndX = right ? canvasWidth - 1 : canvasWidth; // Avoid right neighbor's junction
      ctx.fillRect(topStartX, topY, topEndX - topStartX, 1);
      return "top";
    }

    if (!bottom) {
      // Bottom border only (avoid neighbor junction areas)
      const bottomY = canvasHeight - 1;
      const bottomStartX = left ? 1 : 0; // Avoid left neighbor's junction
      const bottomEndX = right ? canvasWidth - 1 : canvasWidth; // Avoid right neighbor's junction
      ctx.fillRect(bottomStartX, bottomY, bottomEndX - bottomStartX, 1);
      return "bottom";
    }

    if (!left) {
      // Left border only (avoid neighbor junction areas)
      const leftX = 0;
      const leftStartY = top ? 1 : 0; // Avoid top neighbor's junction
      const leftEndY = canvasHeight;
      ctx.fillRect(leftX, leftStartY, 1, leftEndY - leftStartY);
      return "left";
    }

    if (!right) {
      // Right border only (avoid neighbor junction areas)
      const rightX = canvasWidth - 1;
      const rightStartY = top ? 1 : 0; // Avoid top neighbor's junction
      const rightEndY = canvasHeight;
      ctx.fillRect(rightX, rightStartY, 1, rightEndY - rightStartY);
      return "right";
    }
  }

  // Case 5: Four connections - no borders
  return "none";
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

    // Get cell dimensions for canvas sizing
    const cellRect = cell.getBoundingClientRect();
    const canvasElement = createSelectionBorderCanvas(
      color,
      opacity,
      neighborInfo,
      cellRect,
      { row: position.row, col: position.col },
      cellPositions,
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

    const cellRect = rowHeaderCell.getBoundingClientRect();
    const canvasElement = createSelectionBorderCanvas(
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

    const cellRect = columnHeaderCell.getBoundingClientRect();
    const canvasElement = createSelectionBorderCanvas(
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

// Legacy component for backward compatibility - now just uses the hook
export const TableSelectionBorders = ({ tableRef, ...options }) => {
  useTableSelectionBorders(tableRef, options);
  return null;
};
