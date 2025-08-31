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

    drawSelectionBorders(canvas, selectionData.selectedCells);
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

// Draw selection borders on canvas using filled rectangles
const drawSelectionBorders = (canvas, selectedCells) => {
  const ctx = canvas.getContext("2d");
  const devicePixelRatio = window.devicePixelRatio || 1;

  // Set canvas size for high-DPI displays
  const displayWidth = canvas.width;
  const displayHeight = canvas.height;
  canvas.width = displayWidth * devicePixelRatio;
  canvas.height = displayHeight * devicePixelRatio;

  // Scale context for high-DPI
  ctx.scale(devicePixelRatio, devicePixelRatio);

  // Clear canvas
  ctx.clearRect(0, 0, displayWidth, displayHeight);

  // Set up drawing context
  ctx.fillStyle = "#0078d4";
  ctx.globalAlpha = 0.5;
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

  // Draw borders for each selected cell
  selectedCells.forEach((cell) => {
    const { left, top, right, bottom, row, column } = cell;

    // Check each side of the cell to see if it needs a border
    const needsTopBorder = !isCellSelected(column, row - 1);
    const needsBottomBorder = !isCellSelected(column, row + 1);
    const needsLeftBorder = !isCellSelected(column - 1, row);
    const needsRightBorder = !isCellSelected(column + 1, row);

    // Draw borders as filled rectangles (1px thick)
    if (needsTopBorder) {
      ctx.fillRect(left, top, right - left, 1);
    }
    if (needsBottomBorder) {
      ctx.fillRect(left, bottom - 1, right - left, 1);
    }
    if (needsLeftBorder) {
      ctx.fillRect(left, top, 1, bottom - top);
    }
    if (needsRightBorder) {
      ctx.fillRect(right - 1, top, 1, bottom - top);
    }
  });
};
