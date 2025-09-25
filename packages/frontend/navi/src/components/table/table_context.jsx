import { createContext } from "preact";
import { useContext } from "preact/hooks";

const TableContext = createContext();
export const TableProvider = TableContext.Provider;
export const useTable = () => {
  return useContext(TableContext);
};

const TableColumnContext = createContext();
export const TableColumnProvider = TableColumnContext.Provider;
export const useTableColumn = () => {
  return useContext(TableColumnContext);
};

const TableRowContext = createContext();
export const TableRowProvider = TableRowContext.Provider;
export const useTableRow = () => {
  return useContext(TableRowContext);
};

const TableStickyContext = createContext();
export const TableStickyProvider = TableStickyContext.Provider;
export const useTableSticky = () => {
  return useContext(TableStickyContext);
};
