import { useLayoutEffect, useState } from "preact/hooks";

import.meta.css = /* css */ `
  /* Selection border styling using data attributes */
  [data-selection-border-top] {
    border-top-color: var(--selection-border-color) !important;
  }
  [data-selection-border-right] {
    border-right-color: var(--selection-border-color) !important;
  }
  [data-selection-border-bottom] {
    border-bottom-color: var(--selection-border-color) !important;
  }
  [data-selection-border-left] {
    border-left-color: var(--selection-border-color) !important;
  }

  /* Hide borders during drag selection */
  table[data-drag-selecting] [data-selection-border-top],
  table[data-drag-selecting] [data-selection-border-right],
  table[data-drag-selecting] [data-selection-border-bottom],
  table[data-drag-selecting] [data-selection-border-left] {
    border-top-color: var(--border-color) !important;
    border-right-color: var(--border-color) !important;
    border-bottom-color: var(--border-color) !important;
    border-left-color: var(--border-color) !important;
  }
`;

export const TableSelectionBorders = ({ tableRef, color }) => {
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

  // Apply selection border styling whenever selection data changes
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    // Clear all existing selection border attributes
    table
      .querySelectorAll(
        "[data-selection-border-top], [data-selection-border-right], [data-selection-border-bottom], [data-selection-border-left]",
      )
      .forEach((cell) => {
        cell.removeAttribute("data-selection-border-top");
        cell.removeAttribute("data-selection-border-right");
        cell.removeAttribute("data-selection-border-bottom");
        cell.removeAttribute("data-selection-border-left");
      });

    // Set CSS custom property for selection border color
    table.style.setProperty("--selection-border-color", color || "#0078d4");

    if (!selectionData || selectionData.selectedCells.length === 0) {
      return;
    }

    applySelectionBorderAttributes(table, selectionData.selectedCells);
  }, [selectionData, color, tableRef]);

  // No canvas needed - we use CSS border styling
  return null;
};

/**
 * Apply data attributes to control border colors based on CSS border collapse model
 */
const applySelectionBorderAttributes = (table, selectedCells) => {
  if (!selectedCells || selectedCells.length === 0) return;

  // Create a map of selected cells for quick lookup
  const selectedCellsMap = new Map();
  selectedCells.forEach((cell) => {
    const key = `${cell.column},${cell.row}`;
    selectedCellsMap.set(key, cell);
  });

  // Helper function to check if a cell is selected
  const isCellSelected = (column, row) => {
    return selectedCellsMap.has(`${column},${row}`);
  };

  // Apply border attributes to each selected cell
  selectedCells.forEach((cell) => {
    const { element, row, column } = cell;

    // Check neighboring cells
    const hasTopNeighbor = isCellSelected(column, row - 1);
    const hasBottomNeighbor = isCellSelected(column, row + 1);
    const hasLeftNeighbor = isCellSelected(column - 1, row);
    const hasRightNeighbor = isCellSelected(column + 1, row);

    // Apply border attributes based on CSS border collapse ownership:
    // - Top border: Only first row cells own their top border
    // - Left border: Only first column cells own their left border
    // - Bottom border: All cells own their bottom border
    // - Right border: All cells own their right border

    // Top border: Apply if no top neighbor (perimeter) or if this is first row
    if (!hasTopNeighbor) {
      if (row === 0) {
        // First row: this cell owns its top border
        element.setAttribute("data-selection-border-top", "");
      } else {
        // Not first row: the cell above would own the shared border
        // But since there's no top neighbor, this is a perimeter border
        element.setAttribute("data-selection-border-top", "");
      }
    }

    // Bottom border: Apply if no bottom neighbor (perimeter)
    if (!hasBottomNeighbor) {
      element.setAttribute("data-selection-border-bottom", "");
    }

    // Left border: Apply if no left neighbor (perimeter) or if this is first column
    if (!hasLeftNeighbor) {
      if (column === 0) {
        // First column: this cell owns its left border
        element.setAttribute("data-selection-border-left", "");
      } else {
        // Not first column: the cell to the left would own the shared border
        // But since there's no left neighbor, this is a perimeter border
        element.setAttribute("data-selection-border-left", "");
      }
    }

    // Right border: Apply if no right neighbor (perimeter)
    if (!hasRightNeighbor) {
      element.setAttribute("data-selection-border-right", "");
    }

    // Handle shared borders according to CSS border collapse:
    // The cell that "owns" the border in CSS should have the colored border

    // For horizontal shared borders (left/right connections)
    if (hasLeftNeighbor && column > 0) {
      // This cell is connected to the left
      // The left cell owns the right border (which is the shared border)
      // So we need to color the left cell's right border
      const leftCell = selectedCellsMap.get(`${column - 1},${row}`);
      if (leftCell) {
        leftCell.element.setAttribute("data-selection-border-right", "");
      }
    }

    // For vertical shared borders (top/bottom connections)
    if (hasTopNeighbor && row > 0) {
      // This cell is connected to the top
      // The top cell owns the bottom border (which is the shared border)
      // So we need to color the top cell's bottom border
      const topCell = selectedCellsMap.get(`${column},${row - 1}`);
      if (topCell) {
        topCell.element.setAttribute("data-selection-border-bottom", "");
      }
    }
  });
};

const NO_SELECTION = { selectedCells: [] };
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

    // Get cell information for each selected cell (simplified for border attributes)
    const cellInfos = Array.from(selectedCells).map((cell) => {
      const row = cell.closest("tr");
      const allRows = Array.from(table.querySelectorAll("tr"));
      const rowIndex = allRows.indexOf(row);
      const columnIndex = Array.from(row.children).indexOf(cell);

      return {
        element: cell,
        row: rowIndex,
        column: columnIndex,
      };
    });

    updateSelectionData({
      selectedCells: cellInfos,
    });
  };

  calculateSelectionData();

  update_on_selection_change: {
    // Set up MutationObserver to watch for aria-selected and drag state changes
    const mutationObserver = new MutationObserver(() => {
      calculateSelectionData();
    });

    mutationObserver.observe(table, {
      attributes: true,
      attributeFilter: ["aria-selected", "data-drag-selecting"],
      subtree: true,
    });

    cleanupCallbackSet.add(() => mutationObserver.disconnect());
  }

  update_on_dom_changes: {
    // Also listen to DOM changes that might affect cell structure
    const mutationObserver = new MutationObserver(() => {
      calculateSelectionData();
    });

    mutationObserver.observe(table, {
      childList: true,
      subtree: true,
    });

    cleanupCallbackSet.add(() => mutationObserver.disconnect());
  }

  update_on_window_resize: {
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
