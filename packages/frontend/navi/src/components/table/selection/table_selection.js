import { useLayoutEffect, useMemo } from "preact/hooks";

import { useSelectionController } from "../../selection/selection.jsx";

import.meta.css = /* css */ `
  .navi_table_container {
    --selection-border-color: #0078d4;
    --selection-background-color: #eaf1fd;
  }

  .navi_table th[aria-selected="true"],
  .navi_table td[aria-selected="true"] {
    background-color: var(--selection-background-color);
  }
  td[data-row-contains-selected] {
    position: relative;
    font-weight: 500;
    color: #444;
  }

  th[data-column-contains-selected] {
    position: relative;
    font-weight: bold;
    color: #444;
  }

  .navi_table [data-selection-border-top]::after {
    box-shadow: inset 0 1px 0 0 var(--selection-border-color);
  }

  .navi_table [data-selection-border-right]::after {
    box-shadow: inset -1px 0 0 0 var(--selection-border-color);
  }

  .navi_table [data-selection-border-bottom]::after {
    box-shadow: inset 0 -1px 0 0 var(--selection-border-color);
  }

  .navi_table [data-selection-border-left]::after {
    box-shadow: inset 1px 0 0 0 var(--selection-border-color);
  }

  /* Two border combinations */
  .navi_table [data-selection-border-top][data-selection-border-right]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color);
  }

  .navi_table [data-selection-border-top][data-selection-border-bottom]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  .navi_table [data-selection-border-top][data-selection-border-left]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }

  .navi_table
    [data-selection-border-right][data-selection-border-bottom]::after {
    box-shadow:
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  .navi_table [data-selection-border-right][data-selection-border-left]::after {
    box-shadow:
      inset -1px 0 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }

  .navi_table
    [data-selection-border-bottom][data-selection-border-left]::after {
    box-shadow:
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }

  /* Three border combinations */
  .navi_table
    [data-selection-border-top][data-selection-border-right][data-selection-border-bottom]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  .navi_table
    [data-selection-border-top][data-selection-border-bottom][data-selection-border-left]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }

  .navi_table
    [data-selection-border-top][data-selection-border-right][data-selection-border-left]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }

  .navi_table
    [data-selection-border-right][data-selection-border-bottom][data-selection-border-left]::after {
    box-shadow:
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }

  /* Four border combinations (full selection) */
  .navi_table
    [data-selection-border-top][data-selection-border-right][data-selection-border-bottom][data-selection-border-left]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }
`;

export const useTableSelectionController = ({
  tableRef,
  selection,
  onSelectionChange,
  selectionColor,
}) => {
  const selectionController = useSelectionController({
    elementRef: tableRef,
    layout: "grid",
    value: selection,
    onChange: (value) => {
      onSelectionChange(value);
    },
    selectAllName: "cell",
  });

  useLayoutEffect(() => {
    const table = tableRef.current;
    if (table) {
      updateSelectionBorders(table, selectionController);
    }
  }, [selectionController.value]);

  useLayoutEffect(() => {
    if (selectionColor) {
      tableRef.current?.style.setProperty(
        "--selection-border-color",
        selectionColor,
      );
    }
  }, [selectionColor]);

  return selectionController;
};

