import { useLayoutEffect, useState } from "preact/hooks";

export const TableSelectionOverlay = ({ tableRef }) => {
  const [rectangles, setRectangles] = useState([]);

  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) {
      setRectangles([]);
      return null;
    }

    // eslint-disable-next-line consistent-return
    const calculateRectangles = () => {
      // Find all selected cells by aria-selected attribute
      const selectedCells = table.querySelectorAll('[aria-selected="true"]');

      if (selectedCells.length === 0) {
        setRectangles([]);
        return null;
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

      setRectangles(newRectangles);
    };

    // Calculate rectangles initially
    calculateRectangles();

    // Set up MutationObserver to watch for aria-selected changes
    const mutationObserver = new MutationObserver((mutations) => {
      let shouldRecalculate = false;

      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "aria-selected"
        ) {
          shouldRecalculate = true;
        }
      });

      if (shouldRecalculate) {
        calculateRectangles();
      }
    });

    // Observe the table for aria-selected attribute changes
    mutationObserver.observe(table, {
      attributes: true,
      attributeFilter: ["aria-selected"],
      subtree: true,
    });

    // Set up ResizeObserver to watch for table dimension changes
    const resizeObserver = new ResizeObserver(() => {
      calculateRectangles();
    });

    // Observe the table for size changes
    resizeObserver.observe(table);

    // Also listen for window resize events for additional coverage
    const handleWindowResize = () => {
      calculateRectangles();
    };

    window.addEventListener("resize", handleWindowResize);

    // Cleanup function
    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
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

// Helper function to extract table information from DOM
const getTableInfoFromDOM = (table) => {
  // Get columns from table header
  const headerCells = table.querySelectorAll("thead th");
  const columnCount = headerCells.length;

  // Get border width from computed styles
  const computedStyle = window.getComputedStyle(table);
  const borderWidth = parseFloat(computedStyle.borderWidth) || 1;
  const isBorderCollapse = computedStyle.borderCollapse === "collapse";

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
    // Check if selection touches table edges
    const tableEdges = getTableEdges(connectedCells, cellPositions, tableInfo);

    const adjustedRect = {
      left: minLeft + (tableEdges.left ? 0 : borderWidth / 2),
      top: minTop + (tableEdges.top ? 0 : borderWidth / 2),
      width:
        maxRight -
        minLeft -
        (tableEdges.left ? borderWidth / 2 : borderWidth) -
        (tableEdges.right ? borderWidth / 2 : borderWidth),
      height:
        maxBottom -
        minTop -
        (tableEdges.top ? borderWidth / 2 : borderWidth) -
        (tableEdges.bottom ? borderWidth / 2 : borderWidth),
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
