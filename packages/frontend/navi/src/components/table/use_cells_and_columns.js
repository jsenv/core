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
  const columnOrderedIndexMap = useMemo(() => {
    const indexMap = new Map();
    for (let columnIndex = 0; columnIndex < columnIds.length; columnIndex++) {
      const columnIdAtThisIndex = orderedColumnIds[columnIndex];
      const originalIndex = columnIds.indexOf(columnIdAtThisIndex);
      indexMap.set(columnIndex, originalIndex);
    }
    return indexMap;
  }, [columnIds, orderedColumnIds]);

  // Derived state: reorder cell values according to column display order
  const orderedCells = useMemo(() => {
    const reorderedCells = [];
    for (let y = 0; y < baseCells.length; y++) {
      const originalRow = baseCells[y];
      const reorderedRow = [];
      for (let x = 0; x < orderedColumnIds.length; x++) {
        const columnOrderedIndex = columnOrderedIndexMap.get(x);
        const cellValue = originalRow[columnOrderedIndex];
        reorderedRow.push(cellValue);
      }
      reorderedCells.push(reorderedRow);
    }
    return reorderedCells;
  }, [baseCells, columnOrderedIndexMap, orderedColumnIds.length]);

  const setCellValue = ({ rowIndex, columnIndex }, value) => {
    const originalColumnIndex = columnOrderedIndexMap.get(columnIndex);
    if (originalColumnIndex === undefined) {
      console.warn(`Invalid column index: ${columnIndex}`);
      return;
    }
    setBaseCells((previousCells) => {
      const newCells = [];
      for (let y = 0; y < previousCells.length; y++) {
        const currentRow = previousCells[y];
        if (y !== rowIndex) {
          newCells.push(currentRow);
          continue;
        }
        const newRow = [];
        for (let x = 0; x < currentRow.length; x++) {
          const cellValue = x === originalColumnIndex ? value : currentRow[x];
          newRow.push(cellValue);
        }
        newCells.push(newRow);
      }
      return newCells;
    });
  };

  return {
    cells: orderedCells,
    setCellValue,
    columns: orderedColumns,
    setColumnOrder: setOrderedAllColumnIds,
  };
};
