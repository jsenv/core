import { createContext } from "preact";
import { useContext, useMemo, useRef } from "preact/hooks";

const TableSizeContext = createContext();

export const TableSizeProvider = TableSizeContext.Provider;
export const useTableSizeContextValue = ({
  onColumnSizeChange,
  onRowSizeChange,
  columns,
  rows,
}) => {
  const onColumnSizeChangeRef = useRef();
  onColumnSizeChangeRef.current = onColumnSizeChange;
  const onRowSizeChangeRef = useRef();
  onRowSizeChangeRef.current = onRowSizeChange;

  const tableSizeContextValue = useMemo(() => {
    const onColumnSizeChangeWithColumn = (width, columnIndex) => {
      const column = columns[columnIndex];
      return onColumnSizeChangeRef.current?.(width, columnIndex, column);
    };

    const onRowSizeChangeWithRow = (height, rowIndex) => {
      const row = rows[rowIndex];
      return onRowSizeChangeRef.current?.(height, rowIndex, row);
    };

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
