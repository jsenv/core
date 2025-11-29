import { useMemo } from "preact/hooks";

/**
 * Custom hook for converting an array of objects into a 2D array of cell values.
 *
 * This hook is essential for table components that receive data as objects but need
 * to work with a 2D array structure for rendering and manipulation:
 *
 * 1. **Object to Array Conversion**: Extracts values from object properties based
 *    on column definitions, creating a consistent 2D array structure.
 *
 * 2. **Column Mapping**: Uses column names/keys to determine which object property
 *    corresponds to each column position.
 *
 * 3. **Missing Data Handling**: Provides fallback values when object properties
 *    don't exist for specific columns.
 *
 * 4. **Performance**: Memoized to avoid unnecessary recalculations when data
 *    or column definitions haven't changed.
 *
 * Common use case: Converting API response data (array of objects) into table-ready
 * format for rendering with existing cell management hooks.
 */

/**
 * Convert an array of objects into a 2D array of cell values
 * @param {Array<Object>} data - Array of objects to convert
 * @param {Array<Object>} columns - Column definitions
 * @param {string} columns[].key - Property key to extract from each object
 * @param {*} [columns[].defaultValue] - Default value when property is missing (optional)
 * @returns {Array<Array>} 2D array of cell values
 */
export const useObjectArrayToCells = (data, columns) => {
  // Convert object array to 2D cell values array
  const cellValues = useMemo(() => {
    return data.map((rowObject) =>
      columns.map((column) => {
        const value = rowObject[column.key];
        // Return the value if it exists, otherwise use default or empty string
        return value !== undefined ? value : (column.defaultValue ?? "");
      }),
    );
  }, [data, columns]);

  return cellValues;
};
