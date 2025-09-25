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

import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef, useState } from "preact/hooks";
import { useKeyboardShortcuts } from "../keyboard_shortcuts/keyboard_shortcuts.js";
import {
  createSelectionKeyboardShortcuts,
  useSelectableElement,
} from "../selection/selection.jsx";
import { useFocusGroup } from "../use_focus_group.js";
import { initDragTableColumnByMousedown } from "./drag/drag_table_column.js";
import { TableDragCloneContainer } from "./drag/table_drag_clone_container.jsx";
import {
  TableCellColumnResizeHandles,
  TableCellRowResizeHandles,
  TableColumnResizer,
  TableRowResizer,
} from "./resize/table_resize.jsx";
import {
  useTableSelection,
  useTableSelectionController,
} from "./selection/table_selection.js";
import { useStickyGroup } from "./sticky/sticky_group.js";
import {
  TableCellStickyFrontier,
  TableStickyFrontier,
} from "./sticky/table_sticky.jsx";
import { TableCell } from "./table_cell.jsx";

/*
 * Box-shadow border mapping template:
 *
 * box-shadow:
 *   inset 0 1px 0 0 color,    // Top border
 *   inset 1px 0 0 0 color,    // Left border
 *   inset -1px 0 0 0 color,   // Right border
 *   inset 0 -1px 0 0 color;   // Bottom border
 */

import.meta.css = /* css */ `
  .navi_table_container {
    --border-color: #e1e1e1;
    --focus-border-color: #0078d4;

    position: relative;
  }

  .navi_table {
    border-radius: 2px;
    border-spacing: 0; /* Required for manual border collapse */
  }

  .navi_table th,
  .navi_table td {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Table borders using ::before pseudo-elements */
  /* Default: each cell draws all its own borders (no border-collapse) */
  .navi_table th,
  .navi_table td {
    border: none; /* Remove default borders - we'll use pseudo-elements */
    /* Required for pseudo-element positioning */
    position: relative;
  }

  .navi_table th::before,
  .navi_table td::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }
  .navi_table th::after,
  .navi_table td::after {
    content: "";
    position: absolute;
    /* Default: include bottom and right borders (owned by this cell) */
    inset: 0;
    pointer-events: none;
  }

  .navi_table th,
  .navi_table td {
    text-align: left;
    background: white;
  }

  .navi_table th {
    background: lightgrey;
    font-weight: normal;
    padding: 0;
  }

  .navi_table td {
    padding: 0;
    user-select: none;
  }

  .navi_table th {
    user-select: none;
  }

  /* Number column specific styling */
  .navi_row_number_cell {
    text-align: center;
    background: #fafafa;
    font-weight: 500;
    color: #666;
    user-select: none;
  }

  .navi_table_cell_content_bold_clone {
    font-weight: bold; /* force bold to compute max width */
    visibility: hidden; /* not visible */
    display: block; /* in-flow so it contributes to width */
    height: 0; /* zero height so it doesn't change layout height */
    overflow: hidden; /* avoid any accidental height */
    pointer-events: none; /* inert */
  }

  /* Border-collapse mode: each cell only owns specific borders to avoid doubling */

  /* Base rule: all cells get right and bottom borders */
  .navi_table[data-border-collapse] th::before,
  .navi_table[data-border-collapse] td::before {
    box-shadow:
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header cells (all th) get top border in addition to right and bottom */
  .navi_table[data-border-collapse] th::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* First column cells get left border in addition to right and bottom */
  .navi_table[data-border-collapse] th:first-child::before,
  .navi_table[data-border-collapse] td:first-child::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header first column gets all four borders */
  .navi_table[data-border-collapse] th:first-child::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Focus styles */
  .navi_table td:focus,
  .navi_table th:focus {
    outline: none; /* Remove default outline */
  }

  .navi_table th:focus::after,
  .navi_table td:focus::after {
    box-shadow:
      inset 0 2px 0 0 var(--focus-border-color),
      inset -2px 0 0 0 var(--focus-border-color),
      inset 0 -2px 0 0 var(--focus-border-color),
      inset 2px 0 0 0 var(--focus-border-color) !important;
  }
`;

