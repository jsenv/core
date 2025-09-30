import { useMemo, useState } from "preact/hooks";

/**
 * Custom hook for managing cell values with column reordering support.
 *
 * This hook is needed because maintaining cell values in sync with column reordering
 * is surprisingly complex:
 *
 * 1. **Two coordinate systems**: We need to track both the "original" column order
 *    (how data was initially provided) and the "display" column order (how columns
 *    are currently arranged).
 *
 * 2. **Mapping between orders**: When updating a cell at display position [row, col],
 *    we need to map that back to the original position for data storage.
 *
 * 3. **Efficient re-sorting**: When column order changes, we need to re-sort all
 *    cell values without losing any data or triggering unnecessary re-renders.
 *
 * 4. **Performance**: Using derived state (useMemo) rather than effects to avoid
 *    async state updates and ensure consistency.
 *
 * Without this hook, components would need to manually handle the complex mapping
 * between display order and storage order every time they read or write cell values.
 */

// Custom hook for managing cell values with column reordering support
export const useCells = (initialData, { columnIds, columnOrder }) => {
  // Base cell values in original column order (2D array: rows x columns)
  const [baseCellValues, setBaseCellValues] = useState(initialData);

  // Derived state: sort cell values according to column order
  const cellValues = useMemo(() => {
    return baseCellValues.map((row) =>
      columnOrder.map((colId) => {
        const originalColIndex = columnIds.findIndex((id) => id === colId);
        return originalColIndex >= 0 ? row[originalColIndex] : "";
      }),
    );
  }, [baseCellValues, columnOrder, columnIds]);

  // Update a specific cell value
  const setCellValue = (dataRowIndex, sortedColumnIndex, value) => {
    // Find the original column index from the sorted column index
    const sortedColId = columnOrder[sortedColumnIndex];
    const originalColIndex = columnIds.findIndex((id) => id === sortedColId);

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
