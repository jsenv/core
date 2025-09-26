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
  columns,
  rows,
}) => {
  const columnsRef = useRef();
  columnsRef.current = columns;
  const rowsRef = useRef();
  rowsRef.current = rows;
  const onColumnResizeRef = useRef();
  onColumnResizeRef.current = onColumnResize;
  const onRowResizeRef = useRef();
  onRowResizeRef.current = onRowResize;

  const resizeContextValue = useMemo(() => {
    const onColumnResizeWithColumn = (width, columnIndex) => {
      const columns = columnsRef.current;
      return onColumnResizeRef.current?.(
        width,
        columnIndex,
        columns[columnIndex],
      );
    };

    const onRowResizeWithRow = (height, rowIndex) => {
      const rows = rowsRef.current;
      return onRowResizeRef.current?.(height, rowIndex, rows[rowIndex]);
    };

    return {
      onColumnResize: onColumnResizeWithColumn,
      onRowResize: onRowResizeWithRow,
    };
  }, []);

  return resizeContextValue;
};
