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
 * - Mettre le sticky again dans les tables cells (mais les suivantes pour avoir l'effet d'ombre)
 *
 * - Can add a column (+ button at the end of table headers)
 * - Can add a row (+ button at the end of the row number column )
 * - Delete a row (how?)
 * - Delete a column (how?)
 * - Update table column info (I guess a down arrow icon which opens a meny when clicked for instance)
 */

import { useActiveElement } from "@jsenv/dom";
import { createContext, toChildArray } from "preact";
import { forwardRef } from "preact/compat";
import { useContext, useImperativeHandle, useRef } from "preact/hooks";

import { Editable, useEditionController } from "../edition/editable.jsx";
import { createIsolatedItemTracker } from "../item_tracker/use_isolated_item_tracker.jsx";
import { createItemTracker } from "../item_tracker/use_item_tracker.jsx";
import { useKeyboardShortcuts } from "../keyboard_shortcuts/keyboard_shortcuts.js";
import {
  createSelectionKeyboardShortcuts,
  useSelectableElement,
} from "../selection/selection.jsx";
import { useFocusGroup } from "../use_focus_group.js";
import {
  initDragTableColumnByMousedown,
  TableDragContext,
  useTableDragContextValue,
} from "./drag/table_drag.js";
import {
  TableCellColumnResizeHandles,
  TableCellRowResizeHandles,
} from "./resize/table_resize.jsx";
import {
  TableSizeProvider,
  useTableSizeContextValue,
} from "./resize/table_size.js";
import {
  parseTableSelectionValue,
  stringifyTableSelectionValue,
  TableSelectionContext,
  useTableSelectionContextValue,
} from "./selection/table_selection.js";
import { useTableSelectionController } from "./selection/table_selection.jsx";
import { useStickyGroup } from "./sticky/sticky_group.js";
import {
  TableStickyContext,
  useTableStickyContextValue,
} from "./sticky/table_sticky.js";
import "./sticky/table_sticky.jsx";
import { TableStickyFrontier } from "./sticky/table_sticky.jsx";
import "./table_css.js";
import { TableUI } from "./table_ui.jsx";

const [useColumnTrackerProviders, useRegisterColumn, useColumnByIndex] =
  createIsolatedItemTracker();
const [useRowTrackerProvider, useRegisterRow, useRowByIndex] =
  createItemTracker();

const ColumnProducerProviderContext = createContext();
const ColumnConsumerProviderContext = createContext();
const ColumnContext = createContext();
const RowContext = createContext();
const ColumnIndexContext = createContext();
const RowIndexContext = createContext();

const TableSectionContext = createContext();
const useIsInTableHead = () => useContext(TableSectionContext) === "head";