const updateSelectionBorders = (tableElement, selectionController) => {
  // Find all selected cells
  const cells = Array.from(tableElement.querySelectorAll("th, td"));
  const selectedCells = [];
  for (const cell of cells) {
    if (selectionController.isElementSelected(cell)) {
      selectedCells.push(cell);
    }
  }

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

  const cellPositions = selectedCells.map((cell) => {
    const row = cell.parentElement;
    const allRows = Array.from(tableElement.querySelectorAll("tr"));
    return {
      element: cell,
      rowIndex: allRows.indexOf(row),
      columnIndex: Array.from(row.children).indexOf(cell),
    };
  });

  // Create a set for fast lookup of selected cell positions
  const selectedPositions = new Set(
    cellPositions.map((pos) => `${pos.rowIndex},${pos.columnIndex}`),
  );

  // Apply selection borders based on actual neighbors (for proper L-shaped selection support)
  cellPositions.forEach(({ element, rowIndex, columnIndex }) => {
    // Top border: if cell above is NOT selected or doesn't exist
    const cellAbove = `${rowIndex - 1},${columnIndex}`;
    if (!selectedPositions.has(cellAbove)) {
      element.setAttribute("data-selection-border-top", "");
    }

    // Bottom border: if cell below is NOT selected or doesn't exist
    const cellBelow = `${rowIndex + 1},${columnIndex}`;
    if (!selectedPositions.has(cellBelow)) {
      element.setAttribute("data-selection-border-bottom", "");
    }

    // Left border: if cell to the left is NOT selected or doesn't exist
    const cellLeft = `${rowIndex},${columnIndex - 1}`;
    if (!selectedPositions.has(cellLeft)) {
      element.setAttribute("data-selection-border-left", "");
    }

    // Right border: if cell to the right is NOT selected or doesn't exist
    const cellRight = `${rowIndex},${columnIndex + 1}`;
    if (!selectedPositions.has(cellRight)) {
      element.setAttribute("data-selection-border-right", "");
    }
  });
};

export const parseTableSelectionValue = (selectionValue) => {
  if (selectionValue.startsWith("cell:")) {
    const [cellRowIndex, cellColumnIndex] = selectionValue
      .slice("cell:".length)
      .split("-");
    return {
      type: "cell",
      rowIndex: Number(cellRowIndex),
      columnIndex: Number(cellColumnIndex),
    };
  }
  if (selectionValue.startsWith("row:")) {
    const rowIndex = selectionValue.slice("row:".length);
    return { type: "row", rowIndex: Number(rowIndex) };
  }
  if (selectionValue.startsWith("column:")) {
    const columnIndex = selectionValue.slice("column:".length);
    return { type: "column", columnIndex: Number(columnIndex) };
  }
  return { type: "unknown" };
};
export const stringifyTableSelectionValue = (type, value) => {
  if (type === "cell") {
    const { rowIndex, columnIndex } = value;
    return `cell:${rowIndex}-${columnIndex}`;
  }
  if (type === "row") {
    return `row:${value}`;
  }
  if (type === "column") {
    return `column:${value}`;
  }
  return "";
};

export const useTableSelectionData = (selection) => {
  const {
    rowWithSomeSelectedCell,
    columnWithSomeSelectedCell,
    selectedRowIndexes,
  } = useMemo(() => {
    const columnWithSomeSelectedCell = [];
    const rowWithSomeSelectedCell = [];
    const selectedColumnIndexes = [];
    const selectedRowIndexes = [];

    for (const item of selection) {
      const selectionValueInfo = parseTableSelectionValue(item);
      if (selectionValueInfo.type === "row") {
        const { rowIndex } = selectionValueInfo;
        selectedRowIndexes.push(rowIndex);
        continue;
      }
      if (selectionValueInfo.type === "column") {
        const { columnIndex } = selectionValueInfo;
        selectedColumnIndexes.push(columnIndex);
        continue;
      }
      if (selectionValueInfo.type === "cell") {
        const { columnIndex, rowIndex } = selectionValueInfo;
        // Add to some-selected tracking
        if (!columnWithSomeSelectedCell.includes(columnIndex)) {
          columnWithSomeSelectedCell.push(columnIndex);
        }
        if (!rowWithSomeSelectedCell.includes(rowIndex)) {
          rowWithSomeSelectedCell.push(rowIndex);
        }
      }
    }

    return {
      columnWithSomeSelectedCell,
      rowWithSomeSelectedCell,
      selectedColumnIndexes,
      selectedRowIndexes,
    };
  }, [selection]);

  return {
    columnWithSomeSelectedCell,
    rowWithSomeSelectedCell,
    selectedRowIndexes,
  };
};
