/**
 * Table Component with Custom Border and Selection System
 *
 * PROBLEM: We want to draw selected table cells with a clear visual perimeter
 *
 * ATTEMPTED SOLUTIONS & THEIR ISSUES:
 *
 * 1. Drawing selection outside the table:
 *    - z-index issues: Hard to ensure selection appears above all table elements
 *    - Performance issues: Constant recalculation during resizing, scrolling, etc.
 *    - Positioning complexity: Managing absolute positioning relative to table cells
 *
 * 2. Using native CSS table cell borders:
 *    - Border rendering artifacts: CSS borders are not rendered as straight lines,
 *      making selection perimeter imperfect (especially with thick borders)
 *    - Border-collapse compatibility: Native border-collapse causes sticky elements
 *      to lose borders while scrolling in some browsers
 *    - Dimension changes: Custom border-collapse (manually disabling adjacent borders)
 *      changes cell dimensions, making selection outline visible and inconsistent
 *
 * SOLUTION: Custom border system using box-shadow
 *
 * KEY PRINCIPLES:
 * - Use inset box-shadow to ensure borders appear above table cell backgrounds
 * - Use ::before pseudo-elements with position: absolute for flexible positioning
 * - Each cell draws its own borders independently (no border-collapse by default)
 * - Selection borders override table borders using higher CSS specificity
 * - Sticky borders use thicker box-shadows in accent color (yellow)
 *
 * TECHNICAL IMPLEMENTATION:
 * - All borders use inset box-shadow with specific directional mapping:
 *   * Top: inset 0 1px 0 0
 *   * Right: inset -1px 0 0 0
 *   * Bottom: inset 0 -1px 0 0
 *   * Left: inset 1px 0 0 0
 * - Selection borders (blue) override table borders (red) in same pseudo-element
 * - Sticky borders replace regular borders with thicker colored variants
 * - Border-collapse mode available as optional feature for future use
 *
 * Note how border disappear for sticky elements when using border-collapse (https://bugzilla.mozilla.org/show_bug.cgi?id=1727594)
 *
 * Next steps:
 *
 * - Finir vrai exemple de re-order de column (mise a jour du state + effet au survol)
 * - Can add a column (+ button at the end of table headers)
 * - Can add a row (+ button at the end of the row number column )
 * - Delete a row (how?)
 * - Delete a column (how?)
 * - Rename a column (I guess with enter, double click, A-Z keys)
 * - Update table column info (I guess a down arrow icon which opens a meny when clicked for instance)
 */

import { createContext } from "preact";
import { forwardRef } from "preact/compat";
import {
  useContext,
  useImperativeHandle,
  useRef,
  useState,
} from "preact/hooks";

