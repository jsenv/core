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

export const TableSelectionBorders = ({ tableRef, color, opacity }) => {
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
      { color, opacity },
    );
  }, [selectionData, color, opacity]);

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

      // Base coordinates from getBoundingClientRect (relative to table)
      let left = cellRect.left - tableRect.left;
      let top = cellRect.top - tableRect.top;
      let right = left + cellRect.width;
      let bottom = top + cellRect.height;

      // COORDINATE FAKING: Allow cells to "steal" border space they don't own
      // This ensures seamless selection areas without gaps

      // Horizontal border stealing: cells can extend left if they don't own the left border
      if (columnIndex > 0) {
        // This cell doesn't own its left border (only first column does)
        // Allow it to extend 1px left to "steal" the border from the left cell
        left -= 1;
      }

      // Vertical border stealing: cells can extend up if they don't own the top border
      if (rowIndex > 0) {
        // This cell doesn't own its top border (only first row does)
        // Allow it to extend 1px up to "steal" the border from the top cell
        top -= 1;
      }

      return {
        element: cell,
        row: rowIndex,
        column: columnIndex,
        left,
        top,
        width: right - left, // Recalculate width after coordinate adjustment
        height: bottom - top, // Recalculate height after coordinate adjustment
        right,
        bottom,
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
const drawSelectionBorders = (
  canvas,
  selectedCells,
  tableRect,
  { color = "#0078d4", opacity = 1 } = {},
) => {
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
  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;
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
   * SEAMLESS BORDER COORDINATION:
   * ============================
   *
   * When multiple cells are selected, they form a contiguous selection area that needs
   * a seamless 1px perimeter border. We use a two-step approach:
   *
   * 1. COORDINATE FAKING: During coordinate computation, cells "steal" border space
   *    they don't own by extending their coordinates. This ensures seamless coverage
   *    without gaps caused by CSS border ownership differences.
   *
   * 2. SHARED SPACE RESPONSIBILITY: During border drawing, only one cell draws in
   *    each shared pixel to prevent overlaps:
   *    • Horizontal shared spaces: LEFT cell is responsible
   *    • Vertical shared spaces: TOP cell is responsible
   *    • Corner ownership: Top/bottom borders own corners (full width)
   */

  // Draw top border with shared space responsibility
  const drawTopBorder = (cell, connections, diagonalConnections = {}) => {
    const { left, top, right } = cell;
    const { left: hasLeft, right: hasRight } = connections;

    let startX = left;
    let endX = right;

    // Shared space responsibility: only the LEFT cell draws in horizontal shared spaces
    if (hasLeft) {
      // This cell has a left neighbor, so the left cell should draw the shared space
      // This cell starts after the shared pixel
      startX = left + 1;
    }

    // Apply diagonal adjustments
    if (diagonalConnections.topLeft && !hasLeft)
      startX = Math.max(startX, left + 1);
    if (diagonalConnections.topRight && !hasRight)
      endX = Math.min(endX, right - 1);

    const width = Math.max(0, endX - startX);
    if (width > 0) {
      ctx.fillRect(startX, top, width, 1);
    }
  };

  // Draw bottom border with shared space responsibility
  const drawBottomBorder = (cell, connections, diagonalConnections = {}) => {
    const { left, bottom, right } = cell;
    const { left: hasLeft, right: hasRight } = connections;

    let startX = left;
    let endX = right;

    // Shared space responsibility: only the LEFT cell draws in horizontal shared spaces
    if (hasLeft) {
      // This cell has a left neighbor, so the left cell should draw the shared space
      // This cell starts after the shared pixel
      startX = left + 1;
    }

    // Apply diagonal adjustments
    if (diagonalConnections.bottomLeft && !hasLeft)
      startX = Math.max(startX, left + 1);
    if (diagonalConnections.bottomRight && !hasRight)
      endX = Math.min(endX, right - 1);

    const width = Math.max(0, endX - startX);
    if (width > 0) {
      ctx.fillRect(startX, bottom - 1, width, 1);
    }
  };

  // Draw left border with shared space responsibility
  const drawLeftBorder = (cell, connections, diagonalConnections = {}) => {
    const { left, top, bottom } = cell;
    const { top: hasTop, bottom: hasBottom } = connections;

    let startY = top + 1; // Start below top corner (top border owns corners)
    let endY = bottom - 1; // Stop above bottom corner (bottom border owns corners)

    // Shared space responsibility: only the TOP cell draws in vertical shared spaces
    if (hasTop) {
      // This cell has a top neighbor, so the top cell should draw the shared space
      // This cell starts after the shared pixel
      startY = top + 1;
    }

    // Apply diagonal adjustments
    if (diagonalConnections.topLeft && !hasTop)
      startY = Math.max(startY, top + 1);
    if (diagonalConnections.bottomLeft && !hasBottom)
      endY = Math.min(endY, bottom - 1);

    const height = Math.max(0, endY - startY);
    if (height > 0) {
      ctx.fillRect(left, startY, 1, height);
    }
  };

  // Draw right border with shared space responsibility
  const drawRightBorder = (cell, connections, diagonalConnections = {}) => {
    const { right, top, bottom } = cell;
    const { top: hasTop, bottom: hasBottom } = connections;

    let startY = top + 1; // Start below top corner (top border owns corners)
    let endY = bottom - 1; // Stop above bottom corner (bottom border owns corners)

    // Shared space responsibility: only the TOP cell draws in vertical shared spaces
    if (hasTop) {
      // This cell has a top neighbor, so the top cell should draw the shared space
      // This cell starts after the shared pixel
      startY = top + 1;
    }

    // Apply diagonal adjustments
    if (diagonalConnections.topRight && !hasTop)
      startY = Math.max(startY, top + 1);
    if (diagonalConnections.bottomRight && !hasBottom)
      endY = Math.min(endY, bottom - 1);

    const height = Math.max(0, endY - startY);
    if (height > 0) {
      ctx.fillRect(right - 1, startY, 1, height);
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
      drawTopBorder(cell, connections, diagonalAdjustments);
      drawRightBorder(cell, connections, diagonalAdjustments);
      drawBottomBorder(cell, connections, diagonalAdjustments);
      drawLeftBorder(cell, connections, diagonalAdjustments);
      return;
    }

    // Case 2: Single connection - draw 3 borders with junction responsibility
    if (connectionCount === 1) {
      if (top) {
        const diagonalAdjustments = {
          bottomLeft,
          bottomRight,
        };
        drawBottomBorder(cell, connections, diagonalAdjustments);
        drawLeftBorder(cell, connections, diagonalAdjustments);
        drawRightBorder(cell, connections, diagonalAdjustments);
        return;
      }
      if (bottom) {
        const diagonalAdjustments = {
          topLeft,
          topRight,
        };
        drawTopBorder(cell, connections, diagonalAdjustments);
        drawLeftBorder(cell, connections, diagonalAdjustments);
        drawRightBorder(cell, connections, diagonalAdjustments);
        return;
      }
      if (left) {
        const diagonalAdjustments = {
          topRight,
          bottomRight,
        };
        drawTopBorder(cell, connections, diagonalAdjustments);
        drawBottomBorder(cell, connections, diagonalAdjustments);
        drawRightBorder(cell, connections, diagonalAdjustments);
        return;
      }
      if (right) {
        const diagonalAdjustments = {
          topLeft,
          bottomLeft,
        };
        drawTopBorder(cell, connections, diagonalAdjustments);
        drawBottomBorder(cell, connections, diagonalAdjustments);
        drawLeftBorder(cell, connections, diagonalAdjustments);
      }
      return;
    }

    // Case 3: Two connections - coordinate junction responsibility
    if (connectionCount === 2) {
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
        return;
      }
      if (left && right) {
        // Horizontal tunnel - draw top and bottom borders
        drawTopBorder(cell, connections);
        drawBottomBorder(cell, connections);
        return;
      }
      if (top && left) {
        // Connected to top and left - draw bottom and right borders
        const diagonalAdjustments = {
          bottomRight,
        };
        drawBottomBorder(cell, connections, diagonalAdjustments);
        drawRightBorder(cell, connections, diagonalAdjustments);
        return;
      }
      if (top && right) {
        // Connected to top and right - draw bottom and left borders
        const diagonalAdjustments = {
          bottomLeft,
        };
        drawBottomBorder(cell, connections, diagonalAdjustments);
        drawLeftBorder(cell, connections, diagonalAdjustments);
        return;
      }
      if (bottom && left) {
        // Connected to bottom and left - draw top and right borders
        const diagonalAdjustments = {
          topRight,
        };
        drawTopBorder(cell, connections, diagonalAdjustments);
        drawRightBorder(cell, connections, diagonalAdjustments);
        return;
      }
      if (bottom && right) {
        // Connected to bottom and right - draw top and left borders
        const diagonalAdjustments = {
          topLeft,
        };
        drawTopBorder(cell, connections, diagonalAdjustments);
        drawLeftBorder(cell, connections, diagonalAdjustments);
      }
      return;
    }

    // Case 4: Three connections - draw single border with junction responsibility
    if (connectionCount === 3) {
      if (!top) {
        drawTopBorder(cell, connections);
        return;
      }
      if (!bottom) {
        drawBottomBorder(cell, connections);
        return;
      }
      if (!left) {
        drawLeftBorder(cell, connections);
        return;
      }
      if (!right) {
        drawRightBorder(cell, connections);
      }
      return;
    }

    // Case 5: Four connections - no borders needed
  });
};
