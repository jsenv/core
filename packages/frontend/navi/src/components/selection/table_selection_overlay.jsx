import { useLayoutEffect, useState } from "preact/hooks";

export const TableSelectionOverlay = ({ tableRef, selectedCells }) => {
  const [rectangles, setRectangles] = useState([]);

  useLayoutEffect(() => {
    if (!tableRef.current) {
      setRectangles([]);
      return null;
    }

    const table = tableRef.current;

    // eslint-disable-next-line consistent-return
    const calculateRectangles = () => {
      if (selectedCells.length === 0) {
        setRectangles([]);
        return null;
      }

      const tableRect = table.getBoundingClientRect();

      // Calculate selection rectangles
      const cellPositions = new Map();

      // Get positions of all selected cells
      selectedCells.forEach((cellId) => {
        const cell = table.querySelector(`[data-value="${cellId}"]`);
        if (cell) {
          const cellRect = cell.getBoundingClientRect();
          const [columnName, rowId] = cellId.split(":");

          cellPositions.set(cellId, {
            left: cellRect.left - tableRect.left,
            top: cellRect.top - tableRect.top,
            width: cellRect.width,
            height: cellRect.height,
            row: rowId,
            column: columnName,
          });
        }
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
        );
        if (rectangle) {
          newRectangles.push(rectangle);
        }
      });

      setRectangles(newRectangles);
    };

    // Calculate rectangles initially
    calculateRectangles();

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
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [selectedCells, tableRef]);

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

const findContiguousRectangle = (
  startCellId,
  cellPositions,
  processedCells,
) => {
  const startPos = cellPositions.get(startCellId);
  if (!startPos) return null;

  // Build a grid map of all selected cells by their row/column coordinates
  const gridMap = new Map();
  cellPositions.forEach((pos, cellId) => {
    if (!processedCells.has(cellId)) {
      const key = `${pos.row}-${pos.column}`;
      gridMap.set(key, { cellId, pos });
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
      `${parseInt(currentPos.row) - 1}-${currentPos.column}`, // up
      `${parseInt(currentPos.row) + 1}-${currentPos.column}`, // down
      `${currentPos.row}-${getAdjacentColumn(currentPos.column, -1)}`, // left
      `${currentPos.row}-${getAdjacentColumn(currentPos.column, 1)}`, // right
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
  // In a collapsed border table, adjacent cells share borders
  const borderWidth = 1; // Based on CSS: border: 1px solid #e0e0e0

  // Calculate border adjustments
  // For left/top borders: only adjust if we're not at the table edge
  // For right/bottom borders: always adjust inward to follow collapsed borders

  // Check if selection touches table edges
  const tableEdges = getTableEdges(connectedCells, cellPositions);

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
};

// Helper function to get adjacent column name
const getAdjacentColumn = (columnName, offset) => {
  const columnIndex = columns.findIndex(
    (col) => col.accessorKey === columnName,
  );
  const newIndex = columnIndex + offset;
  if (newIndex >= 0 && newIndex < columns.length) {
    return columns[newIndex].accessorKey;
  }
  return null;
};

// Helper function to determine if selection touches table edges
const getTableEdges = (connectedCells, cellPositions) => {
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;

  connectedCells.forEach((cellId) => {
    const pos = cellPositions.get(cellId);
    if (pos) {
      const rowNum = parseInt(pos.row);
      const colIndex = columns.findIndex(
        (col) => col.accessorKey === pos.column,
      );

      minRow = Math.min(minRow, rowNum);
      maxRow = Math.max(maxRow, rowNum);
      minCol = Math.min(minCol, colIndex);
      maxCol = Math.max(maxCol, colIndex);
    }
  });

  // Determine table boundaries
  const allRowIds = sampleData.map((row) => parseInt(row.id));
  const tableMinRow = Math.min(...allRowIds);
  const tableMaxRow = Math.max(...allRowIds);
  const tableMinCol = 0;
  const tableMaxCol = columns.length - 1;

  return {
    top: minRow <= tableMinRow,
    bottom: maxRow >= tableMaxRow,
    left: minCol <= tableMinCol,
    right: maxCol >= tableMaxCol,
  };
};