import { Editable, useEditionController } from "../edition/editable.jsx";
import { useKeyboardShortcuts } from "../keyboard_shortcuts/keyboard_shortcuts.js";
import {
  createSelectionKeyboardShortcuts,
  useSelectableElement,
} from "../selection/selection.jsx";
import { useFocusGroup } from "../use_focus_group.js";
import {
  TableCellColumnResizeHandles,
  TableCellRowResizeHandles,
} from "./resize/table_resize.jsx";
import {
  TableResizeProvider,
  useTableResizeContextValue,
} from "./resize/table_resize_context.js";
import {
  useTableSelectionController,
  useTableSelectionData,
} from "./selection/table_selection.js";
import { useStickyGroup } from "./sticky/sticky_group.js";
import { TableCellStickyFrontier } from "./sticky/table_sticky.jsx";
import {
  TableDragProvider,
  TableSelectionProvider,
  TableStickyProvider,
  useTableDrag,
  useTableSelection,
  useTableSticky,
} from "./table_context.jsx";
import "./table_css.js";
import { TableUIContainer } from "./table_ui.jsx";

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
  } = useTableSelectionData(selection);
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
      <TableUIContainer grabTarget={grabTarget} />
    </div>
  );
});
export const Colgroup = ({ children }) => {
  return <colgroup>{children}</colgroup>;
};
export const Col = ({ id, width, immovable }) => {
  const columns = useColumns();
  const columnIndex = columns.length;
  const selectionId = `column:${columnIndex}`;
  columns[columnIndex] = { id, selectionId, width, immovable };

  const { stickyLeftFrontierColumnIndex } = useTableSticky();
  const isStickyLeft = columnIndex <= stickyLeftFrontierColumnIndex;

  return (
    <col
      data-sticky-left={isStickyLeft ? "" : undefined}
      data-drag-sticky-left-frontier={isStickyLeft ? "" : undefined}
      data-drag-obstacle={immovable ? "move-column" : undefined}
      style={{
        minWidth: width ? `${width}px` : undefined,
        maxWidth: width ? `${width}px` : undefined,
      }}
    />
  );
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

export const TableRow = ({ id, height, children }) => {
  const columns = useColumns();
  const rows = useRows();
  const rowIndex = rows.length;
  const selectionId = `row:${id || rowIndex}`;
  const row = { id, selectionId, height };
  rows[rowIndex] = row;

  const { stickyTopFrontierRowIndex } = useTableSticky();
  const isStickyTop = rowIndex <= stickyTopFrontierRowIndex;
  const isStickyTopFrontier = rowIndex === stickyTopFrontierRowIndex;

  const { selectedRowIds } = useTableSelection();
  const isRowSelected = selectedRowIds.includes(selectionId);

  return (
    <tr
      data-row-id={id ? id : undefined}
      aria-selected={isRowSelected}
      data-sticky-top={isStickyTop ? "" : undefined}
      data-drag-sticky-top-frontier={isStickyTopFrontier ? "" : undefined}
      style={{
        height: height ? `${height}px` : undefined,
        maxHeight: height ? `${height}px` : undefined,
      }}
    >
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
export const TableCell = forwardRef((props, ref) => {
  let {
    className,
    canDrag,
    canResizeWidth,
    canResizeHeight,
    selectionImpact,
    style,
    cursor,
    textAlign,
    onClick,
    onMouseDown,
    children,
    action,
  } = props;

  const cellRef = useRef();
  const { editing, startEditing, stopEditing } = useEditionController();
  useImperativeHandle(ref, () => ({
    startEditing,
    stopEditing,
    element: cellRef.current,
  }));

  const columnIndex = useColumnIndex();
  const rowIndex = useRowIndex();
  const column = useColumn();
  const row = useRow();
  const isInTableHead = useIsInTableHead();
  const TagName = isInTableHead ? "th" : "td";

  const selectionId = `cell:${row.id || rowIndex}-${column.id || columnIndex}`;

  const editable = Boolean(action);

  const { stickyLeftFrontierColumnIndex, stickyTopFrontierRowIndex } =
    useTableSticky();
  const stickyLeft = columnIndex <= stickyLeftFrontierColumnIndex;
  const stickyTop = rowIndex <= stickyTopFrontierRowIndex;
  const isStickyLeftFrontier = columnIndex === stickyLeftFrontierColumnIndex;
  const isAfterStickyLeftFrontier =
    columnIndex === stickyLeftFrontierColumnIndex + 1;
  const isStickyTopFrontier = rowIndex === stickyTopFrontierRowIndex;
  const isAfterStickyTopFrontier = rowIndex === stickyTopFrontierRowIndex + 1;

  const { selectionController, columnContainsSelectedCell } =
    useTableSelection();

  const { selected } = useSelectableElement(cellRef, {
    selectionController,
    selectionImpact:
      selectionImpact === undefined
        ? rowIndex === 0
          ? (allValues) => {
              const columnCells = data.map(
                (row) => `cell:${columnIndex}-${rowIndex}`,
              );
              return columnCells;
            }
          : undefined
        : selectionImpact,
    // value: id,
  });

  const { grabTarget } = useTableDrag();
  const columnGrabbed = grabTarget === `column:${columnIndex}`;
  if (canDrag === undefined) {
    canDrag = rowIndex === 0;
  }

  if (canResizeWidth === undefined && rowIndex === 0) {
    canResizeWidth = true;
  }
  if (canResizeHeight === undefined && columnIndex === 0) {
    canResizeHeight = true;
  }
  const innerStyle = { ...style };
  if (cursor) {
    innerStyle.cursor = cursor;
  }
  const columnWidth = column.width;
  if (
    columnWidth === undefined ||
    // when column width becomes too small the padding would prevent it from shrinking
    columnWidth > 42
  ) {
    innerStyle.paddingLeft = "12px";
    innerStyle.paddingRight = "12px";
  }
  const rowHeight = row.height;
  if (
    rowHeight === undefined ||
    // when row height becomes too small the padding would prevent it from shrinking
    rowHeight > 42
  ) {
    innerStyle.paddingTop = "8px";
    innerStyle.paddingBottom = "8px";
  }
  if (columnWidth !== undefined) {
    innerStyle.maxWidth = `${columnWidth}px`;
  }
  if (rowHeight !== undefined) {
    innerStyle.maxHeight = `${rowHeight}px`;
  }
  if (textAlign) {
    innerStyle.textAlign = textAlign;
  }

  return (
    <TagName
      ref={cellRef}
      className={className}
      style={innerStyle}
      data-sticky-left={stickyLeft ? "" : undefined}
      data-sticky-top={stickyTop ? "" : undefined}
      data-sticky-left-frontier={
        stickyLeft && isStickyLeftFrontier ? "" : undefined
      }
      data-sticky-top-frontier={
        stickyTop && isStickyTopFrontier ? "" : undefined
      }
      data-after-sticky-left-frontier={
        isAfterStickyLeftFrontier ? "" : undefined
      }
      data-after-sticky-top-frontier={isAfterStickyTopFrontier ? "" : undefined}
      tabIndex={-1}
      data-selection-name={isInTableHead ? "column" : "cell"}
      data-selection-keyboard-toggle
      aria-selected={selected}
      data-value={selectionId}
      data-editing={editing ? "" : undefined}
      data-grabbed={columnGrabbed ? "" : undefined}
      data-column-contains-selected-cell={
        columnContainsSelectedCell ? "" : undefined
      }
      onClick={onClick}
      onMouseDown={onMouseDown}
      onDoubleClick={(e) => {
        if (!editable) {
          return;
        }
        startEditing(e);
      }}
      oneditrequested={(e) => {
        if (!editable) {
          return;
        }
        startEditing(e);
      }}
    >
      {editable ? (
        <Editable
          editing={editing}
          onEditEnd={stopEditing}
          value={children}
          action={action}
        >
          {children}
        </Editable>
      ) : (
        children
      )}
      <TableCellStickyFrontier
        rowIndex={rowIndex}
        columnIndex={columnIndex}
        stickyLeftFrontierColumnIndex={stickyLeftFrontierColumnIndex}
        stickyTopFrontierRowIndex={stickyTopFrontierRowIndex}
      />
      {canResizeWidth && (
        <TableCellColumnResizeHandles
          columnIndex={columnIndex}
          columnMinWidth={column.minWidth}
          columnMaxWidth={column.maxWidth}
        />
      )}
      {canResizeHeight && (
        <TableCellRowResizeHandles
          rowIndex={rowIndex}
          rowMinHeight={row.minHeight}
          rowMaxHeight={row.maxHeight}
        />
      )}

      {isInTableHead && (
        <span className="navi_table_cell_content_bold_clone" aria-hidden="true">
          {children}
        </span>
      )}
      {columnGrabbed && <div className="navi_table_cell_placeholder"></div>}
    </TagName>
  );
});
