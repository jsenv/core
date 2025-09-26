import { createContext } from "preact";
import { useContext, useMemo, useRef } from "preact/hooks";

const TableResizeContext = createContext();
export const TableResizeProvider = TableResizeContext.Provider;
export const useTableResize = () => {
  return useContext(TableResizeContext);
};
export const useTableResizeContextValue = ({
  onColumnResize,
  onRowResize,
  columnsRef,
  rowsRef,
}) => {
  const onColumnResizeRef = useRef();
  onColumnResizeRef.current = onColumnResize;
  const onRowResizeRef = useRef();
  onRowResizeRef.current = onRowResize;

  const resizeContextValue = useMemo(() => {
    const onColumnResizeWithColumn = (width, columnIndex) => {
      const columns = columnsRef.current;
      const column = columns[columnIndex];
      return onColumnResizeRef.current?.(width, columnIndex, column);
    };

    const onRowResizeWithRow = (height, rowIndex) => {
      const rows = rowsRef.current;
      const row = rows[rowIndex];
      return onRowResizeRef.current?.(height, rowIndex, row);
    };

    return {
      onColumnResize: onColumnResizeWithColumn,
      onRowResize: onRowResizeWithRow,
    };
  }, []);

  return resizeContextValue;
};
