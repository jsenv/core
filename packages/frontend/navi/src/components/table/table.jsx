import { createContext } from "preact";
import { forwardRef } from "preact/compat";
import {
  useContext,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";

import { useKeyboardShortcuts } from "../keyboard_shortcuts/keyboard_shortcuts.js";
import { createSelectionKeyboardShortcuts } from "../selection/selection.jsx";
import { useFocusGroup } from "../use_focus_group.js";
import { TableDragCloneContainer } from "./drag/table_drag_clone_container.jsx";
import { TableColumnResizer, TableRowResizer } from "./resize/table_resize.jsx";
import {
  TableResizeProvider,
  useTableResizeContextValue,
} from "./resize/table_resize_context.js";
import {
  useTableSelection,
  useTableSelectionController,
} from "./selection/table_selection.js";
import { useStickyGroup } from "./sticky/sticky_group.js";
import { TableStickyFrontier } from "./sticky/table_sticky.jsx";
import {
  TableDragProvider,
  TableSelectionProvider,
  TableStickyProvider,
} from "./table_context.jsx";
import "./table_css.js";

const ColumnsRefContext = createContext();
const useColumns = () => useContext(ColumnsRefContext).current;
const ColumnContext = createContext();
const useColumn = () => useContext(ColumnContext);

const RowsRefContext = createContext();
const useRows = () => useContext(RowsRefContext).current;
const RowContext = createContext();
const useRow = () => useContext(RowContext);

const ColumnIndexContext = createContext();
const useColumnIndex = () => useContext(ColumnIndexContext);
const RowIndexContext = createContext();
const useRowIndex = () => useContext(RowIndexContext);

export const Table = forwardRef((props, ref) => {
  const {
    selection = [],
    selectionColor,
    onSelectionChange,
    onColumnResize,
    onRowResize,
    borderCollapse = true,
    stickyLeftFrontierColumnIndex = 0,
    onStickyLeftFrontierChange,
    stickyTopFrontierRowIndex = 0,
    onStickyTopFrontierChange,
    children,
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => {
    return innerRef.current;
  });
  const tableContainerRef = useRef();

  const tableRowIndexRef = useRef();
  tableRowIndexRef.current = -1;

  const columnsRef = useRef();
  columnsRef.current = [];

  const rowsRef = useRef();
  rowsRef.current = [];

  // selection
  const selectionController = useTableSelectionController({
    tableRef: innerRef,
    selection,
    onSelectionChange,
    selectionColor,
  });
  const {
    rowWithSomeSelectedCell,
    columnWithSomeSelectedCell,
    selectedRowIds,
  } = useTableSelection(selection);
  const selectionContextValue = {
    selectionController,
    rowWithSomeSelectedCell,
    columnWithSomeSelectedCell,
    selectedRowIds,
  };

  useFocusGroup(innerRef);

  // sticky
  useStickyGroup(tableContainerRef, { elementSelector: "table" });
  const stickyContextValue = {
    stickyLeftFrontierColumnIndex,
    stickyTopFrontierRowIndex,
    onStickyLeftFrontierChange,
    onStickyTopFrontierChange,
  };

  useKeyboardShortcuts(innerRef, [
    ...createSelectionKeyboardShortcuts(selectionController, {
      toggleEnabled: true,
    }),
    {
      key: "enter",
      description: "Edit table cell content",
      handler: () => {
        // Find the currently focused cell
        const activeCell = document.activeElement.closest("td");
        if (!activeCell) {
          return false;
        }
        activeCell.dispatchEvent(
          new CustomEvent("editrequested", { bubbles: false }),
        );
        return true;
      },
    },
    {
      key: "a-z",
      description: "Start editing table cell content",
      handler: (e) => {
        const activeCell = document.activeElement.closest("td");
        if (!activeCell) {
          return false;
        }
        activeCell.dispatchEvent(
          new CustomEvent("editrequested", {
            bubbles: false,
            detail: { initialValue: e.key },
          }),
        );
        return true;
      },
    },
  ]);

  // resize
  const resizeContextValue = useTableResizeContextValue({
    onColumnResize,
    onRowResize,
    columnsRef,
    rowsRef,
  });

  // drag columns
  const [grabTarget, setGrabTarget] = useState(null);
  const grabColumn = (columnIndex) => {
    setGrabTarget(`column:${columnIndex}`);
  };
  const releaseColumn = () => {
    setGrabTarget(null);
  };
  const dragContextValue = {
    grabTarget,
    grabColumn,
    releaseColumn,
  };

  return (
    <div ref={tableContainerRef} className="navi_table_container">
      <table
        ref={innerRef}
        className="navi_table"
        aria-multiselectable="true"
        data-multiselection={selection.length > 1 ? "" : undefined}
        data-border-collapse={borderCollapse ? "" : undefined}
      >
        <TableResizeProvider value={resizeContextValue}>
          <TableSelectionProvider value={selectionContextValue}>
            <TableDragProvider value={dragContextValue}>
              <TableStickyProvider value={stickyContextValue}>
                <ColumnsRefContext.Provider value={columnsRef}>
                  <RowIndexContext.Provider value={tableRowIndexRef}>
                    <RowsRefContext.Provider value={rowsRef}>
                      {children}
                    </RowsRefContext.Provider>
                  </RowIndexContext.Provider>
                </ColumnsRefContext.Provider>
              </TableStickyProvider>
            </TableDragProvider>
          </TableSelectionProvider>
        </TableResizeProvider>
      </table>
      <TableUIContainer>
        <TableDragCloneContainer dragging={Boolean(grabTarget)} />
        <TableColumnResizer />
        <TableRowResizer />
        <TableStickyFrontier />
      </TableUIContainer>
    </div>
  );
});
export const Colgroup = ({ children }) => {
  return <colgroup>{children}</colgroup>;
};
export const Col = ({ width }) => {
  const columns = useColumns();
  const columnIndex = columns.length;
  columns[columnIndex] = { width };
  return <col />;
};

const TableSectionContext = createContext();
const useIsInTableHead = () => useContext(TableSectionContext) === "head";
export const TableHead = ({ children }) => {
  return (
    <thead>
      <TableSectionContext.Provider value="head">
        {children}
      </TableSectionContext.Provider>
    </thead>
  );
};
export const TableBody = ({ children }) => {
  return (
    <tbody>
      <TableSectionContext.Provider value="body">
        {children}
      </TableSectionContext.Provider>
    </tbody>
  );
};

export const TableRow = ({ children, height }) => {
  const columns = useColumns();
  const rows = useRows();
  const rowIndex = rows.length;
  const row = { height };
  rows[rowIndex] = row;

  return (
    <tr>
      <RowContext.Provider value={row}>
        <RowIndexContext.Provider value={rowIndex}>
          {children.map((child, columnIndex) => {
            const column = columns[columnIndex];
            return (
              <ColumnIndexContext.Provider
                key={columnIndex}
                value={columnIndex}
              >
                <ColumnContext.Provider value={column}>
                  {child}
                </ColumnContext.Provider>
              </ColumnIndexContext.Provider>
            );
          })}
        </RowIndexContext.Provider>
      </RowContext.Provider>
    </tr>
  );
};
export const TableCell = ({ children }) => {
  const columnIndex = useColumnIndex();
  const rowIndex = useRowIndex();
  const column = useColumn();
  const row = useRow();
  const isInTableHead = useIsInTableHead();
  const TagName = isInTableHead ? "th" : "td";

  return (
    <TagName
      data-row-index={rowIndex}
      data-column-index={columnIndex}
      data-column-width={column.width}
      data-row-height={row.height}
    >
      {children}
    </TagName>
  );
};

// TODO: use a resize observer to keep it up-to-date
const TableUIContainer = ({ children }) => {
  const ref = useRef();

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const tableContainer = element.closest(".navi_table_container");
    element.style.setProperty(
      "--table-scroll-width",
      `${tableContainer.scrollWidth}px`,
    );
    element.style.setProperty(
      "--table-scroll-height",
      `${tableContainer.scrollHeight}px`,
    );
  }, []);

  return (
    <div ref={ref} className="navi_table_ui_container">
      {children}
    </div>
  );
};
