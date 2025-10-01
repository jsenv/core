import { useMemo, useState } from "preact/hooks";

export const useCellsAndColumns = (cells, columns) => {
  const [columnIds, idToColumnMap] = useMemo(() => {
    const columnIds = [];
    const idToColumnMap = new Map();
    for (const column of columns) {
      const columnId = column.id;
      columnIds.push(columnId);
      idToColumnMap.set(columnId, column);
    }
    return [columnIds, idToColumnMap];
  }, [columns]);
  const [orderedAllColumnIds, setOrderedAllColumnIds] = useState(columnIds);
  const orderedColumnIds = [];
  for (const columnId of orderedAllColumnIds) {
    if (!columnIds.includes(columnId)) {
      // generated column (like the row column)
      continue;
    }
    orderedColumnIds.push(columnId);
  }
  const orderedColumns = [];
  for (const columnId of orderedColumnIds) {
    const column = idToColumnMap.get(columnId);
    orderedColumns.push(column);
  }

  // Base cell values in original column order (2D array: rows x columns)
  const [baseCells, setBaseCells] = useState(cells);
  // Memoized index mapping for performance - maps display index to original index
  const displayToOriginalIndexes = useMemo(() => {
    return orderedColumnIds.map((displayColId) => {
      const originalIndex = columnIds.indexOf(displayColId);
      return originalIndex >= 0 ? originalIndex : -1;
    });
  }, [columnIds, orderedColumnIds]);
  // Derived state: reorder cell values according to column display order
  const orderedCells = useMemo(() => {
    return baseCells.map((row) =>
      displayToOriginalIndexes.map((originalIndex) =>
        originalIndex >= 0 ? row[originalIndex] : "",
      ),
    );
  }, [baseCells, displayToOriginalIndexes]);
  const setCellValue = ({ rowIndex, columnIndex }, value) => {
    const originalColumnIndex = displayToOriginalIndexes[columnIndex];
    if (originalColumnIndex < 0) {
      console.warn(`Invalid column index: ${columnIndex}`);
      return;
    }
    setBaseCells((previousValues) => {
      return previousValues.map((row, currentRowIndex) =>
        currentRowIndex === rowIndex
          ? row.map((cell, currentColumnIndex) =>
              currentColumnIndex === originalColumnIndex ? value : cell,
            )
          : row,
      );
    });
  };

  return {
    cells: orderedCells,
    setCellValue,
    columns: orderedColumns,
    setColumnOrder: setOrderedAllColumnIds,
  };
};
