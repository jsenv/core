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

// Generate an SVG path that follows the perimeter of the selection
const generateSelectionBorderPath = (selectedCells) => {
  if (selectedCells.length === 0) {
    return "";
  }

  // Simple approach: treat all selected cells equally and use edge-tracing
  return generateCellSelectionPath(selectedCells);
};

// Generate path for cell selections - creates proper perimeter based on cell grid
const generateCellSelectionPath = (selectedCells) => {
  if (selectedCells.length === 0) return "";

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

  // Find all boundary edges that form the perimeter
  const edges = [];

  selectedCells.forEach((cell) => {
    const { left, top, right, bottom, row, column } = cell;

    // Check each side of the cell to see if it's on the perimeter
    // Top edge - no selected cell above
    if (!isCellSelected(column, row - 1)) {
      edges.push({
        x1: left,
        y1: top,
        x2: right,
        y2: top,
        type: "horizontal",
        direction: "top",
      });
    }

    // Bottom edge - no selected cell below
    if (!isCellSelected(column, row + 1)) {
      edges.push({
        x1: left,
        y1: bottom,
        x2: right,
        y2: bottom,
        type: "horizontal",
        direction: "bottom",
      });
    }

    // Left edge - no selected cell to the left
    if (!isCellSelected(column - 1, row)) {
      edges.push({
        x1: left,
        y1: top,
        x2: left,
        y2: bottom,
        type: "vertical",
        direction: "left",
      });
    }

    // Right edge - no selected cell to the right
    if (!isCellSelected(column + 1, row)) {
      edges.push({
        x1: right,
        y1: top,
        x2: right,
        y2: bottom,
        type: "vertical",
        direction: "right",
      });
    }
  });

  if (edges.length === 0) return "";

  // Trace the perimeter by following connected edges
  const usedEdges = new Set();
  let pathData = "";

  // Find a starting edge (leftmost top edge)
  const sortedEdges = edges.sort((a, b) => {
    if (Math.abs(a.y1 - b.y1) < 0.1) {
      return a.x1 - b.x1;
    }
    return a.y1 - b.y1;
  });

  let currentEdge = sortedEdges[0];
  let currentIndex = edges.indexOf(currentEdge);

  if (!currentEdge) return "";

  // Start the path
  pathData = `M ${currentEdge.x1} ${currentEdge.y1}`;
  const startX = currentEdge.x1;
  const startY = currentEdge.y1;

  while (currentEdge && !usedEdges.has(currentIndex)) {
    usedEdges.add(currentIndex);

    // Add the end point of current edge
    pathData += ` L ${currentEdge.x2} ${currentEdge.y2}`;

    // Find the next connected edge
    const nextEdge = findNextConnectedEdge(currentEdge, edges, usedEdges);

    if (!nextEdge) {
      // No more edges found - check if we can close the path
      if (
        Math.abs(currentEdge.x2 - startX) < 0.1 &&
        Math.abs(currentEdge.y2 - startY) < 0.1
      ) {
        break; // Path is already closed
      }

      // Try to find any edge that connects back to start
      for (let i = 0; i < edges.length; i++) {
        if (usedEdges.has(i)) continue;

        const edge = edges[i];
        if (
          Math.abs(edge.x1 - currentEdge.x2) < 0.1 &&
          Math.abs(edge.y1 - currentEdge.y2) < 0.1
        ) {
          currentEdge = edge;
          currentIndex = i;
          break;
        }
        if (
          Math.abs(edge.x2 - currentEdge.x2) < 0.1 &&
          Math.abs(edge.y2 - currentEdge.y2) < 0.1
        ) {
          // Reverse the edge
          currentEdge = {
            x1: edge.x2,
            y1: edge.y2,
            x2: edge.x1,
            y2: edge.y1,
            type: edge.type,
            direction: edge.direction,
          };
          currentIndex = i;
          break;
        }
      }

      if (!currentEdge || usedEdges.has(currentIndex)) break;
    } else {
      currentEdge = nextEdge.edge;
      currentIndex = nextEdge.index;
    }

    // Safety check to prevent infinite loops
    if (usedEdges.size > edges.length) break;
  }

  pathData += " Z"; // Close the path
  return pathData;
};

// Find the next edge that connects to the current edge's endpoint
const findNextConnectedEdge = (currentEdge, allEdges, usedEdges) => {
  const tolerance = 0.1;
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

    // Check if this edge ends where the current edge ends (reverse it)
    if (
      Math.abs(edge.x2 - endX) < tolerance &&
      Math.abs(edge.y2 - endY) < tolerance
    ) {
      return {
        edge: {
          x1: edge.x2,
          y1: edge.y2,
          x2: edge.x1,
          y2: edge.y1,
          type: edge.type,
          direction: edge.direction,
        },
        index: i,
      };
    }
  }

  return null;
};
