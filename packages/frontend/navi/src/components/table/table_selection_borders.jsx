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

  // Generate perimeter points by walking around the selection boundary
  // We'll create corner points that form the actual perimeter

  // Find the bounding box of the selection
  let minRow = Math.min(...selectedCells.map((c) => c.row));
  let maxRow = Math.max(...selectedCells.map((c) => c.row));
  let minCol = Math.min(...selectedCells.map((c) => c.column));
  let maxCol = Math.max(...selectedCells.map((c) => c.column));

  // Create a grid that includes one cell buffer around the selection
  // This helps us trace the outer boundary properly
  const extendedGrid = new Map();
  for (let row = minRow - 1; row <= maxRow + 1; row++) {
    for (let col = minCol - 1; col <= maxCol + 1; col++) {
      const isSelected = isCellSelected(col, row);
      extendedGrid.set(`${col},${row}`, isSelected);
    }
  }

  // Helper to check if a position in extended grid is selected
  const isExtendedSelected = (col, row) => {
    return extendedGrid.get(`${col},${row}`) || false;
  };

  // Find corner points by detecting transitions between selected and unselected areas
  const corners = [];

  // Scan the grid to find corners where selection state changes
  for (let row = minRow - 1; row <= maxRow; row++) {
    for (let col = minCol - 1; col <= maxCol; col++) {
      // Check the 2x2 square starting at this position
      const topLeft = isExtendedSelected(col, row);
      const topRight = isExtendedSelected(col + 1, row);
      const bottomLeft = isExtendedSelected(col, row + 1);
      const bottomRight = isExtendedSelected(col + 1, row + 1);

      // Count selected cells in this 2x2 square
      const selectedCount = [topLeft, topRight, bottomLeft, bottomRight].filter(
        Boolean,
      ).length;

      // A corner exists when we have 1 or 3 selected cells (transition points)
      if (selectedCount === 1 || selectedCount === 3) {
        // Get the actual cell coordinates from our selection
        const cellAtPos =
          selectedCells.find((c) => c.column === col && c.row === row) ||
          selectedCells.find((c) => c.column === col + 1 && c.row === row) ||
          selectedCells.find((c) => c.column === col && c.row === row + 1) ||
          selectedCells.find((c) => c.column === col + 1 && c.row === row + 1);

        if (cellAtPos) {
          // Calculate the actual corner position based on cell boundaries
          const cornerX =
            col < cellAtPos.column ? cellAtPos.left : cellAtPos.right;
          const cornerY =
            row < cellAtPos.row ? cellAtPos.top : cellAtPos.bottom;

          corners.push({
            x: cornerX,
            y: cornerY,
            gridCol: col,
            gridRow: row,
            pattern: [topLeft, topRight, bottomLeft, bottomRight],
          });
        }
      }
    }
  }

  if (corners.length === 0) {
    // Fallback: create a simple rectangle around all selected cells
    const minX = Math.min(...selectedCells.map((c) => c.left));
    const maxX = Math.max(...selectedCells.map((c) => c.right));
    const minY = Math.min(...selectedCells.map((c) => c.top));
    const maxY = Math.max(...selectedCells.map((c) => c.bottom));

    return `M ${minX} ${minY} L ${maxX} ${minY} L ${maxX} ${maxY} L ${minX} ${maxY} Z`;
  }

  // Sort corners to create a clockwise path around the perimeter
  // Start from the topmost, leftmost corner
  corners.sort((a, b) => {
    if (Math.abs(a.y - b.y) < 0.1) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });

  // Create the SVG path by connecting the corners
  if (corners.length === 0) return "";

  const startCorner = corners[0];
  let pathData = `M ${startCorner.x} ${startCorner.y}`;

  // Connect to each subsequent corner
  for (let i = 1; i < corners.length; i++) {
    const corner = corners[i];
    pathData += ` L ${corner.x} ${corner.y}`;
  }

  pathData += " Z"; // Close the path
  return pathData;
};
