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
 * - Consider wrapping into a <div> to apply padding to the div
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
  TableColumnLeftResizeHandle,
  TableColumnResizer,
  TableColumnRightResizeHandle,
} from "./resize/resize_table_column.jsx";
import {
  TableRowBottomResizeHandle,
  TableRowResizer,
  TableRowTopResizeHandle,
} from "./resize/resize_table_row.jsx";
import {
  useTableSelection,
  useTableSelectionController,
} from "./selection/table_selection.js";
import { useStickyGroup } from "./sticky/sticky_group.js";
import {
  TableColumnStickyFrontier,
  TableColumnStickyFrontierGhost,
  TableColumnStickyFrontierPreview,
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
    columnStickyFrontierIndex = 0,
    onColumnStickyFrontierChange,
    rowStickyFrontierIndex = 0,
    // onRowStickyFrontierChange,
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

  const firstColIsSticky = columnStickyFrontierIndex > -1;
  const firsRowIsSticky = rowStickyFrontierIndex > -1;

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
            data-sticky-x={firstColIsSticky ? "" : undefined}
            data-drag-sticky-frontier-left={firstColIsSticky ? "" : undefined}
            data-drag-obstacle="move-column"
            style={{
              minWidth: `${generatedLeftColumnWidth}px`,
              maxWidth: `${generatedLeftColumnWidth}px`,
            }}
          ></col>
          {columns.map((col, index) => {
            const colIsSticky = index < columnStickyFrontierIndex;

            return (
              <col
                key={col.id}
                data-sticky-x={colIsSticky ? "" : undefined}
                data-drag-sticky-frontier-left={colIsSticky ? "" : undefined}
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
            data-sticky-y={firsRowIsSticky ? "" : undefined}
            data-drag-sticky-frontier-top={firsRowIsSticky ? "" : undefined}
            data-drag-obstacle="move-row"
            style={{
              height: generatedTopRowHeight
                ? `${generatedTopRowHeight}px`
                : undefined,
            }}
          >
            <RowNumberHeaderCell
              stickyX={firstColIsSticky}
              stickyY={firsRowIsSticky}
              isStickyXFrontier={columnStickyFrontierIndex <= 0} // Only frontier if no other columns are sticky
              isStickyYFrontier={rowStickyFrontierIndex <= 0} // Only frontier if no other rows are sticky
              columnStickyFrontierIndex={columnStickyFrontierIndex}
              onColumnStickyFrontierChange={onColumnStickyFrontierChange}
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
                  stickyX={colIndex < columnStickyFrontierIndex}
                  stickyY={firsRowIsSticky}
                  isStickyXFrontier={colIndex + 1 === columnStickyFrontierIndex}
                  isAfterStickyXFrontier={
                    colIndex + 1 === columnStickyFrontierIndex + 1
                  }
                  isStickyYFrontier={rowStickyFrontierIndex <= 0}
                  isAfterStickyYFrontier={false} // Header row can't be after sticky Y frontier
                  columnStickyFrontierIndex={columnStickyFrontierIndex}
                  onColumnStickyFrontierChange={onColumnStickyFrontierChange}
                  key={col.id}
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
            const rowIsSticky = rowIndex < rowStickyFrontierIndex;
            const isStickyYFrontier = rowIndex + 1 === rowStickyFrontierIndex;
            const isAfterStickyYFrontier =
              rowIndex + 1 === rowStickyFrontierIndex + 1;

            return (
              <tr
                key={rowData.id}
                data-row-id={rowData.id}
                aria-selected={isRowSelected}
                data-sticky-y={rowIsSticky ? "" : undefined}
                data-drag-sticky-frontier-top={
                  isStickyYFrontier ? "" : undefined
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
                  stickyX={firstColIsSticky}
                  isStickyXFrontier={columnStickyFrontierIndex <= 0} // Only if no data columns are sticky
                  isAfterStickyXFrontier={false} // Row number column can't be after sticky X frontier (it's the first column)
                  stickyY={rowIsSticky}
                  isStickyYFrontier={isStickyYFrontier}
                  isAfterStickyYFrontier={isAfterStickyYFrontier}
                  columnStickyFrontierIndex={columnStickyFrontierIndex}
                  onColumnStickyFrontierChange={onColumnStickyFrontierChange}
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
                  const columnIsSticky = colIndex < columnStickyFrontierIndex;

                  return (
                    <DataCell
                      key={`${rowData.id}-${col.id}`}
                      stickyX={columnIsSticky}
                      isStickyXFrontier={
                        colIndex + 1 === columnStickyFrontierIndex
                      }
                      isAfterStickyXFrontier={
                        colIndex + 1 === columnStickyFrontierIndex + 1
                      }
                      stickyY={rowIsSticky}
                      isStickyYFrontier={isStickyYFrontier}
                      isAfterStickyYFrontier={isAfterStickyYFrontier}
                      columnStickyFrontierIndex={columnStickyFrontierIndex}
                      onColumnStickyFrontierChange={
                        onColumnStickyFrontierChange
                      }
                      columnName={col.accessorKey}
                      columnIndex={colIndex + 1} // +1 because number column is first
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
      <TableColumnStickyFrontierGhost />
      <TableColumnStickyFrontierPreview />
    </div>
  );
});

const RowNumberHeaderCell = ({
  stickyX,
  stickyY,
  isStickyXFrontier,
  isStickyYFrontier,
  columnStickyFrontierIndex,
  onColumnStickyFrontierChange,
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
      data-sticky-x={stickyX ? "" : undefined}
      data-sticky-y={stickyY ? "" : undefined}
      data-sticky-x-frontier={stickyX && isStickyXFrontier ? "" : undefined}
      data-sticky-y-frontier={stickyY && isStickyYFrontier ? "" : undefined}
      style={{ textAlign: "center" }}
      onClick={onClick}
    >
      {isStickyXFrontier && (
        <TableColumnStickyFrontier
          columnStickyFrontierIndex={columnStickyFrontierIndex}
          onColumnStickyFrontierChange={onColumnStickyFrontierChange}
        />
      )}
      {resizable && (
        <TableColumnRightResizeHandle
          onRelease={(width) => onColumnResizeRequested(width, 0)}
          columnMinWidth={columnMinWidth}
          columnMaxWidth={columnMaxWidth}
        />
      )}
      {resizable && (
        <TableRowBottomResizeHandle
          onRelease={(height) => onRowResizeRequested(height, 0)}
          rowMinHeight={rowMinHeight}
          rowMaxHeight={rowMaxHeight}
        />
      )}
    </th>
  );
};
const HeaderCell = ({
  stickyX,
  stickyY,
  isStickyXFrontier,
  isStickyYFrontier,
  isAfterStickyXFrontier,
  isAfterStickyYFrontier,
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
  columnStickyFrontierIndex,
  onColumnStickyFrontierChange,
  style,
  value,
}) => {
  const columnContainsSelectedCell =
    columnWithSomeSelectedCell.includes(columnAccessorKey);

  return (
    <TableCell
      cellId={`header:${columnAccessorKey}`}
      isHead={true}
      stickyX={stickyX}
      stickyY={stickyY}
      isStickyXFrontier={isStickyXFrontier}
      isStickyYFrontier={isStickyYFrontier}
      isAfterStickyXFrontier={isAfterStickyXFrontier}
      isAfterStickyYFrontier={isAfterStickyYFrontier}
      columnStickyFrontierIndex={columnStickyFrontierIndex}
      onColumnStickyFrontierChange={onColumnStickyFrontierChange}
      grabbed={grabbed}
      style={style}
      cursor={grabbed ? "grabbing" : movable ? "grab" : undefined}
      selectionController={selectionController}
      value={value}
      // Header-specific data attributes
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
      {resizable && (
        <TableColumnLeftResizeHandle
          onRelease={(width) => onResizeRequested(width, columnIndex - 1)}
          columnMinWidth={columnMinWidth}
          columnMaxWidth={columnMaxWidth}
        />
      )}
      {resizable && (
        <TableColumnRightResizeHandle
          onRelease={(width) => onResizeRequested(width, columnIndex)}
          columnMinWidth={columnMinWidth}
          columnMaxWidth={columnMaxWidth}
        />
      )}
      {isStickyXFrontier && (
        <TableColumnStickyFrontier
          columnStickyFrontierIndex={columnStickyFrontierIndex}
          onColumnStickyFrontierChange={onColumnStickyFrontierChange}
        />
      )}
    </TableCell>
  );
};

const RowNumberCell = ({
  stickyX,
  stickyY,
  isStickyXFrontier,
  isStickyYFrontier,
  isAfterStickyXFrontier,
  isAfterStickyYFrontier,
  columnStickyFrontierIndex,
  onColumnStickyFrontierChange,
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
      data-sticky-x={stickyX ? "" : undefined}
      data-sticky-y={stickyY ? "" : undefined}
      data-sticky-x-frontier={stickyX && isStickyXFrontier ? "" : undefined}
      data-sticky-y-frontier={stickyY && isStickyYFrontier ? "" : undefined}
      data-after-sticky-x-frontier={isAfterStickyXFrontier ? "" : undefined}
      data-after-sticky-y-frontier={isAfterStickyYFrontier ? "" : undefined}
      className="navi_row_number_cell"
      data-row-contains-selected={rowContainsSelectedCell ? "" : undefined}
      data-value={rowValue}
      data-selection-name="row"
      data-selection-keyboard-toggle
      aria-selected={selected}
      style={{ textAlign: "center", ...style }}
      tabIndex={-1}
    >
      {resizable && (
        <TableRowTopResizeHandle
          onRelease={(height) => onResizeRequested(height, rowIndex - 1)}
          rowMinHeight={rowMinHeight}
          rowMaxHeight={rowMaxHeight}
        />
      )}
      {value}
      {isStickyXFrontier && (
        <TableColumnStickyFrontier
          columnStickyFrontierIndex={columnStickyFrontierIndex}
          onColumnStickyFrontierChange={onColumnStickyFrontierChange}
        />
      )}
      {resizable && (
        <TableRowBottomResizeHandle
          onRelease={(height) => onResizeRequested(height, rowIndex)}
          rowMinHeight={rowMinHeight}
          rowMaxHeight={rowMaxHeight}
        />
      )}
    </td>
  );
};

const DataCell = ({
  isStickyXFrontier,
  columnStickyFrontierIndex,
  onColumnStickyFrontierChange,
  columnName,
  row,
  ...rest
}) => {
  return (
    <TableCell cellId={`${columnName}:${row.id}`} {...rest}>
      {isStickyXFrontier && (
        <TableColumnStickyFrontier
          columnStickyFrontierIndex={columnStickyFrontierIndex}
          onColumnStickyFrontierChange={onColumnStickyFrontierChange}
        />
      )}
    </TableCell>
  );
};
