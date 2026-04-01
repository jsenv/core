import { useMemo, useRef, useState } from "preact/hooks";

export const useRowsAsGrid = (initialRows, properties) => {
  const [rows, setRows] = useState(initialRows);
  const cellGrid = [];
  for (const object of rows) {
    const cellRow = [];
    for (const prop of properties) {
      const cell = object[prop];
      cellRow.push(cell);
    }
    cellGrid.push(cellRow);
  }

  const methodsRef = useRef(null);
  const propertiesRef = useRef(properties);
  propertiesRef.current = properties;
  let methods = methodsRef.current;
  if (!methods) {
    const setCell = ({ rowIndex, columnIndex }, value) => {
      const properties = propertiesRef.current;
      const prop = properties[columnIndex];
      setRows((prev) => {
        const resolved = rowIndex < 0 ? prev.length + rowIndex : rowIndex;
        if (resolved < 0 || resolved >= prev.length) return prev;
        const result = [];
        let i = 0;
        while (i < prev.length) {
          if (i === resolved) {
            result.push({ ...prev[i], [prop]: value });
          } else {
            result.push(prev[i]);
          }
          i++;
        }
        return result;
      });
    };
    const addRow = (newRow, rowIndex = rows.length) => {
      setRows((prev) => {
        // negative counts from end, beyond length appends — like splice
        let insertAt = rowIndex < 0 ? prev.length + rowIndex : rowIndex;
        if (insertAt < 0) insertAt = 0;
        if (insertAt > prev.length) insertAt = prev.length;
        const result = [];
        let i = 0;
        while (i < prev.length) {
          if (i === insertAt) {
            result.push(newRow);
          }
          result.push(prev[i]);
          i++;
        }
        if (insertAt === prev.length) {
          result.push(newRow);
        }
        return result;
      });
    };
    const deleteRow = (rowIndex) => {
      setRows((prev) => {
        const resolved = rowIndex < 0 ? prev.length + rowIndex : rowIndex;
        if (resolved < 0 || resolved >= prev.length) return prev;
        const result = [];
        let i = 0;
        while (i < prev.length) {
          if (i !== resolved) {
            result.push(prev[i]);
          }
          i++;
        }
        return result;
      });
    };
    methods = methodsRef.current = {
      setCell,
      addRow,
      deleteRow,
    };
  }
  const { setCell, addRow, deleteRow } = methods;
  return { cellGrid, setCell, addRow, deleteRow };
};

export const useCellsAndColumns = (
  cellGrid,
  columns,
  { columnIdKey = "id" } = {},
) => {
  const [columnIds, idToColumnMap] = useMemo(() => {
    const columnIds = [];
    const idToColumnMap = new Map();
    for (const column of columns) {
      const columnId = column[columnIdKey];
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
    for (let y = 0; y < cellGrid.length; y++) {
      const originalRow = cellGrid[y];
      const reorderedRow = [];
      for (let x = 0; x < orderedColumnIds.length; x++) {
        const columnOrderedIndex = columnOrderedIndexMap.get(x);
        const cellValue = originalRow[columnOrderedIndex];
        reorderedRow.push(cellValue);
      }
      reorderedCells.push(reorderedRow);
    }
    return reorderedCells;
  }, [cellGrid, columnOrderedIndexMap, orderedColumnIds.length]);

  // const setCellValue = ({ columnIndex, rowIndex }, value) => {
  //   const originalColumnIndex = columnOrderedIndexMap.get(columnIndex);
  //   if (originalColumnIndex === undefined) {
  //     console.warn(`Invalid column index: ${columnIndex}`);
  //     return;
  //   }
  //   setCellGrid((previousCells) => {
  //     const newCells = [];
  //     for (let y = 0; y < previousCells.length; y++) {
  //       const currentRow = previousCells[y];
  //       if (y !== rowIndex) {
  //         newCells.push(currentRow);
  //         continue;
  //       }
  //       const newRow = [];
  //       for (let x = 0; x < currentRow.length; x++) {
  //         const cellValue = x === originalColumnIndex ? value : currentRow[x];
  //         newRow.push(cellValue);
  //       }
  //       newCells.push(newRow);
  //     }
  //     return newCells;
  //   });
  // };

  return {
    cells: orderedCells,
    columns: orderedColumns,
    setColumnOrder: setOrderedAllColumnIds,
  };
};
