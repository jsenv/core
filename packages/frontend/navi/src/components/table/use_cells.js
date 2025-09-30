import { useMemo, useState } from "preact/hooks";

// Custom hook for managing cell values with column reordering support
export const useCells = (initialData, { columnOrder }) => {
  // Base cell values in original column order
  const [baseCellValues, setBaseCellValues] = useState(() => {
    const allValues = [];
    for (const rowCells of initialData) {
      allValues.push(...rowCells);
    }
    return allValues;
  });

  // Derived state: sort cell values according to column order
  const cellValues = useMemo(() => {
    return baseCellValues.map((row) =>
      columnOrder.map((colId) => {
        const originalColIndex = columns.findIndex((col) => col.id === colId);
        return originalColIndex >= 0 ? row[originalColIndex] : "";
      }),
    );
  }, [baseCellValues, columnOrder]);

  // Update a specific cell value
  const setCellValue = (dataRowIndex, sortedColumnIndex, value) => {
    // Find the original column index from the sorted column index
    const sortedColId = columnOrder[sortedColumnIndex];
    const originalColIndex = columns.findIndex((col) => col.id === sortedColId);

    if (originalColIndex >= 0) {
      console.log(
        "update cell value at",
        `${sortedColumnIndex}:${dataRowIndex} (original: ${originalColIndex}:${dataRowIndex})`,
        "to",
        value,
      );
      setBaseCellValues((prevValues) => {
        const newValues = prevValues.map((row, rowIdx) =>
          rowIdx === dataRowIndex
            ? row.map((cell, colIdx) =>
                colIdx === originalColIndex ? value : cell,
              )
            : [...row],
        );
        return newValues;
      });
    }
  };

  return [
    cellValues,
    setCellValue,
    setBaseCellValues, // For direct updates like demo edit
  ];
};
