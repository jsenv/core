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
 * Apply data attributes to control border colors for selection perimeter only
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

  // Apply border attributes only for perimeter borders
  selectedCells.forEach((cell) => {
    const { element, row, column } = cell;

    // Check neighboring cells to determine if this cell is on the perimeter
    const hasTopNeighbor = isCellSelected(column, row - 1);
    const hasBottomNeighbor = isCellSelected(column, row + 1);
    const hasLeftNeighbor = isCellSelected(column - 1, row);
    const hasRightNeighbor = isCellSelected(column + 1, row);

    // PERIMETER BORDER LOGIC: Only color borders where there's no selected neighbor
    // This creates the selection outline/perimeter

    // Top border: Color if no selected cell above (perimeter edge)
    if (!hasTopNeighbor) {
      // Determine which cell should have the colored border based on CSS ownership
      if (row === 0) {
        // First row: this cell owns its top border
        element.setAttribute("data-selection-border-top", "");
      } else {
        // Not first row: this cell doesn't own top border in CSS, but it's still the perimeter
        // We still color this cell's top border for visual perimeter
        element.setAttribute("data-selection-border-top", "");
      }
    }

    // Bottom border: Color if no selected cell below (perimeter edge)
    if (!hasBottomNeighbor) {
      // All cells own their bottom border, so color this cell's bottom border
      element.setAttribute("data-selection-border-bottom", "");
    }

    // Left border: Color if no selected cell to the left (perimeter edge)
    if (!hasLeftNeighbor) {
      // Determine which cell should have the colored border based on CSS ownership
      if (column === 0) {
        // First column: this cell owns its left border
        element.setAttribute("data-selection-border-left", "");
      } else {
        // Not first column: this cell doesn't own left border in CSS, but it's still the perimeter
        // We still color this cell's left border for visual perimeter
        element.setAttribute("data-selection-border-left", "");
      }
    }

    // Right border: Color if no selected cell to the right (perimeter edge)
    if (!hasRightNeighbor) {
      // All cells own their right border, so color this cell's right border
      element.setAttribute("data-selection-border-right", "");
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
