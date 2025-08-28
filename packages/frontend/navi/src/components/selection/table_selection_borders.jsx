import { useLayoutEffect, useState } from "preact/hooks";

import.meta.css = /* css */ `
  /* Selection overlay container */
  .selection-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 10;
  }

  /* Individual selection rectangles */
  .selection-rectangle {
    position: absolute;
    border: 1px solid #0078d4;
    pointer-events: none;
    box-sizing: border-box;
  }

  /* Hide borders during drag selection */
  table[data-drag-selecting] + * .selection-overlay {
    display: none;
  }
`;

export const TableSelectionBorders = ({ tableRef }) => {
  const [rectangles, setRectangles] = useState([]);

  useLayoutEffect(() => {
    const tableSelectionObserver = createTableSelectionObserver(
      tableRef.current,
    );
    setRectangles(tableSelectionObserver.rectangles);
    tableSelectionObserver.onChange = () => {
      setRectangles(tableSelectionObserver.rectangles);
    };
    return tableSelectionObserver.cleanup;
  }, [tableRef]);

  return (
    <div className="selection-overlay">
      {rectangles.map((rect, index) => (
        <div
          key={index}
          className="selection-rectangle"
          style={{
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          }}
        />
      ))}
    </div>
  );
};

const NO_RECTANGLES = [];
const createTableSelectionObserver = (table) => {
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cb of cleanupCallbackSet) {
      cb();
    }
  };
  const tableSelection = {
    rectangles: undefined,
    onChange: () => {},
    cleanup,
  };

  const updateRectangles = (newRectangles) => {
    if (newRectangles === tableSelection.rectangles) {
      return;
    }
    tableSelection.rectangles = newRectangles;
    tableSelection.onChange();
  };

  if (!table) {
    updateRectangles(NO_RECTANGLES);
    return tableSelection;
  }

  const calculateRectangles = () => {
    // Don't update during drag selection - wait for drag to complete
    if (table.hasAttribute("data-drag-selecting")) {
      return;
    }

    // Find all selected cells by aria-selected attribute
    const selectedCells = table.querySelectorAll('[aria-selected="true"]');

    if (selectedCells.length === 0) {
      updateRectangles(NO_RECTANGLES);
      return;
    }

    const tableRect = table.getBoundingClientRect();

    // Calculate selection rectangles
    const cellPositions = new Map();

    // Get positions of all selected cells
    selectedCells.forEach((cell) => {
      const cellRect = cell.getBoundingClientRect();

      // Get row and column indices from DOM position
      const row = cell.closest("tr");
      const rowIndex = Array.from(row.parentNode.children).indexOf(row);
      const columnIndex = Array.from(row.children).indexOf(cell);

      const cellId = `${columnIndex}:${rowIndex}`;

      cellPositions.set(cellId, {
        left: cellRect.left - tableRect.left,
        top: cellRect.top - tableRect.top,
        width: cellRect.width,
        height: cellRect.height,
        row: rowIndex,
        column: columnIndex,
      });
    });

    // Group contiguous cells into rectangles
    const newRectangles = [];
    const processedCells = new Set();

    cellPositions.forEach((pos, cellId) => {
      if (processedCells.has(cellId)) {
        return;
      }

      // Find all contiguous cells starting from this cell
      const rectangle = findContiguousRectangle(
        cellId,
        cellPositions,
        processedCells,
        table,
      );
      if (rectangle) {
        newRectangles.push(rectangle);
      }
    });
    updateRectangles(newRectangles);
  };
  calculateRectangles();

  update_on_selection_change: {
    // Set up MutationObserver to watch for aria-selected and drag state changes
    const mutationObserver = new MutationObserver((mutations) => {
      let shouldRecalculate = false;
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          (mutation.attributeName === "aria-selected" ||
            mutation.attributeName === "data-drag-selecting")
        ) {
          shouldRecalculate = true;
        }
      });
      if (shouldRecalculate) {
        calculateRectangles();
      }
    });
    // Observe the table for aria-selected and drag state attribute changes
    mutationObserver.observe(table, {
      attributes: true,
      attributeFilter: ["aria-selected", "data-drag-selecting"],
      subtree: true,
    });
    cleanupCallbackSet.add(() => mutationObserver.disconnect());
  }

  update_on_table_resize: {
    // Set up ResizeObserver to watch for table dimension changes
    const resizeObserver = new ResizeObserver(() => {
      calculateRectangles();
    });
    // Observe the table for size changes
    resizeObserver.observe(table);
    cleanupCallbackSet.add(() => resizeObserver.disconnect());
  }

  update_on_window_resize: {
    // Also listen for window resize events for additional coverage
    const handleWindowResize = () => {
      calculateRectangles();
    };
    window.addEventListener("resize", handleWindowResize);
    cleanupCallbackSet.add(() =>
      window.removeEventListener("resize", handleWindowResize),
    );
  }

  return tableSelection;
};

