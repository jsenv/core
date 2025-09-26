import { createContext } from "preact";
import { useContext } from "preact/hooks";

const TableContext = createContext();
export const TableProvider = TableContext.Provider;
export const useTable = () => {
  return useContext(TableContext);
};

const TableHeadContext = createContext();
export const TableHeadProvider = TableHeadContext.Provider;
export const useTableHead = () => {
  return useContext(TableHeadContext);
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

const TableSelectionContext = createContext();
export const TableSelectionProvider = TableSelectionContext.Provider;
export const useTableSelection = () => {
  return useContext(TableSelectionContext);
};

const TableStickyContext = createContext();
export const TableStickyProvider = TableStickyContext.Provider;
export const useTableSticky = () => {
  return useContext(TableStickyContext);
};

const TableDragContext = createContext();
export const TableDragProvider = TableDragContext.Provider;
export const useTableDrag = () => {
  return useContext(TableDragContext);
};
