import { createContext } from "preact";
import { useMemo } from "preact/hooks";

import { useStableCallback } from "../../../utils/use_stable_callback.js";

export const TableSizeContext = createContext();

export const useTableSizeContextValue = ({
  onColumnSizeChange,
  onRowSizeChange,
  columns,
  rows,
  columnResizerRef,
  rowResizerRef,
}) => {
  onColumnSizeChange = useStableCallback(onColumnSizeChange);
  onRowSizeChange = useStableCallback(onRowSizeChange);

  const tableSizeContextValue = useMemo(() => {
    const onColumnSizeChangeWithColumn = onColumnSizeChange
      ? (width, columnIndex) => {
          const column = columns[columnIndex];
          return onColumnSizeChange(width, columnIndex, column);
        }
      : onColumnSizeChange;

    const onRowSizeChangeWithRow = onRowSizeChange
      ? (height, rowIndex) => {
          const row = rows[rowIndex];
          return onRowSizeChange(height, rowIndex, row);
        }
      : onRowSizeChange;

    return {
      onColumnSizeChange: onColumnSizeChangeWithColumn,
      onRowSizeChange: onRowSizeChangeWithRow,
      columnResizerRef,
      rowResizerRef,
    };
  }, []);

  return tableSizeContextValue;
};