// Helper function to extract table information from DOM
const getTableInfoFromDOM = (table) => {
  // Get columns from table header
  const headerCells = table.querySelectorAll("thead th");
  const columnCount = headerCells.length;

  // Get border width from a cell's computed styles (more accurate than table)
  const firstCell = table.querySelector("td") || table.querySelector("th");
  const computedStyle = window.getComputedStyle(firstCell || table);
  const borderWidth = parseFloat(computedStyle.borderWidth) || 1;
  const isBorderCollapse =
    window.getComputedStyle(table).borderCollapse === "collapse";

  // Get table data from DOM
  const dataRows = table.querySelectorAll("tbody tr");
  const rowCount = dataRows.length;

  return {
    columnCount,
    rowCount,
    borderWidth,
    isBorderCollapse,
  };
};
const findContiguousRectangle = (
  startCellId,
  cellPositions,
  processedCells,
  table,
) => {
  const startPos = cellPositions.get(startCellId);
  if (!startPos) return null;

  // Get table structure from DOM
  const tableInfo = getTableInfoFromDOM(table);

  // Build a grid map of all selected cells by their row/column coordinates
  const gridMap = new Map();
  cellPositions.forEach((pos, cellId) => {
    if (!processedCells.has(cellId)) {
      gridMap.set(cellId, { cellId, pos });
    }
  });

  // Find all connected cells using flood fill algorithm
  const connectedCells = new Set();
  const queue = [startCellId];
  connectedCells.add(startCellId);

  while (queue.length > 0) {
    const currentCellId = queue.shift();
    const currentPos = cellPositions.get(currentCellId);
    if (!currentPos) continue;

    // Check all 4 adjacent positions (up, down, left, right)
    const adjacentPositions = [
      `${currentPos.column}:${currentPos.row - 1}`, // up
      `${currentPos.column}:${currentPos.row + 1}`, // down
      `${currentPos.column - 1}:${currentPos.row}`, // left
      `${currentPos.column + 1}:${currentPos.row}`, // right
    ];

    adjacentPositions.forEach((adjKey) => {
      const adjacent = gridMap.get(adjKey);
      if (adjacent && !connectedCells.has(adjacent.cellId)) {
        connectedCells.add(adjacent.cellId);
        queue.push(adjacent.cellId);
      }
    });
  }

  // Mark all connected cells as processed
  connectedCells.forEach((cellId) => processedCells.add(cellId));

  // Calculate the bounding rectangle of all connected cells
  let minLeft = Infinity;
  let minTop = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;

  connectedCells.forEach((cellId) => {
    const pos = cellPositions.get(cellId);
    if (pos) {
      minLeft = Math.min(minLeft, pos.left);
      minTop = Math.min(minTop, pos.top);
      maxRight = Math.max(maxRight, pos.left + pos.width);
      maxBottom = Math.max(maxBottom, pos.top + pos.height);
    }
  });

  // Adjust for border collapse - we need to account for shared borders
  const borderWidth = tableInfo.borderWidth;
  const isBorderCollapse = tableInfo.isBorderCollapse;

  if (isBorderCollapse) {
    // For collapsed borders, the border is shared between adjacent cells
    // We want the selection overlay to cover the entire selected area including borders

    // Check if selection touches table edges
    const tableEdges = getTableEdges(connectedCells, cellPositions, tableInfo);

    // Extend the rectangle to include the shared borders
    // Only extend inward if we're not at the table edge
    const leftAdjust = tableEdges.left ? 0 : borderWidth / 2;
    const topAdjust = tableEdges.top ? 0 : borderWidth / 2;
    const rightAdjust = tableEdges.right ? 0 : borderWidth / 2;
    const bottomAdjust = tableEdges.bottom ? 0 : borderWidth / 2;

    const adjustedRect = {
      left: minLeft - leftAdjust,
      top: minTop - topAdjust,
      width: maxRight - minLeft + leftAdjust + rightAdjust,
      height: maxBottom - minTop + topAdjust + bottomAdjust,
    };

    return adjustedRect;
  }

  // For non-collapsed borders, use the raw rectangle
  return {
    left: minLeft,
    top: minTop,
    width: maxRight - minLeft,
    height: maxBottom - minTop,
  };
};
// Helper function to determine if selection touches table edges
const getTableEdges = (connectedCells, cellPositions, tableInfo) => {
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;

  connectedCells.forEach((cellId) => {
    const pos = cellPositions.get(cellId);
    if (pos) {
      minRow = Math.min(minRow, pos.row);
      maxRow = Math.max(maxRow, pos.row);
      minCol = Math.min(minCol, pos.column);
      maxCol = Math.max(maxCol, pos.column);
    }
  });

  // Determine table boundaries
  const tableMinRow = 0;
  const tableMaxRow = tableInfo.rowCount - 1;
  const tableMinCol = 0;
  const tableMaxCol = tableInfo.columnCount - 1;

  return {
    top: minRow <= tableMinRow,
    bottom: maxRow >= tableMaxRow,
    left: minCol <= tableMinCol,
    right: maxCol >= tableMaxCol,
  };
};