export const Table = forwardRef((props, ref) => {
  const {
    selection = [],
    selectionColor,
    onSelectionChange,
    onColumnSizeChange,
    onRowSizeChange,
    borderCollapse = true,
    stickyLeftFrontierColumnIndex = -1,
    onStickyLeftFrontierChange,
    stickyTopFrontierRowIndex = -1,
    onStickyTopFrontierChange,
    onColumnOrderChange,
    maxWidth,
    maxHeight,
    overflow,
    children,
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const tableContainerRef = useRef();
  const tableUIRef = useRef();

  const [ColumnProducerProvider, ColumnConsumerProvider, columns] =
    useColumnTrackerProviders();
  const RowTrackerProvider = useRowTrackerProvider();
  const rows = RowTrackerProvider.items;

  // selection
  const selectionController = useTableSelectionController({
    tableRef: innerRef,
    selection,
    onSelectionChange,
    selectionColor,
  });
  const selectionContextValue = useTableSelectionContextValue(
    selection,
    selectionController,
  );

  useFocusGroup(innerRef);

  // sticky
  useStickyGroup(tableContainerRef, {
    elementSelector: ".navi_table",
    elementReceivingCumulativeStickyPositionRef: tableUIRef,
  });
  const stickyContextValue = useTableStickyContextValue({
    stickyLeftFrontierColumnIndex,
    stickyTopFrontierRowIndex,
    onStickyLeftFrontierChange,
    onStickyTopFrontierChange,
  });

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

  // resizing
  const tableSizeContextValue = useTableSizeContextValue({
    onColumnSizeChange,
    onRowSizeChange,
    columns,
    rows,
  });

  const tableRootRef = useRef();
  const setColumnOrder = (columnIdsNewOrder) => {
    // the code below ensures we re-render the selection when column are re-ordered
    // forcing each previously selected <td> to unselect and newly selected <td> to be selected
    // (because the corresponding DOM node is now different)
    onSelectionChange?.([...selection]);
    onColumnOrderChange?.(columnIdsNewOrder);
  };

  // drag columns
  const dragContextValue = useTableDragContextValue({
    setColumnOrder,
    columns,
    canChangeColumnOrder: Boolean(onColumnOrderChange),
  });

  return (
    <div
      ref={tableRootRef}
      className="navi_table_root"
      style={{
        overflow,
        "--table-max-width": maxWidth ? `${maxWidth}px` : undefined,
        "--table-max-height": maxHeight ? `${maxHeight}px` : undefined,
      }}
    >
      <div ref={tableContainerRef} className="navi_table_container">
        <table
          ref={innerRef}
          className="navi_table"
          aria-multiselectable="true"
          data-multiselection={selection.length > 1 ? "" : undefined}
          data-border-collapse={borderCollapse ? "" : undefined}
        >
          <TableSizeProvider value={tableSizeContextValue}>
            <TableSelectionContext.Provider value={selectionContextValue}>
              <TableDragContext.Provider value={dragContextValue}>
                <TableStickyContext.Provider value={stickyContextValue}>
                  <ColumnProducerProviderContext.Provider
                    value={ColumnProducerProvider}
                  >
                    <ColumnConsumerProviderContext.Provider
                      value={ColumnConsumerProvider}
                    >
                      <RowTrackerProvider>{children}</RowTrackerProvider>
                    </ColumnConsumerProviderContext.Provider>
                  </ColumnProducerProviderContext.Provider>
                </TableStickyContext.Provider>
              </TableDragContext.Provider>
            </TableSelectionContext.Provider>
          </TableSizeProvider>
        </table>
        <TableUI ref={tableUIRef} tableRef={innerRef}>
          <TableStickyContext.Provider value={stickyContextValue}>
            <TableStickyFrontier tableRef={innerRef} />
          </TableStickyContext.Provider>
        </TableUI>
      </div>
    </div>
  );
});
export const Colgroup = ({ children }) => {
  const ColumnProducerProvider = useContext(ColumnProducerProviderContext);
  return (
    <colgroup className="navi_colgroup">
      <ColumnProducerProvider>{children}</ColumnProducerProvider>
    </colgroup>
  );
};
export const Col = ({ id, width, immovable, backgroundColor }) => {
  const columnIndex = useRegisterColumn({
    id,
    width,
    immovable,
    backgroundColor,
  });
  const { stickyLeftFrontierColumnIndex } = useContext(TableStickyContext);
  const isStickyLeft = columnIndex <= stickyLeftFrontierColumnIndex;

  return (
    <col
      className="navi_col"
      id={id}
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
export const Thead = ({ children }) => {
  return (
    <thead>
      <TableSectionContext.Provider value="head">
        {children}
      </TableSectionContext.Provider>
    </thead>
  );
};
export const Tbody = ({ children }) => {
  return (
    <tbody>
      <TableSectionContext.Provider value="body">
        {children}
      </TableSectionContext.Provider>
    </tbody>
  );
};
export const Tr = ({ id, height, children }) => {
  if (!id) {
    console.warn("<Tr /> must have an id prop to enable selection");
  }
  id = String(id); // we need strings as this value is going to be used in data attributes
  // and when generating cell ids

  const { selectedRowIds } = useContext(TableSelectionContext);
  const { stickyTopFrontierRowIndex } = useContext(TableStickyContext);
  const rowIndex = useRegisterRow({ id, height });
  const row = useRowByIndex(rowIndex);
  const ColumnConsumerProvider = useContext(ColumnConsumerProviderContext);

  const isStickyTop = rowIndex <= stickyTopFrontierRowIndex;
  const isStickyTopFrontier = rowIndex === stickyTopFrontierRowIndex;
  const isRowSelected = selectedRowIds.includes(id);

  children = toChildArray(children);

  /* We use <TableRowCells> to be able to provide <ColumnConsumerProvider />  
  that is needed by useColumnByIndex */

  return (
    <tr
      className="navi_tr"
      data-row-id={id ? id : undefined}
      aria-selected={isRowSelected}
      data-sticky-top={isStickyTop ? "" : undefined}
      data-drag-sticky-top-frontier={isStickyTopFrontier ? "" : undefined}
      style={{
        height: height ? `${height}px` : undefined,
        maxHeight: height ? `${height}px` : undefined,
      }}
    >
      <ColumnConsumerProvider>
        <TableRowCells rowIndex={rowIndex} row={row}>
          {children}
        </TableRowCells>
      </ColumnConsumerProvider>
    </tr>
  );
};

const TableRowCells = ({ children, rowIndex, row }) => {
  return children.map((child, columnIndex) => {
    const column = useColumnByIndex(columnIndex);
    const columnId = column.id;

    return (
      <RowContext.Provider key={columnId} value={row}>
        <RowIndexContext.Provider value={rowIndex}>
          <ColumnIndexContext.Provider value={columnIndex}>
            <ColumnContext.Provider value={column}>
              {child}
            </ColumnContext.Provider>
          </ColumnIndexContext.Provider>
        </RowIndexContext.Provider>
      </RowContext.Provider>
    );
  });
};

export const TableCell = forwardRef((props, ref) => {
  const column = useContext(ColumnContext);
  const row = useContext(RowContext);
  const columnIndex = useContext(ColumnIndexContext);
  const rowIndex = useContext(RowIndexContext);
  const {
    className = "",
    canSelectAll,
    canDragColumn,
    canResizeWidth,
    canResizeHeight,
    selectionImpact,
    onClick,
    action,
    name,
    valueSignal,
    // appeareance
    style,
    cursor,
    bold,
    alignX = column.alignX,
    alignY = column.alignY,
    backgroundColor = column.backgroundColor || row.backgroundColor,
    children,
  } = props;
  const cellRef = useRef();
  const isFirstRow = rowIndex === 0;
  const isFirstColumn = columnIndex === 0;

  // editing
  const editable = Boolean(action);
  const { editing, startEditing, stopEditing } = useEditionController();
  useImperativeHandle(ref, () => ({
    startEditing,
    stopEditing,
    element: cellRef.current,
  }));

  // stickyness
  const { stickyLeftFrontierColumnIndex, stickyTopFrontierRowIndex } =
    useContext(TableStickyContext);
  const stickyLeft = columnIndex <= stickyLeftFrontierColumnIndex;
  const stickyTop = rowIndex <= stickyTopFrontierRowIndex;
  const isStickyLeftFrontier = columnIndex === stickyLeftFrontierColumnIndex;
  const isAfterStickyLeftFrontier =
    columnIndex === stickyLeftFrontierColumnIndex + 1;
  const isStickyTopFrontier = rowIndex === stickyTopFrontierRowIndex;
  const isAfterStickyTopFrontier = rowIndex === stickyTopFrontierRowIndex + 1;

  // selection
  const rowId = row.id;
  const columnId = column.id;
  const selectionValue = stringifyTableSelectionValue("cell", {
    rowId,
    columnId,
  });
  const {
    selection,
    selectionController,
    columnIdWithSomeSelectedCellSet,
    rowIdWithSomeSelectedCellSet,
  } = useContext(TableSelectionContext);
  const innerSelectionImpact =
    selectionImpact === undefined
      ? isFirstRow && isFirstColumn && canSelectAll
        ? (allValues) => {
            const cells = allValues.filter(
              (v) => parseTableSelectionValue(v).type === "cell",
            );
            return cells;
          }
        : isFirstRow
          ? (allValues) => {
              const columnCells = allValues.filter((v) => {
                const selectionValueInfo = parseTableSelectionValue(v);
                return (
                  selectionValueInfo.type === "cell" &&
                  selectionValueInfo.columnId === columnId
                );
              });
              return columnCells;
            }
          : isFirstColumn
            ? (allValues) => {
                const rowCells = allValues.filter((v) => {
                  const selectionValueInfo = parseTableSelectionValue(v);
                  return (
                    selectionValueInfo.type === "cell" &&
                    selectionValueInfo.rowId === rowId
                  );
                });
                return rowCells;
              }
            : undefined
      : selectionImpact;

  const { selected } = useSelectableElement(cellRef, {
    selection,
    selectionController,
    selectionImpact: innerSelectionImpact,
    // value: selectionId,
  });

  // moving column
  const { grabTarget, grabColumn, releaseColumn, canChangeColumnOrder } =
    useContext(TableDragContext);
  const columnGrabbed = grabTarget === `column:${columnIndex}`;

  // resizing
  const innerCanDragColumn =
    canDragColumn === undefined
      ? rowIndex === 0 && !column.immovable && Boolean(canChangeColumnOrder)
      : canDragColumn;
  const innerCanResizeWidth =
    canResizeWidth === undefined ? rowIndex === 0 : canResizeWidth;
  const innerCanResizeHeight =
    canResizeHeight === undefined ? columnIndex === 0 : canResizeHeight;

  // display
  const isInTableHead = useIsInTableHead();
  const innerStyle = {
    ...style,
  };

  const columnContainsSelectedCell =
    columnIdWithSomeSelectedCellSet.has(columnId);
  const rowContainsSelectedCell = rowIdWithSomeSelectedCellSet.has(rowId);
  const containSelectedCell =
    (isFirstRow && columnContainsSelectedCell) ||
    (isFirstColumn && rowContainsSelectedCell);

  // appeareance
  const innerBackgroundColor =
    backgroundColor || containSelectedCell
      ? "var(--selection-background-color)"
      : isFirstColumn
        ? "#F8F8F8"
        : isFirstRow
          ? "#d3e7ff"
          : "white";
  if (innerBackgroundColor) {
    innerStyle["--background-color"] = innerBackgroundColor;
  }
  if (cursor) {
    innerStyle.cursor = cursor;
  }
  const columnWidth = column.width;
  if (columnWidth !== undefined) {
    innerStyle.minWidth = `${columnWidth}px`;
    innerStyle.width = `${columnWidth}px`;
    innerStyle.maxWidth = `${columnWidth}px`;
  }
  const rowHeight = row.height;
  if (rowHeight !== undefined) {
    innerStyle.maxHeight = `${rowHeight}px`;
  }
  const innerAlignX = alignX || isFirstRow ? "center" : "start";
  const innerAlignY = alignY || isFirstColumn ? "center" : "start";
  const innerBold = bold || containSelectedCell;
  if (innerBold) {
    innerStyle.fontWeight = "bold";
  }

  const activeElement = useActiveElement();
  const TagName = isInTableHead ? "th" : "td";

  return (
    <TagName
      className={["navi_table_cell", ...className.split(" ")].join(" ")}
      ref={cellRef}
      style={innerStyle}
      data-align-x={innerAlignX}
      data-align-y={innerAlignY}
      // we use [data-focus] so that the attribute can be copied
      // to the dragged cell copies
      data-focus={activeElement === cellRef.current ? "" : undefined}
      data-first-row={isFirstRow ? "" : undefined}
      data-first-column={isFirstColumn ? "" : undefined}
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
      data-height-is-xxs={
        rowHeight !== undefined && rowHeight < 42 ? "" : undefined
      }
      data-width-is-xxs={
        columnWidth !== undefined && columnWidth < 42 ? "" : undefined
      }
      data-selection-name={isInTableHead ? "column" : "cell"}
      data-selection-keyboard-toggle
      aria-selected={selected}
      data-value={selectionValue}
      data-editing={editing ? "" : undefined}
      data-grabbed={columnGrabbed ? "" : undefined}
      onClick={onClick}
      onMouseDown={(e) => {
        if (!innerCanDragColumn) {
          return;
        }
        if (e.button !== 0) {
          return;
        }
        initDragTableColumnByMousedown(e, {
          onGrab: () => grabColumn(columnIndex),
          onDrag: () => {},
          onRelease: (_, newColumnIndex) =>
            releaseColumn(columnIndex, newColumnIndex),
        });
      }}
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
          name={name}
          valueSignal={valueSignal}
          height="100%"
          width="100%"
        >
          {children}
        </Editable>
      ) : (
        children
      )}
      {innerCanResizeWidth && (
        <TableCellColumnResizeHandles
          columnIndex={columnIndex}
          columnMinWidth={column.minWidth}
          columnMaxWidth={column.maxWidth}
        />
      )}
      {innerCanResizeHeight && (
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
      <div
        className="navi_table_cell_foreground"
        data-visible={columnGrabbed ? "" : undefined}
      ></div>
    </TagName>
  );
});

export const RowNumberCol = ({
  width = 50,
  minWidth = 30,
  maxWidth = 100,
  ...rest
}) => {
  return (
    <Col
      id="row_number"
      width={width}
      minWidth={minWidth}
      maxWidth={maxWidth}
      immovable
      {...rest}
    />
  );
};
export const RowNumberTableCell = (props) => {
  const columnIndex = useContext(ColumnIndexContext);
  const rowIndex = useContext(RowIndexContext);
  const isTopLeftCell = columnIndex === 0 && rowIndex === 0;

  return (
    <TableCell canSelectAll={isTopLeftCell} alignX="left" {...props}>
      {isTopLeftCell ? "" : rowIndex}
    </TableCell>
  );
};
