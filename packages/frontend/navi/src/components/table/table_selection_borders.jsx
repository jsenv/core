import { useLayoutEffect } from "preact/hooks";

// Table selection border helpers
const createTableSelectionObserver = (tableElement) => {
  const updateSelectionBorders = () => {
    // Find all selected cells
    const selectedCells = tableElement.querySelectorAll(
      'td[aria-selected="true"], th[aria-selected="true"]',
    );

    // Clear all existing selection border attributes
    tableElement
      .querySelectorAll(
        "[data-selection-border-top], [data-selection-border-right], [data-selection-border-bottom], [data-selection-border-left]",
      )
      .forEach((cell) => {
        cell.removeAttribute("data-selection-border-top");
        cell.removeAttribute("data-selection-border-right");
        cell.removeAttribute("data-selection-border-bottom");
        cell.removeAttribute("data-selection-border-left");
      });

    if (selectedCells.length === 0) {
      return;
    }

    // Convert NodeList to array and get cell positions
    const cellsArray = Array.from(selectedCells);
    const cellPositions = cellsArray.map((cell) => {
      const row = cell.parentElement;
      return {
        element: cell,
        rowIndex: Array.from(row.parentElement.children).indexOf(row),
        columnIndex: Array.from(row.children).indexOf(cell),
      };
    });

    // Calculate selection bounds
    const rowIndices = cellPositions.map((pos) => pos.rowIndex);
    const columnIndices = cellPositions.map((pos) => pos.columnIndex);
    const minRow = Math.min(...rowIndices);
    const maxRow = Math.max(...rowIndices);
    const minColumn = Math.min(...columnIndices);
    const maxColumn = Math.max(...columnIndices);

    // Check if border-collapse mode is enabled
    // const isBorderCollapse = tableElement.hasAttribute("data-border-collapse");

    // Apply selection borders based on position in selection rectangle
    cellPositions.forEach(({ element, rowIndex, columnIndex }) => {
      // Top border: if cell is at top of selection
      if (rowIndex === minRow) {
        element.setAttribute("data-selection-border-top", "");
      }

      // Bottom border: if cell is at bottom of selection
      if (rowIndex === maxRow) {
        element.setAttribute("data-selection-border-bottom", "");
      }

      // Left border: if cell is at left of selection
      if (columnIndex === minColumn) {
        element.setAttribute("data-selection-border-left", "");
      }

      // Right border: if cell is at right of selection
      if (columnIndex === maxColumn) {
        element.setAttribute("data-selection-border-right", "");
      }

      // In border-collapse mode, we may need to adjust internal borders
      // For now, keeping it simple with just perimeter borders
    });
  };

  const observer = new MutationObserver((mutations) => {
    let shouldUpdate = false;

    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected"
      ) {
        shouldUpdate = true;
      }
    });

    if (shouldUpdate) {
      updateSelectionBorders();
      if (observer.onChange) {
        observer.onChange();
      }
    }
  });

  // Initial update
  updateSelectionBorders();

  // Start observing
  observer.observe(tableElement, {
    attributes: true,
    attributeFilter: ["aria-selected"],
    subtree: true,
  });

  return {
    onChange: null,
    disconnect: () => observer.disconnect(),
  };
};

export const TableSelectionBorders = ({ tableRef }) => {
  useLayoutEffect(() => {
    const tableSelectionObserver = createTableSelectionObserver(
      tableRef.current,
    );

    return () => {
      tableSelectionObserver.disconnect();
    };
  }, [tableRef]);

  return null;
};
