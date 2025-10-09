import { createContext } from "preact";
import { useContext, useMemo } from "preact/hooks";

import { useStableCallback } from "../../use_stable_callback.js";

const TableSizeContext = createContext();

export const TableSizeProvider = TableSizeContext.Provider;
export const useTableSizeContextValue = ({
  onColumnSizeChange,
  onRowSizeChange,
  columns,
  rows,
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
    };
  }, []);

  return tableSizeContextValue;
};

export const useTableSize = () => {
  return useContext(TableSizeContext);
};
