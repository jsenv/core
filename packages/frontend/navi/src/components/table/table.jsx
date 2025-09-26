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
import { useImperativeHandle, useMemo, useRef, useState } from "preact/hooks";
import { useKeyboardShortcuts } from "../keyboard_shortcuts/keyboard_shortcuts.js";
import { createSelectionKeyboardShortcuts } from "../selection/selection.jsx";
import { useFocusGroup } from "../use_focus_group.js";
import { TableDragCloneContainer } from "./drag/table_drag_clone_container.jsx";
import { TableColumnResizer, TableRowResizer } from "./resize/table_resize.jsx";
import {
  useTableSelection,
  useTableSelectionController,
} from "./selection/table_selection.js";
import { useStickyGroup } from "./sticky/sticky_group.js";
import { TableStickyFrontier } from "./sticky/table_sticky.jsx";
import { TableCell } from "./table_cell.jsx";
import {
  TableCellProvider,
  TableColumnProvider,
  TableDragProvider,
  TableRowProvider,
  TableSelectionProvider,
  TableStickyProvider,
} from "./table_context.jsx";

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

export const createRowNumberColumn = () => {
  return {
    id: "row-number",
    head: (props, key) => {
      const { selectAll } = useTableSelection();
      return (
        <TableCell
          key={key}
          {...props}
          value="coucou"
          onClick={() => {
            selectAll();
          }}
        />
      );
    },

    minWidth: 30,
    width: 50,
    textAlign: "center",
    cell: ({ TableCell }) => {
      return <TableCell className="navi_row_number_cell" />;
    },
  };
};

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
            allCellIds.push(`${col.id}:${row.id}`);
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

  const needTableHead = columns.some((col) => col.header !== undefined);

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
          {columns.map((column, index) => {
            const colIsSticky = index < stickyLeftFrontierColumnIndex;
            return (
              <col
                key={column.id}
                data-sticky-left={colIsSticky ? "" : undefined}
                data-drag-sticky-left-frontier={colIsSticky ? "" : undefined}
                data-drag-obstacle={
                  column.immovable ? "move-column" : undefined
                }
                style={{
                  minWidth: column.width ? `${column.width}px` : undefined,
                  maxWidth: column.width ? `${column.width}px` : undefined,
                }}
              />
            );
          })}
        </colgroup>
        <TableSelectionProvider
          value={{
            selectionController,
            rowWithSomeSelectedCell,
            columnWithSomeSelectedCell,
            selectedRowIds,
          }}
        >
          <TableDragProvider
            value={{
              grabTarget,
              grabColumn,
              releaseColumn,
            }}
          >
            <TableStickyProvider
              value={{
                stickyLeftFrontierColumnIndex,
                stickyTopFrontierRowIndex,
                onStickyLeftFrontierChange,
                onStickyTopFrontierChange,
              }}
            >
              {/* {needTableHead && (
          <TableHead
            tableRef={ref}
            grabTarget={grabTarget}
            grabColumn={grabColumn}
            releaseColumn={releaseColumn}
            columnWithSomeSelectedCell={columnWithSomeSelectedCell}
            columns={columns}
            data={data}
            firstRow={rows[0] || {}}
            stickyLeftFrontierColumnIndex={stickyLeftFrontierColumnIndex}
            stickyTopFrontierRowIndex={stickyTopFrontierRowIndex}
            onStickyLeftFrontierChange={onStickyLeftFrontierChange}
            onStickyTopFrontierChange={onStickyTopFrontierChange}
            onRowResize={onRowResize}
            onColumnResize={onColumnResize}
            selectionController={selectionController}
          />
        )} */}
              <TableBody
                columns={columns}
                data={data}
                rows={rows}
                selectedRowIds={selectedRowIds}
                stickyTopFrontierRowIndex={stickyTopFrontierRowIndex}
              />
            </TableStickyProvider>
          </TableDragProvider>
        </TableSelectionProvider>
      </table>

      <TableDragCloneContainer dragging={Boolean(grabTarget)} />
      <TableColumnResizer />
      <TableRowResizer />
      <TableStickyFrontier />
    </div>
  );
});

const TableBody = ({
  columns,
  data,
  rows,
  selectedRowIds,
  stickyTopFrontierRowIndex,
}) => {
  return (
    <tbody>
      {data.map((rowData, rowIndex) => {
        const row = rows[rowIndex] || {};
        const isRowSelected = selectedRowIds.includes(row.id);
        const rowIsSticky = rowIndex < stickyTopFrontierRowIndex;
        const isStickyTopFrontier = rowIndex + 1 === stickyTopFrontierRowIndex;

        return (
          <TableRowProvider key={row.id} value={row}>
            <tr
              data-row-id={row.id}
              aria-selected={isRowSelected}
              data-sticky-top={rowIsSticky ? "" : undefined}
              data-drag-sticky-top-frontier={
                isStickyTopFrontier ? "" : undefined
              }
              style={{
                height: row.height ? `${row.height}px` : undefined,
                maxHeight: row.height ? `${row.height}px` : undefined,
              }}
            >
              {columns.map((column, columnIndex) => {
                const columnValue = useMemo(() => {
                  return { ...column, index: columnIndex };
                }, [column, columnIndex]);
                const tableCellId = `${column.id}:${row.id}`;
                const { cell } = column;
                let tableCell;
                if (typeof cell === "function") {
                  tableCell = cell({
                    column,
                    cellId: tableCellId,
                    columnIndex,
                    rowIndex,
                    data,
                    rowData,
                  });
                } else {
                  tableCell = <TableCell value={cell} />;
                }

                const tableCellContextValue = { columnIndex, rowIndex };

                return (
                  <TableColumnProvider key={tableCellId} value={columnValue}>
                    <TableCellProvider value={tableCellContextValue}>
                      {tableCell}
                    </TableCellProvider>
                  </TableColumnProvider>
                );
              })}
            </tr>
          </TableRowProvider>
        );
      })}
    </tbody>
  );
};
