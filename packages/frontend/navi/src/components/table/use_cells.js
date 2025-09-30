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

/**
 * Custom hook for managing cell values with column reordering support
 * @param {Array<Array>} initialData - 2D array of cell values in original column order
 * @param {Object} options - Configuration options
 * @param {string[]} options.columnIds - Array of column IDs in original order
 * @param {string[]} options.columnOrderedIds - Array of column IDs in display order
 * @returns {[Array<Array>, Function, Function]} [cellValues, setCellValue, setBaseCellValues]
 */
export const useCells = (initialData, { columnIds, columnOrderedIds }) => {
  // Base cell values in original column order (2D array: rows x columns)
  const [baseCellValues, setBaseCellValues] = useState(initialData);

  // Memoized index mapping for performance - maps display index to original index
  const displayToOriginalIndexes = useMemo(() => {
    return columnOrderedIds.map((displayColId) => {
      const originalIndex = columnIds.indexOf(displayColId);
      return originalIndex >= 0 ? originalIndex : -1;
    });
  }, [columnIds, columnOrderedIds]);

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
  const setCellValue = (rowIndex, displayColumnIndex, value) => {
    const originalColumnIndex = displayToOriginalIndexes[displayColumnIndex];

    if (originalColumnIndex < 0) {
      console.warn(`Invalid column index: ${displayColumnIndex}`);
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

  return [cellValues, setCellValue, setBaseCellValues];
};
