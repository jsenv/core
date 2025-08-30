import { useLayoutEffect, useState } from "preact/hooks";

import.meta.css = /* css */ `
  .selection-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .selection-svg {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .selection-border-rect {
    fill: #0078d4;
  }

  /* Hide borders during drag selection */
  table[data-drag-selecting] + * .selection-overlay {
    display: none;
  }
`;

export const TableSelectionBorders = ({
  tableRef,
  color = "#0078d4",
  opacity = 1,
}) => {
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
  const borderRects = generateSelectionBorderRects(selectedCells);

  return (
    <div className="selection-overlay">
      <svg className="selection-svg" width="100%" height="100%">
        {borderRects.map((rect, index) => (
          <rect
            key={index}
            className="selection-border-rect"
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill={color}
            fillOpacity={opacity}
          />
        ))}
      </svg>
    </div>
  );
};

// Hook version for more flexible usage
export const useTableSelectionBorders = (
  tableRef,
  { color = "#0078d4", opacity = 1 } = {},
) => {
  return (
    <TableSelectionBorders
      tableRef={tableRef}
      color={color}
      opacity={opacity}
    />
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

// Generate SVG rectangles for selection borders using fill instead of stroke
const generateSelectionBorderRects = (selectedCells) => {
  if (selectedCells.length === 0) {
    return [];
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

  let rects = [];

  // Handle row selections
  if (rowCells.length > 0) {
    rects.push(...generateRowSelectionRects(rowCells));
  }

  // Handle column selections
  if (columnCells.length > 0) {
    rects.push(...generateColumnSelectionRects(columnCells));
  }

  // Handle cell selections
  if (cellCells.length > 0) {
    rects.push(...generateCellSelectionRects(cellCells));
  }

  return rects;
};

// Generate rectangles for column selections
const generateColumnSelectionRects = (selectedCells) => {
  if (selectedCells.length === 0) return [];

  // Group consecutive columns
  const columnGroups = [];
  const sortedCells = selectedCells.sort((a, b) => a.column - b.column);

  let currentGroup = [sortedCells[0]];

  for (let i = 1; i < sortedCells.length; i++) {
    const currentCell = sortedCells[i];
    const lastCell = currentGroup[currentGroup.length - 1];

    if (currentCell.column === lastCell.column + 1) {
      currentGroup.push(currentCell);
    } else {
      columnGroups.push(currentGroup);
      currentGroup = [currentCell];
    }
  }
  columnGroups.push(currentGroup);

  // Create border rectangles for each group of consecutive columns
  return columnGroups.flatMap((group) => {
    const leftColumn = group[0];
    const rightColumn = group[group.length - 1];

    const table = leftColumn.element.closest("table");
    if (!table) return [];

    const firstDataRow = table.rows[1]; // Skip header row
    if (!firstDataRow) return [];

    const lastDataRow = table.rows[table.rows.length - 1];
    if (!lastDataRow) return [];

    const leftColumnCell = firstDataRow.cells[leftColumn.column];
    const rightColumnCell = firstDataRow.cells[rightColumn.column];
    const lastRowLeftCell = lastDataRow.cells[leftColumn.column];

    if (!leftColumnCell || !rightColumnCell || !lastRowLeftCell) return [];

    const tableRect = table.getBoundingClientRect();
    const leftColumnRect = leftColumnCell.getBoundingClientRect();
    const rightColumnRect = rightColumnCell.getBoundingClientRect();
    const lastRowRect = lastRowLeftCell.getBoundingClientRect();

    const minLeft = leftColumnRect.left - tableRect.left;
    const maxRight = rightColumnRect.right - tableRect.left;
    const minTop = leftColumnRect.top - tableRect.top;
    const maxBottom = lastRowRect.bottom - tableRect.top;

    // Create 1px wide border rectangles for all 4 sides
    return [
      // Top border
      { x: minLeft, y: minTop, width: maxRight - minLeft, height: 1 },
      // Right border
      { x: maxRight - 1, y: minTop, width: 1, height: maxBottom - minTop },
      // Bottom border
      { x: minLeft, y: maxBottom - 1, width: maxRight - minLeft, height: 1 },
      // Left border
      { x: minLeft, y: minTop, width: 1, height: maxBottom - minTop },
    ];
  });
};

// Generate rectangles for row selections
const generateRowSelectionRects = (selectedCells) => {
  if (selectedCells.length === 0) return [];

  // Group consecutive rows
  const rowGroups = [];
  const sortedCells = selectedCells.sort((a, b) => a.row - b.row);

  let currentGroup = [sortedCells[0]];

  for (let i = 1; i < sortedCells.length; i++) {
    const currentCell = sortedCells[i];
    const lastCell = currentGroup[currentGroup.length - 1];

    if (currentCell.row === lastCell.row + 1) {
      currentGroup.push(currentCell);
    } else {
      rowGroups.push(currentGroup);
      currentGroup = [currentCell];
    }
  }
  rowGroups.push(currentGroup);

  // Create border rectangles for each group of consecutive rows
  return rowGroups.flatMap((group) => {
    const topRow = group[0];
    const bottomRow = group[group.length - 1];

    const table = topRow.element.closest("table");
    if (!table) return [];

    const topRowElement = table.rows[topRow.row];
    const firstDataCell = topRowElement.cells[1]; // Skip column 0
    if (!firstDataCell) return [];

    const lastDataCell = topRowElement.cells[topRowElement.cells.length - 1];
    if (!lastDataCell) return [];

    const tableRect = table.getBoundingClientRect();
    const firstDataCellRect = firstDataCell.getBoundingClientRect();
    const lastDataCellRect = lastDataCell.getBoundingClientRect();

    const minLeft = firstDataCellRect.left - tableRect.left;
    const maxRight = lastDataCellRect.right - tableRect.left;
    const minTop = topRow.top;
    const maxBottom = bottomRow.bottom;

    // Create 1px wide border rectangles for all 4 sides
    return [
      // Top border
      { x: minLeft, y: minTop, width: maxRight - minLeft, height: 1 },
      // Right border
      { x: maxRight - 1, y: minTop, width: 1, height: maxBottom - minTop },
      // Bottom border
      { x: minLeft, y: maxBottom - 1, width: maxRight - minLeft, height: 1 },
      // Left border
      { x: minLeft, y: minTop, width: 1, height: maxBottom - minTop },
    ];
  });
};

// Generate rectangles for cell selections - create border segments using smart intersection logic
const generateCellSelectionRects = (selectedCells) => {
  if (selectedCells.length === 0) return [];

  // Create a grid to track selected cells
  const grid = new Map();
  selectedCells.forEach((cell) => {
    const key = `${cell.column},${cell.row}`;
    grid.set(key, cell);
  });

  const rects = [];

  // For each selected cell, determine which border segments it should draw
  selectedCells.forEach((cell) => {
    const { left, top, right, bottom, row, column } = cell;

    // Check neighbors to determine which borders to draw
    const hasTopNeighbor = grid.has(`${column},${row - 1}`);
    const hasBottomNeighbor = grid.has(`${column},${row + 1}`);
    const hasLeftNeighbor = grid.has(`${column - 1},${row}`);
    const hasRightNeighbor = grid.has(`${column + 1},${row}`);

    // Only draw borders where there's no adjacent selected cell
    if (!hasTopNeighbor) {
      // Top border
      rects.push({ x: left, y: top, width: right - left, height: 1 });
    }
    if (!hasBottomNeighbor) {
      // Bottom border
      rects.push({ x: left, y: bottom - 1, width: right - left, height: 1 });
    }
    if (!hasLeftNeighbor) {
      // Left border
      rects.push({ x: left, y: top, width: 1, height: bottom - top });
    }
    if (!hasRightNeighbor) {
      // Right border
      rects.push({ x: right - 1, y: top, width: 1, height: bottom - top });
    }
  });

  return rects;
};