const NO_SELECTION = [];
export const Table = forwardRef((props, ref) => {
  let {
    columns,
    rows = [],
    data,
    selection = [],
    selectionColor,
    onSelectionChange,
    onColumnResize,
    generatedLeftColumnWidth = 100,
    onGeneratedLeftColumnResize,
    generatedTopRowHeight,
    onGeneratedTopRowResize,
    onRowResize,
    borderCollapse = true,
    stickyLeftFrontierColumnIndex = 0,
    onStickyLeftFrontierChange,
    stickyTopFrontierRowIndex = 0,
    onStickyTopFrontierChange,
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => {
    return {
      element: innerRef.current,
      clearSelection: () => {
        onSelectionChange(NO_SELECTION);
      },
      selectAll: () => {
        // Select all data cells (not row/column selectors)
        const allCellIds = [];
        data.forEach((row) => {
          columns.forEach((col) => {
            allCellIds.push(`${col.accessorKey}:${row.id}`);
          });
        });
        onSelectionChange(allCellIds);
      },
    };
  });

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

  const tableContainerRef = useRef();

  useFocusGroup(innerRef);
  useStickyGroup(tableContainerRef, { elementSelector: "table" });
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

  // ability to drag columns
  const [grabTarget, setGrabTarget] = useState(null);
  const grabColumn = (columnIndex) => {
    setGrabTarget(`column:${columnIndex}`);
  };
  const releaseColumn = () => {
    setGrabTarget(null);
  };

  const firstColIsSticky = stickyLeftFrontierColumnIndex > -1;
  const firsRowIsSticky = stickyTopFrontierRowIndex > -1;

  return (
    <div ref={tableContainerRef} className="navi_table_container">
      <table
        ref={innerRef}
        className="navi_table"
        aria-multiselectable="true"
        data-multiselection={selection.length > 1 ? "" : undefined}
        data-border-collapse={borderCollapse ? "" : undefined}
      >
        <colgroup>
          <col
            data-sticky-left={firstColIsSticky ? "" : undefined}
            data-drag-sticky-frontier-left={firstColIsSticky ? "" : undefined}
            data-drag-obstacle="move-column"
            style={{
              minWidth: `${generatedLeftColumnWidth}px`,
              maxWidth: `${generatedLeftColumnWidth}px`,
            }}
          ></col>
          {columns.map((col, index) => {
            const colIsSticky = index < stickyLeftFrontierColumnIndex;

            return (
              <col
                key={col.id}
                data-sticky-left={colIsSticky ? "" : undefined}
                data-drag-sticky-left-frontier={colIsSticky ? "" : undefined}
                style={{
                  minWidth: col.width ? `${col.width}px` : undefined,
                  maxWidth: col.width ? `${col.width}px` : undefined,
                }}
              />
            );
          })}
        </colgroup>
        <thead>
          <tr
            data-sticky-top={firsRowIsSticky ? "" : undefined}
            data-drag-sticky-frontier-top={firsRowIsSticky ? "" : undefined}
            data-drag-obstacle="move-row"
            style={{
              height: generatedTopRowHeight
                ? `${generatedTopRowHeight}px`
                : undefined,
            }}
          >
            <RowNumberHeaderCell
              stickyLeft={firstColIsSticky}
              stickyTop={firsRowIsSticky}
              isStickyLeftFrontier={stickyLeftFrontierColumnIndex === 0} // Only frontier if no other columns are sticky
              isStickyTopFrontier={stickyTopFrontierRowIndex === 0} // Only frontier if no other rows are sticky
              isAfterStickyLeftFrontier={stickyLeftFrontierColumnIndex === -1}
              isAfterStickyTopFrontier={stickyTopFrontierRowIndex === -1}
              stickyLeftFrontierColumnIndex={stickyLeftFrontierColumnIndex}
              onStickyLeftFrontierChange={onStickyLeftFrontierChange}
              stickyTopFrontierRowIndex={stickyTopFrontierRowIndex}
              onStickyTopFrontierChange={onStickyTopFrontierChange}
              resizable
              columnMinWidth={50}
              onColumnResizeRequested={(width) => {
                onGeneratedLeftColumnResize?.(width);
              }}
              rowMinHeight={30}
              onRowResizeRequested={(height) => {
                onGeneratedTopRowResize?.(height);
              }}
              onClick={() => {
                ref.current.selectAll();
              }}
            />
            {columns.map((col, colIndex) => {
              const columnIsGrabbed = grabTarget === `column:${colIndex}`;
              // const isLastColumn = index === columns.length - 1;

              return (
                <HeaderCell
                  key={col.id}
                  // sticky left
                  stickyLeft={colIndex < stickyLeftFrontierColumnIndex}
                  isStickyLeftFrontier={
                    colIndex + 1 === stickyLeftFrontierColumnIndex
                  }
                  isAfterStickyLeftFrontier={
                    colIndex + 1 === stickyLeftFrontierColumnIndex + 1
                  }
                  stickyLeftFrontierColumnIndex={stickyLeftFrontierColumnIndex}
                  onStickyLeftFrontierChange={onStickyLeftFrontierChange}
                  // sticky top
                  stickyTop={firsRowIsSticky}
                  isStickyTopFrontier={stickyTopFrontierRowIndex === 0}
                  isAfterStickyTopFrontier={stickyTopFrontierRowIndex === -1}
                  stickyTopFrontierRowIndex={stickyTopFrontierRowIndex}
                  onStickyTopFrontierChange={onStickyTopFrontierChange}
                  // other
                  columnAccessorKey={col.accessorKey}
                  columnIndex={colIndex + 1}
                  columnWithSomeSelectedCell={columnWithSomeSelectedCell}
                  data={data}
                  selectionController={selectionController}
                  grabbed={columnIsGrabbed}
                  movable
                  resizable
                  columnMinWidth={col.minWidth}
                  columnMaxWidth={col.maxWidth}
                  onGrab={() => {
                    grabColumn(colIndex);
                  }}
                  onRelease={() => {
                    releaseColumn(colIndex);
                  }}
                  onResizeRequested={(width, columnIndex) => {
                    if (columnIndex === 0) {
                      onGeneratedLeftColumnResize?.(width);
                      return;
                    }
                    onColumnResize?.(
                      width,
                      columnIndex - 1,
                      columns[columnIndex - 1],
                    );
                  }}
                  style={{
                    maxWidth: col.width ? `${col.width}px` : undefined,
                    maxHeight: generatedTopRowHeight
                      ? `${generatedTopRowHeight}px`
                      : undefined,
                  }}
                  value={col.value}
                />
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((rowData, rowIndex) => {
            const rowOptions = rows[rowIndex] || {};
            const isRowSelected = selectedRowIds.includes(rowData.id);
            const rowIsSticky = rowIndex < stickyTopFrontierRowIndex;
            const isStickyTopFrontier =
              rowIndex + 1 === stickyTopFrontierRowIndex;
            const isAfterStickyTopFrontier =
              rowIndex + 1 === stickyTopFrontierRowIndex + 1;

            return (
              <tr
                key={rowData.id}
                data-row-id={rowData.id}
                aria-selected={isRowSelected}
                data-sticky-top={rowIsSticky ? "" : undefined}
                data-drag-sticky-top-frontier={
                  isStickyTopFrontier ? "" : undefined
                }
                style={{
                  height: rowOptions.height
                    ? `${rowOptions.height}px`
                    : undefined,
                  maxHeight: rowOptions.height
                    ? `${rowOptions.height}px`
                    : undefined,
                }}
              >
                <RowNumberCell
                  // sticky left
                  stickyLeft={firstColIsSticky}
                  isStickyLeftFrontier={stickyLeftFrontierColumnIndex === 0}
                  isAfterStickyLeftFrontier={
                    stickyLeftFrontierColumnIndex === -1
                  }
                  stickyLeftFrontierColumnIndex={stickyLeftFrontierColumnIndex}
                  onStickyLeftFrontierChange={onStickyLeftFrontierChange}
                  // sticky top
                  stickyTop={rowIsSticky}
                  isStickyTopFrontier={isStickyTopFrontier}
                  isAfterStickyTopFrontier={isAfterStickyTopFrontier}
                  stickyTopFrontierRowIndex={stickyTopFrontierRowIndex}
                  onStickyTopFrontierChange={onStickyTopFrontierChange}
                  // other
                  row={rowData}
                  rowWithSomeSelectedCell={rowWithSomeSelectedCell}
                  columns={columns}
                  selectionController={selectionController}
                  value={rowIndex + 1}
                  resizable
                  rowIndex={rowIndex + 1}
                  rowMinHeight={rowOptions.minHeight}
                  rowMaxHeight={rowOptions.maxHeight}
                  onResizeRequested={(height, rowIndex) => {
                    if (rowIndex === 0) {
                      onGeneratedTopRowResize?.(height);
                      return;
                    }
                    onRowResize?.(height, rowIndex - 1, rows[rowIndex - 1]);
                  }}
                  style={{
                    maxWidth: generatedLeftColumnWidth
                      ? `${generatedLeftColumnWidth}px`
                      : undefined,
                    maxHeight: rowOptions.height
                      ? `${rowOptions.height}px`
                      : undefined,
                  }}
                />
                {columns.map((col, colIndex) => {
                  const columnGrabbed = grabTarget === `column:${colIndex}`;
                  const columnIsSticky =
                    colIndex < stickyLeftFrontierColumnIndex;

                  return (
                    <DataCell
                      key={`${rowData.id}-${col.id}`}
                      // sticky left
                      stickyLeft={columnIsSticky}
                      isStickyLeftFrontier={
                        colIndex + 1 === stickyLeftFrontierColumnIndex
                      }
                      isAfterStickyLeftFrontier={
                        colIndex + 1 === stickyLeftFrontierColumnIndex + 1
                      }
                      stickyLeftFrontierColumnIndex={
                        stickyLeftFrontierColumnIndex
                      }
                      onStickyLeftFrontierChange={onStickyLeftFrontierChange}
                      // sticky top
                      stickyTop={rowIsSticky}
                      isStickyTopFrontier={isStickyTopFrontier}
                      isAfterStickyTopFrontier={isAfterStickyTopFrontier}
                      stickyTopFrontierRowIndex={stickyTopFrontierRowIndex}
                      onStickyTopFrontierChange={onStickyTopFrontierChange}
                      // other
                      columnName={col.accessorKey}
                      columnIndex={colIndex + 1} // +1 because number column is first
                      rowIndex={rowIndex + 1} // +1 because header row is first
                      row={rowData}
                      value={rowData[col.accessorKey]}
                      selectionController={selectionController}
                      grabbed={columnGrabbed}
                      columnWidth={col.width}
                      rowHeight={rowOptions.height}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <TableDragCloneContainer dragging={Boolean(grabTarget)} />
      <TableColumnResizer />
      <TableRowResizer />
      <TableStickyFrontier />
    </div>
  );
});

const RowNumberHeaderCell = ({
  stickyLeft,
  stickyTop,
  isStickyLeftFrontier,
  isStickyTopFrontier,
  isAfterStickyLeftFrontier,
  isAfterStickyTopFrontier,
  stickyLeftFrontierColumnIndex,
  onStickyLeftFrontierChange,
  stickyTopFrontierRowIndex,
  onStickyTopFrontierChange,
  resizable,
  columnMinWidth,
  columnMaxWidth,
  onColumnResizeRequested,
  rowMinHeight,
  rowMaxHeight,
  onRowResizeRequested,
  onClick,
}) => {
  return (
    <th
      className="navi_row_number_cell"
      data-sticky-left={stickyLeft ? "" : undefined}
      data-sticky-top={stickyTop ? "" : undefined}
      data-sticky-left-frontier={isStickyLeftFrontier ? "" : undefined}
      data-sticky-top-frontier={isStickyTopFrontier ? "" : undefined}
      data-after-sticky-left-frontier={
        isAfterStickyLeftFrontier ? "" : undefined
      }
      data-after-sticky-top-frontier={isAfterStickyTopFrontier ? "" : undefined}
      style={{ textAlign: "center" }}
      onClick={onClick}
    >
      <TableCellStickyFrontier
        rowIndex={0}
        columnIndex={0}
        stickyLeftFrontierColumnIndex={stickyLeftFrontierColumnIndex}
        onStickyLeftFrontierChange={onStickyLeftFrontierChange}
        stickyTopFrontierRowIndex={stickyTopFrontierRowIndex}
        onStickyTopFrontierChange={onStickyTopFrontierChange}
      />

      {resizable && (
        <TableCellColumnResizeHandles
          columnIndex={0}
          onResizeRequested={onColumnResizeRequested}
          columnMinWidth={columnMinWidth}
          columnMaxWidth={columnMaxWidth}
        />
      )}
      {resizable && (
        <TableCellRowResizeHandles
          rowIndex={0}
          onResizeRequested={onRowResizeRequested}
          rowMinHeight={rowMinHeight}
          rowMaxHeight={rowMaxHeight}
        />
      )}
    </th>
  );
};
const RowNumberCell = ({
  stickyLeft,
  stickyTop,
  isStickyLeftFrontier,
  isStickyTopFrontier,
  isAfterStickyLeftFrontier,
  isAfterStickyTopFrontier,
  stickyLeftFrontierColumnIndex,
  onStickyLeftFrontierChange,
  stickyTopFrontierRowIndex,
  onStickyTopFrontierChange,
  row,
  columns,
  rowWithSomeSelectedCell,
  selectionController,
  value,
  resizable,
  rowIndex,
  rowMinHeight,
  rowMaxHeight,
  onResizeRequested,
  style,
}) => {
  const cellRef = useRef();

  const rowValue = `row:${row.id}`;
  const { selected } = useSelectableElement(cellRef, {
    selectionController,
    selectionImpact: () => {
      // Return all data cells in this row that should be impacted
      return columns.map((col) => `${col.accessorKey}:${row.id}`);
    },
  });

  const rowContainsSelectedCell = rowWithSomeSelectedCell.includes(row.id);

  return (
    <td
      ref={cellRef}
      data-sticky-left={stickyLeft ? "" : undefined}
      data-sticky-top={stickyTop ? "" : undefined}
      data-sticky-left-frontier={isStickyLeftFrontier ? "" : undefined}
      data-sticky-top-frontier={isStickyTopFrontier ? "" : undefined}
      data-after-sticky-left-frontier={
        isAfterStickyLeftFrontier ? "" : undefined
      }
      data-after-sticky-top-frontier={isAfterStickyTopFrontier ? "" : undefined}
      className="navi_row_number_cell"
      data-row-contains-selected={rowContainsSelectedCell ? "" : undefined}
      data-value={rowValue}
      data-selection-name="row"
      data-selection-keyboard-toggle
      aria-selected={selected}
      style={{ textAlign: "center", ...style }}
      tabIndex={-1}
    >
      {value}
      <TableCellStickyFrontier
        columnIndex={0}
        rowIndex={rowIndex}
        stickyLeftFrontierColumnIndex={stickyLeftFrontierColumnIndex}
        onStickyLeftFrontierChange={onStickyLeftFrontierChange}
        stickyTopFrontierRowIndex={stickyTopFrontierRowIndex}
        onStickyTopFrontierChange={onStickyTopFrontierChange}
      />

      {resizable && (
        <TableCellRowResizeHandles
          rowIndex={rowIndex}
          onResizeRequested={onResizeRequested}
          rowMinHeight={rowMinHeight}
          rowMaxHeight={rowMaxHeight}
        />
      )}
    </td>
  );
};

const HeaderCell = ({
  stickyLeft,
  stickyTop,
  isStickyLeftFrontier,
  isStickyTopFrontier,
  isAfterStickyLeftFrontier,
  isAfterStickyTopFrontier,
  stickyLeftFrontierColumnIndex,
  onStickyLeftFrontierChange,
  stickyTopFrontierRowIndex,
  onStickyTopFrontierChange,
  columnAccessorKey,
  columnWithSomeSelectedCell,
  columnMinWidth,
  columnMaxWidth,
  data,
  selectionController,
  grabbed,
  columnIndex,
  resizable,
  movable,
  onGrab,
  onDrag,
  onRelease,
  onResizeRequested,

  style,
  value,
}) => {
  const columnContainsSelectedCell =
    columnWithSomeSelectedCell.includes(columnAccessorKey);

  return (
    <TableCell
      cellId={`header:${columnAccessorKey}`}
      isHead={true}
      stickyLeft={stickyLeft}
      stickyTop={stickyTop}
      isStickyLeftFrontier={isStickyLeftFrontier}
      isStickyTopFrontier={isStickyTopFrontier}
      isAfterStickyLeftFrontier={isAfterStickyLeftFrontier}
      isAfterStickyTopFrontier={isAfterStickyTopFrontier}
      stickyLeftFrontierColumnIndex={stickyLeftFrontierColumnIndex}
      onStickyLeftFrontierChange={onStickyLeftFrontierChange}
      grabbed={grabbed}
      style={style}
      cursor={grabbed ? "grabbing" : movable ? "grab" : undefined}
      selectionController={selectionController}
      value={value}
      // Header-specific data attributes
      boldClone // ensure column width does not change when header becomes strong
      onMouseDown={(e) => {
        if (!movable) {
          return;
        }
        if (e.button !== 0) {
          return;
        }
        initDragTableColumnByMousedown(e, {
          onGrab,
          onDrag,
          onRelease,
        });
      }}
      selectionImpact={() => {
        const columnCells = data.map((row) => `${columnAccessorKey}:${row.id}`);
        return columnCells;
      }}
      columnContainsSelectedCell={columnContainsSelectedCell}
    >
      <TableCellStickyFrontier
        rowIndex={0}
        columnIndex={columnIndex}
        stickyLeftFrontierColumnIndex={stickyLeftFrontierColumnIndex}
        onStickyLeftFrontierChange={onStickyLeftFrontierChange}
        stickyTopFrontierRowIndex={stickyTopFrontierRowIndex}
        onStickyTopFrontierChange={onStickyTopFrontierChange}
      />
      {resizable && (
        <TableCellColumnResizeHandles
          columnIndex={columnIndex}
          columnMinWidth={columnMinWidth}
          columnMaxWidth={columnMaxWidth}
          onResizeRequested={onResizeRequested}
        />
      )}
    </TableCell>
  );
};

const DataCell = ({
  isStickyLeftFrontier,
  stickyLeftFrontierColumnIndex,
  onStickyLeftFrontierChange,
  isStickyTopFrontier,
  stickyTopFrontierRowIndex,
  onStickyTopFrontierChange,
  columnName,
  columnIndex,
  rowIndex,
  row,
  ...rest
}) => {
  return (
    <TableCell cellId={`${columnName}:${row.id}`} {...rest}>
      <TableCellStickyFrontier
        rowIndex={rowIndex}
        columnIndex={columnIndex}
        stickyLeftFrontierColumnIndex={stickyLeftFrontierColumnIndex}
        onStickyLeftFrontierChange={onStickyLeftFrontierChange}
        stickyTopFrontierRowIndex={stickyTopFrontierRowIndex}
        onStickyTopFrontierChange={onStickyTopFrontierChange}
      />
    </TableCell>
  );
};
