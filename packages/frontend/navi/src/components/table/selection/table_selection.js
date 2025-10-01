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
