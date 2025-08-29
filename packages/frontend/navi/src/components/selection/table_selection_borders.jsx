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
  segments, // Keep for now for compatibility, but we'll use borderPattern instead
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

// Draw borders and return the pattern name
function drawBorder(
  ctx,
  canvasWidth,
  canvasHeight,
  neighborInfo,
  cellPosition,
  allCellPositions,
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
  const connectionCount = [top, left, right, bottom].filter(Boolean).length;

  // Helper function to determine if this cell should draw junction pixels
  const shouldDrawJunction = (junctionType) => {
    if (!cellPosition || !allCellPositions) return false;

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
    // For isolated cells, check for diagonal neighbors to shorten borders
    const hasTopLeftDiagonal = topLeft && !top && !left;
    const hasTopRightDiagonal = topRight && !top && !right;
    const hasBottomLeftDiagonal = bottomLeft && !bottom && !left;
    const hasBottomRightDiagonal = bottomRight && !bottom && !right;

    // Top border - owns top corners, adjust for diagonal neighbors
    const topStartX = hasTopLeftDiagonal ? 1 : 0;
    const topEndX = hasTopRightDiagonal ? canvasWidth - 1 : canvasWidth;
    if (topEndX > topStartX) {
      ctx.fillRect(topStartX, 0, topEndX - topStartX, 1);
    }

    // Right border - avoid top/bottom corners (owned by top/bottom borders), adjust for diagonal neighbors
    const rightStartY = 1; // Always start below top corner
    const rightEndY = canvasHeight - 1;
    if (rightEndY > rightStartY) {
      ctx.fillRect(canvasWidth - 1, rightStartY, 1, rightEndY - rightStartY);
    }

    // Bottom border - owns bottom corners, adjust for diagonal neighbors
    const bottomStartX = hasBottomLeftDiagonal ? 1 : 0;
    const bottomEndX = hasBottomRightDiagonal ? canvasWidth - 1 : canvasWidth;
    if (bottomEndX > bottomStartX) {
      ctx.fillRect(
        bottomStartX,
        canvasHeight - 1,
        bottomEndX - bottomStartX,
        1,
      );
    }

    // Left border - avoid top/bottom corners (owned by top/bottom borders), adjust for diagonal neighbors
    const leftStartY = 1; // Always start below top corner
    const leftEndY = canvasHeight - 1; // Always stop above bottom corner
    if (leftEndY > leftStartY) {
      ctx.fillRect(0, leftStartY, 1, leftEndY - leftStartY);
    }

    return "all";
  }

  // Case 2: Single connection - draw 3 borders with junction responsibility and diagonal awareness
  if (connectionCount === 1) {
    if (top) {
      // Connected from top - draw bottom, left, right borders
      // Check for diagonal neighbors that affect border drawing
      const hasBottomLeftDiagonal = bottomLeft && !left;
      const hasBottomRightDiagonal = bottomRight && !right;

      // Bottom border (only this cell draws the bottom edge to avoid duplication)
      const bottomY = canvasHeight - 1;
      let bottomStartX = left ? 1 : 0; // Avoid left neighbor's responsibility
      let bottomEndX = right ? canvasWidth - 1 : canvasWidth; // Avoid right neighbor's responsibility
      if (hasBottomLeftDiagonal) {
        bottomStartX = Math.max(bottomStartX, 1);
      }
      if (hasBottomRightDiagonal) {
        bottomEndX = Math.min(bottomEndX, canvasWidth - 1);
      }
      if (bottomEndX > bottomStartX) {
        ctx.fillRect(bottomStartX, bottomY, bottomEndX - bottomStartX, 1);
      }

      // Right border (only this cell draws the right edge to avoid duplication)
      const rightX = canvasWidth - 1;
      const rightStartY = 0;
      let rightEndY = canvasHeight - 1; // Always stop above bottom corner (owned by bottom border)
      if (hasBottomRightDiagonal) {
        rightEndY = canvasHeight - 1; // Stop before diagonal junction
      }
      if (rightEndY > rightStartY) {
        ctx.fillRect(rightX, rightStartY, 1, rightEndY - rightStartY);
      }

      // Left border (coordinate with neighbor above for seamless connection)
      const leftX = 0;
      const leftStartY = 1; // Start below the connection point
      let leftEndY = canvasHeight - 1; // Stop above bottom border
      const leftStartYFinal = leftStartY; // Bottom cell never extends up into junction (top cell handles it)
      if (hasBottomLeftDiagonal) {
        leftEndY = canvasHeight - 1; // Stop before diagonal junction
      }
      if (leftEndY > leftStartYFinal) {
        ctx.fillRect(leftX, leftStartYFinal, 1, leftEndY - leftStartYFinal);
      }

      return "bottom_left_right";
    }

    if (bottom) {
      // Connected from bottom - draw top, left, right borders
      // Check for diagonal neighbors that affect border drawing
      const hasTopLeftDiagonal = topLeft && !left;
      const hasTopRightDiagonal = topRight && !right;

      // Top border (only this cell draws the top edge to avoid duplication)
      const topY = 0;
      let topStartX = left ? 1 : 0; // Avoid left neighbor's responsibility
      let topEndX = right ? canvasWidth - 1 : canvasWidth; // Avoid right neighbor's responsibility
      if (hasTopLeftDiagonal) {
        topStartX = Math.max(topStartX, 1);
      }
      if (hasTopRightDiagonal) {
        topEndX = Math.min(topEndX, canvasWidth - 1);
      }
      if (topEndX > topStartX) {
        ctx.fillRect(topStartX, topY, topEndX - topStartX, 1);
      }

      // Right border (coordinate with neighbor below for seamless connection)
      const rightX = canvasWidth - 1;
      let rightStartY = 1; // Start below top corner (owned by top border)
      const rightEndY = canvasHeight;
      if (hasTopRightDiagonal) {
        rightStartY = Math.max(rightStartY, 1); // Start after diagonal junction
      }
      if (rightEndY > rightStartY) {
        ctx.fillRect(rightX, rightStartY, 1, rightEndY - rightStartY);
      }

      // Left border (coordinate with neighbor below for seamless connection)
      const leftX = 0;
      let leftStartY = 1; // Always start below top corner (owned by top border)
      const leftEndY = canvasHeight; // Always stop above bottom corner (owned by bottom border)
      if (hasTopLeftDiagonal) {
        leftStartY = Math.max(leftStartY, 1); // Start after diagonal junction
      }
      if (leftEndY > leftStartY) {
        ctx.fillRect(leftX, leftStartY, 1, leftEndY - leftStartY);
      }

      return "top_left_right";
    }

    if (left) {
      // Connected from left - draw top, bottom, right borders
      // Check for diagonal neighbors that affect border drawing
      const hasTopRightDiagonal = topRight && !top;
      const hasBottomRightDiagonal = bottomRight && !bottom;

      // Top border (only this cell draws the top edge to avoid duplication)
      const topY = 0;
      const topStartX = 1;
      let topEndX = right ? canvasWidth - 1 : canvasWidth; // Avoid right neighbor's responsibility
      if (hasTopRightDiagonal) {
        topEndX = Math.min(topEndX, canvasWidth - 1);
      }
      if (topEndX > topStartX) {
        ctx.fillRect(topStartX, topY, topEndX - topStartX, 1);
      }

      // Bottom border (only this cell draws the bottom edge to avoid duplication)
      const bottomY = canvasHeight - 1;
      const bottomStartX = 1;
      let bottomEndX = right ? canvasWidth - 1 : canvasWidth; // Avoid right neighbor's responsibility
      if (hasBottomRightDiagonal) {
        bottomEndX = Math.min(bottomEndX, canvasWidth - 1);
      }
      if (bottomEndX > bottomStartX) {
        ctx.fillRect(bottomStartX, bottomY, bottomEndX - bottomStartX, 1);
      }

      // Right border (only this cell draws the right edge to avoid duplication)
      const rightX = canvasWidth - 1;
      let rightStartY = 1; // Always start below top corner (owned by top border)
      let rightEndY = canvasHeight - 1; // Always stop above bottom corner (owned by bottom border)
      if (hasTopRightDiagonal) {
        rightStartY = Math.max(rightStartY, 1);
      }
      if (hasBottomRightDiagonal) {
        rightEndY = Math.min(rightEndY, canvasHeight - 1);
      }
      if (rightEndY > rightStartY) {
        ctx.fillRect(rightX, rightStartY, 1, rightEndY - rightStartY);
      }

      return "top_bottom_right";
    }

    if (right) {
      // Connected from right - draw top, bottom, left borders
      // Check for diagonal neighbors that affect border drawing
      const hasTopLeftDiagonal = topLeft && !top;
      const hasBottomLeftDiagonal = bottomLeft && !bottom;

      // Top border (extend to right edge since we're connected on the right)
      const topY = 0;
      let topStartX = left ? 1 : 0; // Avoid left neighbor's responsibility
      const topEndX = canvasWidth;
      if (hasTopLeftDiagonal) {
        topStartX = Math.max(topStartX, 1);
      }
      if (topEndX > topStartX) {
        ctx.fillRect(topStartX, topY, topEndX - topStartX, 1);
      }

      // Bottom border (extend to right edge since we're connected on the right)
      const bottomY = canvasHeight - 1;
      let bottomStartX = left ? 1 : 0; // Avoid left neighbor's responsibility
      const bottomEndX = canvasWidth; // Always extend to right edge since we're connected on the right
      if (hasBottomLeftDiagonal) {
        bottomStartX = Math.max(bottomStartX, 1);
      }
      if (bottomEndX > bottomStartX) {
        ctx.fillRect(bottomStartX, bottomY, bottomEndX - bottomStartX, 1);
      }

      // Left border (only this cell draws the left edge to avoid duplication)
      const leftX = 0;
      let leftStartY = 1; // Always start below top corner (owned by top border)
      let leftEndY = canvasHeight - 1; // Always stop above bottom corner (owned by bottom border)
      if (hasTopLeftDiagonal) {
        leftStartY = Math.max(leftStartY, 1);
      }
      if (hasBottomLeftDiagonal) {
        leftEndY = Math.min(leftEndY, canvasHeight - 1);
      }
      if (leftEndY > leftStartY) {
        ctx.fillRect(leftX, leftStartY, 1, leftEndY - leftStartY);
      }

      return "top_bottom_left";
    }
  }

  // Case 3: Two connections - coordinate junction responsibility
  if (connectionCount === 2) {
    if (top && bottom) {
      // Vertical tunnel - junction coordination for seamless borders
      const hasNeighborBelow = allCellPositions.some(
        ({ position }) =>
          position.row === cellPosition.row + 1 &&
          position.col === cellPosition.col,
      );

      // Right border
      const rightX = canvasWidth - 1;
      const rightStartY = 1; // Start below top connection area
      const rightEndY = hasNeighborBelow ? canvasHeight : canvasHeight - 1; // Top cell extends into junction, bottom cell stops short
      ctx.fillRect(rightX, rightStartY, 1, rightEndY - rightStartY);

      // Left border - this is the key fix!
      const leftX = 0;
      const leftStartY = 0; // ALWAYS start at Y=0 since there's no top border in vertical tunnels
      const leftEndY = hasNeighborBelow ? canvasHeight : canvasHeight - 1; // Top cell extends into junction, bottom cell stops short
      ctx.fillRect(leftX, leftStartY, 1, leftEndY - leftStartY);

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

    // Junction ownership rules to prevent multi-cell overlaps:
    // - Each cell only draws corners where it has the "ownership" based on position priority
    // - Priority: top-most cell owns top corners, left-most cell owns left corners

    // Helper function to check if this cell should own a corner based on position priority
    const shouldOwnCorner = (cornerRow, cornerCol) => {
      // Find all selected cells that could potentially draw this corner
      const competingCells = cellPositions.filter(
        ({ position: pos, cell: c }) => {
          const rSpan = parseInt(c.getAttribute("rowspan") || "1", 10);
          const cSpan = parseInt(c.getAttribute("colspan") || "1", 10);

          // Check if this cell's bounds include the corner position
          const cellTouchesCorner =
            (pos.row === cornerRow || pos.row + rSpan === cornerRow) &&
            (pos.col === cornerCol || pos.col + cSpan === cornerCol);

          return cellTouchesCorner;
        },
      );

      // If no competition, this cell can draw the corner
      if (competingCells.length <= 1) {
        return true;
      }

      // For diagonal connections (cells meeting only at corners), use strict priority
      // to ensure only one cell draws the shared corner point
      const currentCell = { row: position.row, col: position.col };

      // Check if this is a pure diagonal connection (no direct adjacency)
      const isDiagonalConnection = competingCells.some(({ position: pos }) => {
        return (
          pos.row !== currentCell.row &&
          pos.col !== currentCell.col &&
          Math.abs(pos.row - currentCell.row) === 1 &&
          Math.abs(pos.col - currentCell.col) === 1
        );
      });

      if (isDiagonalConnection) {
        // For diagonal connections, use a more aggressive priority system
        // to prevent any overlap: top-left cell always wins
        return competingCells.every(({ position: pos }) => {
          return (
            currentCell.row < pos.row ||
            (currentCell.row === pos.row && currentCell.col < pos.col)
          );
        });
      }

      // For adjacent connections, use standard priority
      return competingCells.every(({ position: pos }) => {
        // Current cell has higher priority if it's above
        if (currentCell.row < pos.row) return true;
        if (currentCell.row > pos.row) return false;

        // Same row - left-most wins
        if (currentCell.col < pos.col) return true;
        if (currentCell.col > pos.col) return false;

        // Same position (shouldn't happen, but handle it)
        return true;
      });
    };

    // Top-left corner: draw if no top AND no left neighbors AND we own this corner
    if (!top && !left && shouldOwnCorner(position.row, position.col)) {
      segments.push("top-left-corner");
    }

    // Top edge: draw if no top neighbor
    if (!top) {
      segments.push("top-edge");
    }

    // Top-right corner: draw if no top AND no right neighbors AND we own this corner
    if (
      !top &&
      !right &&
      shouldOwnCorner(position.row, position.col + colSpan)
    ) {
      segments.push("top-right-corner");
    }

    // Right edge: draw if no right neighbor
    if (!right) {
      segments.push("right-edge");
    }

    // Bottom-right corner: draw if no bottom AND no right neighbors AND we own this corner
    if (
      !bottom &&
      !right &&
      shouldOwnCorner(position.row + rowSpan, position.col + colSpan)
    ) {
      segments.push("bottom-right-corner");
    }

    // Bottom edge: draw if no bottom neighbor
    if (!bottom) {
      segments.push("bottom-edge");
    }

    // Bottom-left corner: draw if no bottom AND no left neighbors AND we own this corner
    if (
      !bottom &&
      !left &&
      shouldOwnCorner(position.row + rowSpan, position.col)
    ) {
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
