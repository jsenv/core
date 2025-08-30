import { useLayoutEffect, useState } from "preact/hooks";

import.meta.css = /* css */ `
  .table_selection_overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .table_selection_overlay svg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: visible; /* because svg is not taking the table dimensions */
  }

  .table_selection_overlay svg path {
    fill: none;
    stroke: #0078d4;
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  /* Hide borders during drag selection */
  table[data-drag-selecting] + .table_selection_overlay {
    display: none;
  }
`;

export const TableSelectionBorders = ({ tableRef }) => {
  const [selectionData, setSelectionData] = useState(null);

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

  if (!selectionData || selectionData.selectedCells.length === 0) {
    return null;
  }

  const { selectedCells } = selectionData;
  const borderPath = generateSelectionBorderPath(selectedCells);

  return (
    <div className="table_selection_overlay">
      <svg>
        <path d={borderPath} />
      </svg>
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
    const selectedCells = table.querySelectorAll('[aria-selected="true"]');

    if (selectedCells.length === 0) {
      updateSelectionData(NO_SELECTION);
      return;
    }

    const tableRect = table.getBoundingClientRect();

    // Get cell information for each selected cell
    const cellInfos = Array.from(selectedCells).map((cell) => {
      const cellRect = cell.getBoundingClientRect();
      const row = cell.closest("tr");
      const rowIndex = Array.from(row.parentNode.children).indexOf(row);
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

// Generate an SVG path that follows the perimeter of the selection
const generateSelectionBorderPath = (selectedCells) => {
  if (selectedCells.length === 0) {
    return "";
  }

  // Group cells by their type
  const rowCells = selectedCells.filter(
    (cell) => cell.element.getAttribute("data-selection-name") === "row",
  );
  const columnCells = selectedCells.filter(
    (cell) => cell.element.getAttribute("data-selection-name") === "column",
  );
  const cellCells = selectedCells.filter((cell) => {
    const selectionName = cell.element.getAttribute("data-selection-name");
    return selectionName !== "row" && selectionName !== "column";
  });

  let paths = [];

  // Handle row selections - create rectangular outlines for each contiguous group of rows
  if (rowCells.length > 0) {
    paths.push(generateRowSelectionPath(rowCells));
  }

  // Handle column selections - create rectangular outlines for each contiguous group of columns
  if (columnCells.length > 0) {
    paths.push(generateColumnSelectionPath(columnCells));
  }

  // Handle cell selections - use the original algorithm
  if (cellCells.length > 0) {
    paths.push(generateCellSelectionPath(cellCells));
  }

  return paths.filter((p) => p).join(" ");
};

// Generate path for column selections - creates simple rectangular outlines
const generateColumnSelectionPath = (selectedCells) => {
  if (selectedCells.length === 0) return "";

  // Group consecutive columns
  const columnGroups = [];
  const sortedCells = selectedCells.sort((a, b) => a.column - b.column);

  let currentGroup = [sortedCells[0]];

  for (let i = 1; i < sortedCells.length; i++) {
    const currentCell = sortedCells[i];
    const lastCell = currentGroup[currentGroup.length - 1];

    if (currentCell.column === lastCell.column + 1) {
      // Consecutive column, add to current group
      currentGroup.push(currentCell);
    } else {
      // Non-consecutive, start new group
      columnGroups.push(currentGroup);
      currentGroup = [currentCell];
    }
  }
  columnGroups.push(currentGroup);

  // Create a rectangular path for each group of consecutive columns
  return columnGroups
    .map((group) => {
      const leftColumn = group[0];
      const rightColumn = group[group.length - 1];

      // For column selections, we need to find the bounds of all cells in that column
      const table = leftColumn.element.closest("table");
      if (!table) return "";

      // Start from the first row (including header) to get the top boundary
      const firstRow = table.rows[0];
      if (!firstRow) return "";

      // Find the last data row to get the bottom boundary
      const lastDataRow = table.rows[table.rows.length - 1];
      if (!lastDataRow) return "";

      // Get the cells in the selected columns for the first and last rows
      const leftColumnCell = firstRow.cells[leftColumn.column];
      const rightColumnCell = firstRow.cells[rightColumn.column];
      const lastRowLeftCell = lastDataRow.cells[leftColumn.column];

      if (!leftColumnCell || !rightColumnCell || !lastRowLeftCell) return "";

      // Get table bounds for relative positioning
      const tableRect = table.getBoundingClientRect();
      const leftColumnRect = leftColumnCell.getBoundingClientRect();
      const rightColumnRect = rightColumnCell.getBoundingClientRect();
      const lastRowRect = lastRowLeftCell.getBoundingClientRect();

      const minLeft = leftColumnRect.left - tableRect.left;
      const maxRight = rightColumnRect.right - tableRect.left;
      const minTop = leftColumnRect.top - tableRect.top;
      const maxBottom = lastRowRect.bottom - tableRect.top;

      // Create a rectangular path with all borders
      return `M ${minLeft + 0.5} ${minTop + 0.5} L ${maxRight - 0.5} ${minTop + 0.5} L ${maxRight - 0.5} ${maxBottom - 0.5} L ${minLeft + 0.5} ${maxBottom - 0.5} Z`;
    })
    .join(" ");
};

// Generate path for row selections - creates simple rectangular outlines
const generateRowSelectionPath = (selectedCells) => {
  if (selectedCells.length === 0) return "";

  // Group consecutive rows
  const rowGroups = [];
  const sortedCells = selectedCells.sort((a, b) => a.row - b.row);

  let currentGroup = [sortedCells[0]];

  for (let i = 1; i < sortedCells.length; i++) {
    const currentCell = sortedCells[i];
    const lastCell = currentGroup[currentGroup.length - 1];

    if (currentCell.row === lastCell.row + 1) {
      // Consecutive row, add to current group
      currentGroup.push(currentCell);
    } else {
      // Non-consecutive, start new group
      rowGroups.push(currentGroup);
      currentGroup = [currentCell];
    }
  }
  rowGroups.push(currentGroup);

  // Create a rectangular path for each group of consecutive rows
  return rowGroups
    .map((group) => {
      const topRow = group[0];
      const bottomRow = group[group.length - 1];

      // For row selections, we need to find the bounds of the data cells (excluding first column)
      // Since row selections only select the first column, we need to calculate where the data cells would be
      const table = topRow.element.closest("table");
      if (!table) return "";

      // Find the first data cell (column 1) in the top row to get the left boundary
      const topRowElement = table.rows[topRow.row];
      const firstDataCell = topRowElement.cells[1]; // Skip column 0
      if (!firstDataCell) return "";

      // Find the last data cell in the row to get the right boundary
      const lastDataCell = topRowElement.cells[topRowElement.cells.length - 1];
      if (!lastDataCell) return "";

      // Get table bounds for relative positioning
      const tableRect = table.getBoundingClientRect();
      const firstDataCellRect = firstDataCell.getBoundingClientRect();
      const lastDataCellRect = lastDataCell.getBoundingClientRect();

      const minLeft = firstDataCellRect.left - tableRect.left;
      const maxRight = lastDataCellRect.right - tableRect.left;
      const minTop = topRow.top;
      const maxBottom = bottomRow.bottom;

      // Create a rectangular path with all borders including the left border
      // Path goes: top-left -> top-right -> bottom-right -> bottom-left -> back to top-left
      return `M ${minLeft} ${minTop} L ${maxRight} ${minTop} L ${maxRight} ${maxBottom} L ${minLeft} ${maxBottom} Z`;
    })
    .join(" ");
};

// Generate path for cell selections - uses the original edge-tracing algorithm
const generateCellSelectionPath = (selectedCells) => {
  // Create a grid to track selected cells
  const grid = new Map();
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;

  selectedCells.forEach((cell) => {
    const key = `${cell.column},${cell.row}`;
    grid.set(key, cell);
    minRow = Math.min(minRow, cell.row);
    maxRow = Math.max(maxRow, cell.row);
    minCol = Math.min(minCol, cell.column);
    maxCol = Math.max(maxCol, cell.column);
  });

  // Find all edge segments that form the outer perimeter
  const edges = [];

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const cellKey = `${col},${row}`;
      const cell = grid.get(cellKey);

      if (!cell) continue;

      const { left, top, right, bottom } = cell;

      // Check each side of the cell to see if it's on the perimeter
      // Top edge - no cell above
      if (!grid.has(`${col},${row - 1}`)) {
        edges.push({
          type: "horizontal",
          x1: left,
          y1: top,
          x2: right,
          y2: top,
          direction: "top",
        });
      }

      // Bottom edge - no cell below
      if (!grid.has(`${col},${row + 1}`)) {
        edges.push({
          type: "horizontal",
          x1: left,
          y1: bottom,
          x2: right,
          y2: bottom,
          direction: "bottom",
        });
      }

      // Left edge - no cell to the left
      if (!grid.has(`${col - 1},${row}`)) {
        edges.push({
          type: "vertical",
          x1: left,
          y1: top,
          x2: left,
          y2: bottom,
          direction: "left",
        });
      }

      // Right edge - no cell to the right
      if (!grid.has(`${col + 1},${row}`)) {
        edges.push({
          type: "vertical",
          x1: right,
          y1: top,
          x2: right,
          y2: bottom,
          direction: "right",
        });
      }
    }
  }

  // Convert edges to a continuous path
  return edgesToSVGPath(edges);
};

// Convert edge segments into a continuous SVG path
const edgesToSVGPath = (edges) => {
  if (edges.length === 0) return "";

  // Find all unique paths by tracing connected edges
  const paths = [];
  const usedEdges = new Set();

  // Sort edges to ensure consistent path generation
  const sortedEdges = [...edges].sort((a, b) => {
    if (a.y1 !== b.y1) return a.y1 - b.y1;
    if (a.x1 !== b.x1) return a.x1 - b.x1;
    return a.type.localeCompare(b.type);
  });

  sortedEdges.forEach((startEdge) => {
    const startIndex = edges.indexOf(startEdge);
    if (usedEdges.has(startIndex)) return;

    const pathPoints = [];
    const visitedEdges = [];
    let currentEdge = startEdge;
    let currentIndex = startIndex;

    // Start the path
    pathPoints.push({ x: currentEdge.x1, y: currentEdge.y1 });

    // Trace the path from this starting edge
    while (true) {
      usedEdges.add(currentIndex);
      visitedEdges.push(currentIndex);

      // Add the end point of current edge
      pathPoints.push({ x: currentEdge.x2, y: currentEdge.y2 });

      // Find the next connected edge
      const nextEdgeData = findNextConnectedEdge(currentEdge, edges, usedEdges);
      if (!nextEdgeData) break;

      currentEdge = nextEdgeData.edge;
      currentIndex = nextEdgeData.index;

      // Check if we've completed a loop
      if (visitedEdges.includes(currentIndex)) break;
    }

    if (pathPoints.length > 1) {
      paths.push(pathPoints);
    }
  });

  // Convert each path to SVG - create one continuous path instead of multiple closed paths
  if (paths.length === 0) return "";

  // For multiple disconnected regions, we still want to create separate closed paths
  // but we need to be smarter about it
  return paths
    .map((pathPoints) => {
      if (pathPoints.length === 0) return "";

      const firstPoint = pathPoints[0];
      let pathData = `M ${firstPoint.x} ${firstPoint.y}`;

      for (let i = 1; i < pathPoints.length; i++) {
        const point = pathPoints[i];
        pathData += ` L ${point.x} ${point.y}`;
      }

      // Only close the path if the last point is different from the first
      const lastPoint = pathPoints[pathPoints.length - 1];
      if (
        Math.abs(lastPoint.x - firstPoint.x) > 0.1 ||
        Math.abs(lastPoint.y - firstPoint.y) > 0.1
      ) {
        pathData += ` L ${firstPoint.x} ${firstPoint.y}`;
      }
      pathData += " Z";

      return pathData;
    })
    .join(" ");
};

// Find the next edge that connects to the current edge's endpoint
const findNextConnectedEdge = (currentEdge, allEdges, usedEdges) => {
  const tolerance = 0.1; // Small tolerance for floating point comparison
  const endX = currentEdge.x2;
  const endY = currentEdge.y2;

  for (let i = 0; i < allEdges.length; i++) {
    if (usedEdges.has(i)) continue;

    const edge = allEdges[i];

    // Check if this edge starts where the current edge ends
    if (
      Math.abs(edge.x1 - endX) < tolerance &&
      Math.abs(edge.y1 - endY) < tolerance
    ) {
      return { edge, index: i };
    }

    // Also check if this edge ends where the current edge ends (for reversing)
    if (
      Math.abs(edge.x2 - endX) < tolerance &&
      Math.abs(edge.y2 - endY) < tolerance
    ) {
      // Reverse the edge
      return {
        edge: {
          ...edge,
          x1: edge.x2,
          y1: edge.y2,
          x2: edge.x1,
          y2: edge.y1,
        },
        index: i,
      };
    }
  }

  return null;
};
