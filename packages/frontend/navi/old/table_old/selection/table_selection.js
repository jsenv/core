import { createContext } from "preact";
import { useMemo } from "preact/hooks";

export const TableSelectionContext = createContext();
export const useTableSelectionContextValue = (
  selection,
  selectionController,
) => {
  const selectionContextValue = useMemo(() => {
    const selectedColumnIds = [];
    const selectedRowIds = [];
    const selectedCellIds = [];
    const columnIdWithSomeSelectedCellSet = new Set();
    const rowIdWithSomeSelectedCellSet = new Set();
    for (const item of selection) {
      const selectionValueInfo = parseTableSelectionValue(item);
      if (selectionValueInfo.type === "row") {
        const { rowId } = selectionValueInfo;
        selectedRowIds.push(rowId);
        continue;
      }
      if (selectionValueInfo.type === "column") {
        const { columnId } = selectionValueInfo;
        selectedColumnIds.push(columnId);
        continue;
      }
      if (selectionValueInfo.type === "cell") {
        const { cellId, columnId, rowId } = selectionValueInfo;
        selectedCellIds.push(cellId);
        columnIdWithSomeSelectedCellSet.add(columnId);
        rowIdWithSomeSelectedCellSet.add(rowId);
        continue;
      }
    }
    return {
      selection,
      selectionController,
      selectedColumnIds,
      selectedRowIds,
      columnIdWithSomeSelectedCellSet,
      rowIdWithSomeSelectedCellSet,
    };
  }, [selection]);

  return selectionContextValue;
};

export const parseTableSelectionValue = (selectionValue) => {
  if (selectionValue.startsWith("column:")) {
    const columnId = selectionValue.slice("column:".length);
    return { type: "column", columnId };
  }
  if (selectionValue.startsWith("row:")) {
    const rowId = selectionValue.slice("row:".length);
    return { type: "row", rowId };
  }
  const cellId = selectionValue.slice("cell:".length);
  const [columnId, rowId] = cellId.split("-");
  return { type: "cell", cellId, columnId, rowId };
};
export const stringifyTableSelectionValue = (type, value) => {
  if (type === "cell") {
    const { columnId, rowId } = value;
    return `cell:${columnId}-${rowId}`;
  }
  if (type === "column") {
    return `column:${value}`;
  }
  if (type === "row") {
    return `row:${value}`;
  }
  return "";
};

/**
 * Check if a specific cell is selected
 * @param {Array} selection - The selection set or array
 * @param {{rowIndex: number, columnIndex: number}} cellPosition - Cell coordinates
 * @returns {boolean} True if the cell is selected
 */
export const isCellSelected = (selection, cellId) => {
  const cellSelectionValue = stringifyTableSelectionValue("cell", cellId);
  return selection.includes(cellSelectionValue);
};

/**
 * Check if a specific row is selected
 * @param {Array} selection - The selection set or array
 * @param {number} rowIndex - Row index
 * @returns {boolean} True if the row is selected
 */
export const isRowSelected = (selection, rowId) => {
  const rowSelectionValue = stringifyTableSelectionValue("row", rowId);
  return selection.includes(rowSelectionValue);
};

/**
 * Check if a specific column is selected
 * @param {Array} selection - The selection set or array
 * @param {number} columnIndex - Column index
 * @returns {boolean} True if the column is selected
 */
export const isColumnSelected = (selection, columnId) => {
  const columnSelectionValue = stringifyTableSelectionValue("column", columnId);
  return selection.has(columnSelectionValue);
};
