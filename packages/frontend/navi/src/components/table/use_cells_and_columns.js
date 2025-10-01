import { useMemo, useState } from "preact/hooks";

export const useCellsAndColumns = (columns, cells) => {
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
  const [baseCellValues, setBaseCellValues] = useState(cells);

  // Memoized index mapping for performance - maps display index to original index
  const displayToOriginalIndexes = useMemo(() => {
    return orderedColumnIds.map((displayColId) => {
      const originalIndex = columnIds.indexOf(displayColId);
      return originalIndex >= 0 ? originalIndex : -1;
    });
  }, [columnIds, orderedColumnIds]);

  // Derived state: reorder cell values according to column display order
  const cellValues = useMemo(() => {
    return baseCellValues.map((row) =>
      displayToOriginalIndexes.map((originalIndex) =>
        originalIndex >= 0 ? row[originalIndex] : "",
      ),
    );
  }, [baseCellValues, displayToOriginalIndexes]);

  /**
   * Update a specific cell value
   * @param {number} rowIndex - Row index (0-based)
   * @param {number} displayColumnIndex - Column index in display order (0-based)
   * @param {*} value - New cell value
   */
  const setCellValue = ({ rowIndex, columnIndex }, value) => {
    const originalColumnIndex = displayToOriginalIndexes[columnIndex];

    if (originalColumnIndex < 0) {
      console.warn(`Invalid column index: ${columnIndex}`);
      return;
    }

    setBaseCellValues((previousValues) => {
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
    cells: cellValues,
    setCellValue,
    columns: orderedColumns,
    setColumnOrder: setOrderedAllColumnIds,
  };
};
