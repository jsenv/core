import { createContext } from "preact";
import { useContext, useMemo } from "preact/hooks";

const TableSelectionContext = createContext();
export const TableSelectionProvider = TableSelectionContext.Provider;
export const useTableSelectionContextValue = (
  selection,
  selectionController,
) => {
  const selectionContextValue = useMemo(() => {
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
      selection,
      selectionController,
      columnWithSomeSelectedCell,
      rowWithSomeSelectedCell,
      selectedColumnIndexes,
      selectedRowIndexes,
    };
  }, [selection]);

  return selectionContextValue;
};
export const useTableSelection = () => {
  return useContext(TableSelectionContext);
};

export const parseTableSelectionValue = (selectionValue) => {
  if (selectionValue.startsWith("row:")) {
    const rowIndex = selectionValue.slice("row:".length);
    return { type: "row", rowIndex: Number(rowIndex) };
  }
  if (selectionValue.startsWith("column:")) {
    const columnIndex = selectionValue.slice("column:".length);
    return { type: "column", columnIndex: Number(columnIndex) };
  }
  const [cellRowIndex, cellColumnIndex] = selectionValue.split("-");
  return {
    type: "cell",
    rowIndex: Number(cellRowIndex),
    columnIndex: Number(cellColumnIndex),
  };
};
export const stringifyTableSelectionValue = (type, value) => {
  if (type === "cell") {
    const { rowIndex, columnIndex } = value;
    return `${rowIndex}-${columnIndex}`;
  }
  if (type === "row") {
    return `row:${value}`;
  }
  if (type === "column") {
    return `column:${value}`;
  }
  return "";
};

/**
 * Check if a specific cell is selected
 * @param {Array} selection - The selection set or array
 * @param {{rowIndex: number, columnIndex: number}} cellPosition - Cell coordinates
 * @returns {boolean} True if the cell is selected
 */
export const isCellSelected = (selection, { rowIndex, columnIndex }) => {
  const cellSelectionValue = stringifyTableSelectionValue("cell", {
    rowIndex,
    columnIndex,
  });

  return selection.includes(cellSelectionValue);
};

/**
 * Check if a specific row is selected
 * @param {Array} selection - The selection set or array
 * @param {number} rowIndex - Row index
 * @returns {boolean} True if the row is selected
 */
export const isRowSelected = (selection, rowIndex) => {
  const rowSelectionValue = stringifyTableSelectionValue("row", rowIndex);
  return selection.includes(rowSelectionValue);
};

/**
 * Check if a specific column is selected
 * @param {Array} selection - The selection set or array
 * @param {number} columnIndex - Column index
 * @returns {boolean} True if the column is selected
 */
export const isColumnSelected = (selection, columnIndex) => {
  const columnSelectionValue = stringifyTableSelectionValue(
    "column",
    columnIndex,
  );
  return selection.has(columnSelectionValue);
};
