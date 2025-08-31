import { useLayoutEffect, useRef, useState } from "preact/hooks";

import.meta.css = /* css */ `
  .table_selection_overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .table_selection_overlay canvas {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  /* Hide borders during drag selection */
  table[data-drag-selecting] + .table_selection_overlay {
    display: none;
  }
`;

export const TableSelectionBorders = ({ tableRef }) => {
  const [selectionData, setSelectionData] = useState(null);
  const canvasRef = useRef(null);

  useLayoutEffect(() => {
    const tableSelectionObserver = createTableSelectionObserver(
      tableRef.current,
    );
    setSelectionData(tableSelectionObserver.selectionData);
    tableSelectionObserver.onChange = () => {
      setSelectionData(tableSelectionObserver.selectionData);
    };
    return tableSelectionObserver.cleanup;
  }, [tableRef]);

  // Draw the selection borders on canvas whenever selection data changes
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectionData || selectionData.selectedCells.length === 0) {
      if (canvas) {
        // Clear canvas if no selection
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    drawSelectionBorders(
      canvas,
      selectionData.selectedCells,
      selectionData.tableRect,
    );
  }, [selectionData]);

  return (
    <div className="table_selection_overlay">
      <canvas ref={canvasRef} />
    </div>
  );
};

const NO_SELECTION = { selectedCells: [], tableRect: null };
const createTableSelectionObserver = (table) => {
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cb of cleanupCallbackSet) {
      cb();
    }
  };
  const tableSelection = {
    selectionData: undefined,
    onChange: () => {},
    cleanup,
  };

  const updateSelectionData = (newData) => {
    if (newData === tableSelection.selectionData) {
      return;
    }
    tableSelection.selectionData = newData;
    tableSelection.onChange();
  };

  if (!table) {
    updateSelectionData(NO_SELECTION);
    return tableSelection;
  }

  const calculateSelectionData = () => {
    // Don't update during drag selection - wait for drag to complete
    if (table.hasAttribute("data-drag-selecting")) {
      return;
    }

    // Find all selected cells by aria-selected attribute
    const selectedCells = table.querySelectorAll(
      'td[aria-selected="true"], th[aria-selected="true"]',
    );

    if (selectedCells.length === 0) {
      updateSelectionData(NO_SELECTION);
      return;
    }

    const tableRect = table.getBoundingClientRect();

    // Get cell information for each selected cell
    const cellInfos = Array.from(selectedCells).map((cell) => {
      const cellRect = cell.getBoundingClientRect();
      const row = cell.closest("tr");

      // Calculate row index relative to the entire table (not just thead/tbody)
      const allRows = Array.from(table.querySelectorAll("tr"));
      const rowIndex = allRows.indexOf(row);
      const columnIndex = Array.from(row.children).indexOf(cell);

      return {
        element: cell,
        row: rowIndex,
        column: columnIndex,
        left: cellRect.left - tableRect.left,
        top: cellRect.top - tableRect.top,
        width: cellRect.width,
        height: cellRect.height,
        right: cellRect.left - tableRect.left + cellRect.width,
        bottom: cellRect.top - tableRect.top + cellRect.height,
      };
    });

    updateSelectionData({
      selectedCells: cellInfos,
      tableRect: {
        left: tableRect.left,
        top: tableRect.top,
        width: tableRect.width,
        height: tableRect.height,
      },
    });
  };

  calculateSelectionData();

  update_on_selection_change: {
    // Set up MutationObserver to watch for aria-selected and drag state changes
    const mutationObserver = new MutationObserver(() => {
      calculateSelectionData();
    });
    // Observe the table for aria-selected and drag state attribute changes
    mutationObserver.observe(table, {
      attributes: true,
      attributeFilter: ["aria-selected", "data-drag-selecting"],
      subtree: true,
      characterData: true,
    });
    cleanupCallbackSet.add(() => mutationObserver.disconnect());
  }

  update_on_table_resize: {
    // Set up ResizeObserver to watch for table dimension changes
    const resizeObserver = new ResizeObserver(() => {
      calculateSelectionData();
    });
    // Observe the table for size changes
    resizeObserver.observe(table);
    cleanupCallbackSet.add(() => resizeObserver.disconnect());
  }

  update_on_window_resize: {
    // Also listen for window resize events for additional coverage
    const handleWindowResize = () => {
      calculateSelectionData();
    };
    window.addEventListener("resize", handleWindowResize);
    cleanupCallbackSet.add(() =>
      window.removeEventListener("resize", handleWindowResize),
    );
  }

  return tableSelection;
};

// Draw selection borders on canvas using filled rectangles with sophisticated border coordination
const drawSelectionBorders = (canvas, selectedCells, tableRect) => {
  const ctx = canvas.getContext("2d");
  const devicePixelRatio = window.devicePixelRatio || 1;

  // Use table dimensions as logical canvas size (not affected by zoom)
  const displayWidth = tableRect.width;
  const displayHeight = tableRect.height;

  // Set actual canvas size for high-DPI displays
  canvas.width = displayWidth * devicePixelRatio;
  canvas.height = displayHeight * devicePixelRatio;

  // Set CSS size to logical dimensions
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;

  // Scale context for high-DPI
  ctx.scale(devicePixelRatio, devicePixelRatio);

  // Clear canvas
  ctx.clearRect(0, 0, displayWidth, displayHeight);

  // Set up drawing context
  ctx.fillStyle = "#0078d4";
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = false;

  // Create a grid to track selected cells
  const grid = new Map();
  selectedCells.forEach((cell) => {
    const key = `${cell.column},${cell.row}`;
    grid.set(key, cell);
  });

  // Helper function to check if a cell is selected
  const isCellSelected = (col, row) => {
    return grid.has(`${col},${row}`);
  };

  /**
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
   */

  // Helper function to determine if this cell should extend into a junction
  const shouldExtendIntoJunction = (cell, direction) => {
    const { row, column } = cell;

    if (direction === "right") {
      // Left cell extends right into horizontal junction
      return isCellSelected(column + 1, row);
    }
    if (direction === "down") {
      // Top cell extends down into vertical junction
      return isCellSelected(column, row + 1);
    }
    return false;
  };

  // Calculate border coordinates with junction responsibility
  const getBorderCoordinates = (
    cell,
    borderSide,
    connections,
    diagonalConnections = {},
  ) => {
    const { left, top, right, bottom } = cell;
    const {
      left: hasLeft,
      right: hasRight,
      top: hasTop,
      bottom: hasBottom,
    } = connections;

    if (borderSide === "top") {
      let startX = hasLeft ? left + 1 : left; // Avoid left junction if connected
      let endX;

      if (hasRight) {
        // Connected on right - extend to right edge for seamless connection
        endX = right;
      } else {
        // Not connected on right - check if we should extend into junction
        endX = shouldExtendIntoJunction(cell, "right") ? right : right;
      }

      // Apply diagonal adjustments
      if (diagonalConnections.topLeft && !hasLeft)
        startX = Math.max(startX, left + 1);
      if (diagonalConnections.topRight && !hasRight)
        endX = Math.min(endX, right - 1);

      return {
        x: startX,
        y: top,
        width: Math.max(0, endX - startX),
        height: 1,
      };
    }

    if (borderSide === "bottom") {
      let startX = hasLeft ? left + 1 : left; // Avoid left junction if connected
      let endX;

      if (hasRight) {
        // Connected on right - extend to right edge for seamless connection
        endX = right;
      } else {
        // Not connected on right - check if we should extend into junction
        endX = shouldExtendIntoJunction(cell, "right") ? right : right;
      }

      // Apply diagonal adjustments
      if (diagonalConnections.bottomLeft && !hasLeft)
        startX = Math.max(startX, left + 1);
      if (diagonalConnections.bottomRight && !hasRight)
        endX = Math.min(endX, right - 1);

      return {
        x: startX,
        y: bottom - 1,
        width: Math.max(0, endX - startX),
        height: 1,
      };
    }

    if (borderSide === "left") {
      let startY = top + 1; // Start below top corner by default (top border owns corners)
      let endY = bottom - 1; // Stop above bottom corner by default (bottom border owns corners)

      // For vertical connections, use junction responsibility to avoid overlaps
      if (hasTop && shouldExtendIntoJunction(cell, "up")) {
        startY = top; // Only extend up if this cell is responsible for the junction
      }
      if (hasBottom && shouldExtendIntoJunction(cell, "down")) {
        endY = bottom; // Only extend down if this cell is responsible for the junction
      }

      // Apply diagonal adjustments
      if (diagonalConnections.topLeft && !hasTop)
        startY = Math.max(startY, top + 1);
      if (diagonalConnections.bottomLeft && !hasBottom)
        endY = Math.min(endY, bottom - 1);

      return {
        x: left,
        y: startY,
        width: 1,
        height: Math.max(0, endY - startY),
      };
    }

    if (borderSide === "right") {
      let startY = top + 1; // Start below top corner by default (top border owns corners)
      let endY = bottom - 1; // Stop above bottom corner by default (bottom border owns corners)

      // For vertical connections, use junction responsibility to avoid overlaps
      if (hasTop && shouldExtendIntoJunction(cell, "up")) {
        startY = top; // Only extend up if this cell is responsible for the junction
      }
      if (hasBottom && shouldExtendIntoJunction(cell, "down")) {
        endY = bottom; // Only extend down if this cell is responsible for the junction
      }

      // Apply diagonal adjustments
      if (diagonalConnections.topRight && !hasTop)
        startY = Math.max(startY, top + 1);
      if (diagonalConnections.bottomRight && !hasBottom)
        endY = Math.min(endY, bottom - 1);

      return {
        x: right - 1,
        y: startY,
        width: 1,
        height: Math.max(0, endY - startY),
      };
    }

    return { x: 0, y: 0, width: 0, height: 0 };
  };

  // Helper function to draw a border with calculated coordinates
  const drawBorderSegment = (
    cell,
    borderSide,
    connections,
    diagonalConnections = {},
  ) => {
    const coords = getBorderCoordinates(
      cell,
      borderSide,
      connections,
      diagonalConnections,
    );

    if (coords.width > 0 && coords.height > 0) {
      ctx.fillRect(coords.x, coords.y, coords.width, coords.height);
    }
  };

  // Draw coordinated borders for each selected cell
  selectedCells.forEach((cell) => {
    const { row, column } = cell;

    // Check all 8 neighboring positions for border calculation
    const top = isCellSelected(column, row - 1);
    const left = isCellSelected(column - 1, row);
    const right = isCellSelected(column + 1, row);
    const bottom = isCellSelected(column, row + 1);

    // Check diagonal neighbors to prevent edge overlaps
    const topRight = isCellSelected(column + 1, row - 1);
    const bottomRight = isCellSelected(column + 1, row + 1);
    const bottomLeft = isCellSelected(column - 1, row + 1);
    const topLeft = isCellSelected(column - 1, row - 1);

    // Connection state for easy passing
    const connections = { top, left, right, bottom };

    // Calculate connection count for pattern determination
    const connectionCount = [top, left, right, bottom].filter(Boolean).length;

    // Case 1: Isolated cell (no connections) - draw all 4 borders with corner ownership
    if (connectionCount === 0) {
      const diagonalAdjustments = {
        topLeft,
        topRight,
        bottomLeft,
        bottomRight,
      };
      drawBorderSegment(cell, "top", connections, diagonalAdjustments);
      drawBorderSegment(cell, "right", connections, diagonalAdjustments);
      drawBorderSegment(cell, "bottom", connections, diagonalAdjustments);
      drawBorderSegment(cell, "left", connections, diagonalAdjustments);
    }
    // Case 2: Single connection - draw 3 borders with junction responsibility
    else if (connectionCount === 1) {
      if (top) {
        const diagonalAdjustments = {
          bottomLeft,
          bottomRight,
        };
        drawBorderSegment(cell, "bottom", connections, diagonalAdjustments);
        drawBorderSegment(cell, "left", connections, diagonalAdjustments);
        drawBorderSegment(cell, "right", connections, diagonalAdjustments);
      } else if (bottom) {
        const diagonalAdjustments = {
          topLeft,
          topRight,
        };
        drawBorderSegment(cell, "top", connections, diagonalAdjustments);
        drawBorderSegment(cell, "left", connections, diagonalAdjustments);
        drawBorderSegment(cell, "right", connections, diagonalAdjustments);
      } else if (left) {
        const diagonalAdjustments = {
          topRight,
          bottomRight,
        };
        drawBorderSegment(cell, "top", connections, diagonalAdjustments);
        drawBorderSegment(cell, "bottom", connections, diagonalAdjustments);
        drawBorderSegment(cell, "right", connections, diagonalAdjustments);
      } else if (right) {
        const diagonalAdjustments = {
          topLeft,
          bottomLeft,
        };
        drawBorderSegment(cell, "top", connections, diagonalAdjustments);
        drawBorderSegment(cell, "bottom", connections, diagonalAdjustments);
        drawBorderSegment(cell, "left", connections, diagonalAdjustments);
      }
    }
    // Case 3: Two connections - coordinate junction responsibility
    else if (connectionCount === 2) {
      if (top && bottom) {
        // Vertical tunnel - draw left and right borders with special coordination
        const hasNeighborBelow = isCellSelected(column, row + 1);

        // Left border - coordinate with vertical neighbors
        const leftStartY = top + 1; // Start below top corner
        const leftEndY = hasNeighborBelow ? bottom : bottom - 1; // Top cell extends down
        if (leftEndY > leftStartY) {
          ctx.fillRect(left, leftStartY, 1, leftEndY - leftStartY);
        }

        // Right border - coordinate with vertical neighbors
        const rightStartY = top + 1; // Start below top corner
        const rightEndY = hasNeighborBelow ? bottom : bottom - 1; // Top cell extends down
        if (rightEndY > rightStartY) {
          ctx.fillRect(right - 1, rightStartY, 1, rightEndY - rightStartY);
        }
      } else if (left && right) {
        // Horizontal tunnel - draw top and bottom borders
        drawBorderSegment(cell, "top", connections);
        drawBorderSegment(cell, "bottom", connections);
      } else if (top && left) {
        // Connected to top and left - draw bottom and right borders
        const diagonalAdjustments = {
          bottomRight,
        };
        drawBorderSegment(cell, "bottom", connections, diagonalAdjustments);
        drawBorderSegment(cell, "right", connections, diagonalAdjustments);
      } else if (top && right) {
        // Connected to top and right - draw bottom and left borders
        const diagonalAdjustments = {
          bottomLeft,
        };
        drawBorderSegment(cell, "bottom", connections, diagonalAdjustments);
        drawBorderSegment(cell, "left", connections, diagonalAdjustments);
      } else if (bottom && left) {
        // Connected to bottom and left - draw top and right borders
        const diagonalAdjustments = {
          topRight,
        };
        drawBorderSegment(cell, "top", connections, diagonalAdjustments);
        drawBorderSegment(cell, "right", connections, diagonalAdjustments);
      } else if (bottom && right) {
        // Connected to bottom and right - draw top and left borders
        const diagonalAdjustments = {
          topLeft,
        };
        drawBorderSegment(cell, "top", connections, diagonalAdjustments);
        drawBorderSegment(cell, "left", connections, diagonalAdjustments);
      }
    }
    // Case 4: Three connections - draw single border with junction responsibility
    else if (connectionCount === 3) {
      if (!top) {
        // Top border only
        const startX = left ? left + 1 : left;
        const endX = right ? right - 1 : right;
        if (endX > startX) {
          ctx.fillRect(startX, top, endX - startX, 1);
        }
      } else if (!bottom) {
        // Bottom border only
        const startX = left ? left + 1 : left;
        const endX = right ? right - 1 : right;
        if (endX > startX) {
          ctx.fillRect(startX, bottom - 1, endX - startX, 1);
        }
      } else if (!left) {
        // Left border only
        const startY = top ? top + 1 : top;
        const endY = bottom ? bottom - 1 : bottom;
        if (endY > startY) {
          ctx.fillRect(left, startY, 1, endY - startY);
        }
      } else if (!right) {
        // Right border only
        const startY = top ? top + 1 : top;
        const endY = bottom ? bottom - 1 : bottom;
        if (endY > startY) {
          ctx.fillRect(right - 1, startY, 1, endY - startY);
        }
      }
    }
    // Case 5: Four connections - no borders needed
  });
};
