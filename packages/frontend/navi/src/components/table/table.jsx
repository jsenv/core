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
 * Next steps:
 * - Vérifier comment ça rend avec sticky + sans border collapse
 * - Si on est satisfait on va essayer d'implementer le border collapse
 * - Fixed first row
 * - Fixed first column
 * - Shortcuts to act on selection
 * - Resizing columns
 * - Resizing rows
 * - Drag to reorder columns
 * - Drag to reorder rows (won't be possible with database so not for now)
 * - Double click to edit (see table_data.jsx)
 * - Space to edit with text selected
 * - A-Z key to edit with text replaced by this key
 * - A last row with buttons like a delete button with a delete icon
 * - Ability to delete a row (button + a shortcut key cmd + delete) with a confirmation message
 * - Ability to update a cell (double click to edit, enter to validate, esc to cancel)
 */

import { useSignal } from "@preact/signals";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import {
  useSelectableElement,
  useSelectionProvider,
} from "../selection/selection.jsx";
import { useFocusGroup } from "../use_focus_group.js";
import { useStickyGroup } from "./sticky_group.js";
import { TableSelectionBorders } from "./table_selection_borders.jsx";

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
    --border-color: red;
    --sticky-border-size: 5px;
    --sticky-border-color: yellow;

    --z-index-focused: 0; /* must be above selection and anything else  */
    /* needed because cell uses position:relative, sticky must win even if before in DOM order */
    --z-index-sticky-row: 100;
    --z-index-sticky-column: 1000;
    --z-index-sticky-corner: 10000;

    position: relative;
  }

  .navi_table {
    border-radius: 2px;
    border-spacing: 0; /* Required for manual border collapse */
    contain: layout style;
  }

  .navi_table th,
  .navi_table td {
    white-space: nowrap;
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
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table th,
  .navi_table td {
    text-align: left;
    background: white;
  }

  .navi_table th {
    background: lightgrey;
    font-weight: normal;
    padding: 12px 8px;
  }

  .navi_table td {
    padding: 12px 8px;
    user-select: none;
  }

  .navi_table th {
    user-select: none;
  }

  /* Sticky column cells need extra padding-right for thick border */
  .navi_table td[data-sticky-x]:first-child,
  .navi_table th[data-sticky-x]:first-child {
    padding-right: calc(8px + var(--sticky-border-size));
  }

  /* Sticky row cells need extra padding-bottom for thick border */
  .navi_table tr[data-sticky-y]:first-child th,
  .navi_table tr[data-sticky-y]:first-child td {
    padding-bottom: calc(8px + var(--sticky-border-size));
  }

  /* Corner cell (sticky row + sticky column) needs both extra paddings */
  .navi_table tr[data-sticky-y]:first-child th[data-sticky-x]:first-child,
  .navi_table tr[data-sticky-y]:first-child td[data-sticky-x]:first-child {
    padding-right: calc(8px + var(--sticky-border-size));
    padding-bottom: calc(8px + var(--sticky-border-size));
  }

  .navi_table td:focus,
  .navi_table th:focus {
    outline: none; /* Remove default outline */
    z-index: var(--z-index-focused);
  }

  .navi_table td:focus::after,
  .navi_table th:focus::after {
    content: "";
    position: absolute;
    /* Default: include bottom and right borders (owned by this cell) */
    inset: 0;
    border: 2px solid #0078d4;
    pointer-events: none;
  }
  .navi_table[data-border-collapse] tr + tr td:focus::after,
  .navi_table[data-border-collapse] tr + tr th:focus::after {
    top: -1px; /* Include top border */
  }
  .navi_table[data-border-collapse] td + td:focus::after,
  .navi_table[data-border-collapse] th + th:focus::after {
    left: -1px; /* Include left border */
  }

  /* Number column specific styling */
  .navi_row_number_cell {
    width: 50px;
    text-align: center;
    background: #fafafa;
    font-weight: 500;
    color: #666;
    user-select: none;
  }

  .navi_table_cell_content_bold_clone {
    font-weight: 600; /* force bold to compute max width */
    visibility: hidden; /* not visible */
    display: block; /* in-flow so it contributes to width */
    height: 0; /* zero height so it doesn't change layout height */
    overflow: hidden; /* avoid any accidental height */
    pointer-events: none; /* inert */
  }

  /* Selection */
  .navi_table td[aria-selected="true"],
  .navi_table th[aria-selected="true"] {
    background-color: rgba(0, 120, 212, 0.08);
  }
  /* Column selection styling */
  .navi_table .navi_row_number_cell[aria-selected="true"],
  .navi_table th[aria-selected="true"] {
    background-color: lightgrey;
    font-weight: bold;
  }
  td[data-row-contains-selected] {
    position: relative;
    font-weight: 500;
    color: #444;
  }

  th[data-column-contains-selected] {
    position: relative;
    font-weight: 600;
    color: #444;
  }

  /* Stickyness */
  .navi_table th[data-sticky-y],
  .navi_table td[data-sticky-y] {
    position: sticky;
    top: var(--sticky-group-top, 0);
    z-index: var(--z-index-sticky-row);
  }
  .navi_table th[data-sticky-x],
  .navi_table td[data-sticky-x] {
    position: sticky;
    left: var(--sticky-group-left, 0);
    z-index: var(--z-index-sticky-column);
  }
  .navi_table th[data-sticky-x][data-sticky-y],
  .navi_table td[data-sticky-x][data-sticky-y] {
    position: sticky;
    top: var(--sticky-group-top, 0);
    left: var(--sticky-group-left, 0);
    z-index: var(--z-index-sticky-corner);
  }

  /* Sticky border styling - works in both normal and border-collapse modes */

  /* Default mode: only last sticky elements get thick yellow borders */
  .navi_table td[data-sticky-x][data-last-sticky-column]::before,
  .navi_table th[data-sticky-x][data-last-sticky-column]::before {
    box-shadow:
      inset calc(-1 * var(--sticky-border-size)) 0 0 0
        var(--sticky-border-color),
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table th[data-sticky-y][data-last-sticky-row]::before,
  .navi_table td[data-sticky-y][data-last-sticky-row]::before {
    box-shadow:
      inset 0 calc(-1 * var(--sticky-border-size)) 0 0
        var(--sticky-border-color),
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color);
  }

  .navi_table
    th[data-sticky-x][data-sticky-y][data-last-sticky-column][data-last-sticky-row]::before,
  .navi_table
    td[data-sticky-x][data-sticky-y][data-last-sticky-column][data-last-sticky-row]::before {
    box-shadow:
      inset calc(-1 * var(--sticky-border-size)) 0 0 0
        var(--sticky-border-color),
      inset 0 calc(-1 * var(--sticky-border-size)) 0 0
        var(--sticky-border-color),
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color);
  }

  /* Border-collapse mode: Sticky columns/rows border adjustments */
  /* These rules only apply when border-collapse is enabled */

  /* Border-collapse mode: each cell only owns specific borders to avoid doubling */
  .navi_table[data-border-collapse] th::before,
  .navi_table[data-border-collapse] td::before {
    box-shadow:
      1px 0 0 0 var(--border-color),
      0 1px 0 0 var(--border-color);
  }

  /* Border-collapse: First row gets top border in addition to right and bottom */
  .navi_table[data-border-collapse] tr:first-child th::before,
  .navi_table[data-border-collapse] tr:first-child td::before {
    box-shadow:
      0 -1px 0 0 var(--border-color),
      1px 0 0 0 var(--border-color),
      0 1px 0 0 var(--border-color);
  }

  /* Border-collapse: First column gets left border in addition to right and bottom */
  .navi_table[data-border-collapse] th:first-child::before,
  .navi_table[data-border-collapse] td:first-child::before {
    box-shadow:
      -1px 0 0 0 var(--border-color),
      1px 0 0 0 var(--border-color),
      0 1px 0 0 var(--border-color);
  }

  /* Border-collapse: First row first column gets all four borders */
  .navi_table[data-border-collapse] tr:first-child th:first-child::before,
  .navi_table[data-border-collapse] tr:first-child td:first-child::before {
    box-shadow:
      0 -1px 0 0 var(--border-color),
      -1px 0 0 0 var(--border-color),
      1px 0 0 0 var(--border-color),
      0 1px 0 0 var(--border-color);
  }

  /* Border-collapse: Cells after sticky rows need top border restored */
  .navi_table[data-border-collapse] th[data-sticky-y] + th::before,
  .navi_table[data-border-collapse] td[data-sticky-y] + td::before {
    box-shadow:
      0 -1px 0 0 var(--border-color),
      1px 0 0 0 var(--border-color),
      0 1px 0 0 var(--border-color);
  }

  /* Border-collapse: Cells after sticky columns need left border restored */
  .navi_table[data-border-collapse] th[data-sticky-x] + th::before,
  .navi_table[data-border-collapse] td[data-sticky-x] + td::before {
    box-shadow:
      -1px 0 0 0 var(--border-color),
      1px 0 0 0 var(--border-color),
      0 1px 0 0 var(--border-color);
  }

  /* Border-collapse: Header row cells after sticky columns need top + left border */
  .navi_table[data-border-collapse]
    tr:first-child
    th[data-sticky-x]
    + th::before {
    box-shadow:
      0 -1px 0 0 var(--border-color),
      -1px 0 0 0 var(--border-color),
      1px 0 0 0 var(--border-color),
      0 1px 0 0 var(--border-color);
  }
`;

export const Table = forwardRef((props, ref) => {
  let {
    columns,
    rows = [],
    data,
    selection = [],
    selectionColor,
    selectionOpacity,
    onSelectionChange,
    borderCollapse = false,
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => {
    return {
      element: innerRef.current,
      clearSelection: () => {
        selectionSignal.value = [];
      },
      selectAll: () => {
        // Select all data cells (not row/column selectors)
        const allCellIds = [];
        data.forEach((row) => {
          columns.forEach((col) => {
            allCellIds.push(`${col.accessorKey}:${row.id}`);
          });
        });
        selectionSignal.value = allCellIds;
      },
    };
  });

  const selectionSignal = useSignal(selection);
  selection = selectionSignal.value;
  const rowWithSomeSelectedCell = [];
  const columnWithSomeSelectedCell = [];
  const selectedRowIds = [];
  const selectedColumnIds = [];
  const cellsByRow = new Map();
  const cellsByColumn = new Map();
  for (const item of selection) {
    if (item.startsWith("row:")) {
      const rowId = item.slice(4);
      selectedRowIds.push(rowId);
      continue;
    }
    if (item.startsWith("column:")) {
      const columnId = item.slice(7);
      selectedColumnIds.push(columnId);
      continue;
    }

    const [columnName, rowId] = item.split(":");

    // Track cells by row
    if (!cellsByRow.has(rowId)) {
      cellsByRow.set(rowId, []);
    }
    cellsByRow.get(rowId).push(columnName);

    // Track cells by column
    if (!cellsByColumn.has(columnName)) {
      cellsByColumn.set(columnName, []);
    }
    cellsByColumn.get(columnName).push(rowId);

    // Add to some-selected tracking
    if (!rowWithSomeSelectedCell.includes(rowId)) {
      rowWithSomeSelectedCell.push(rowId);
    }
    if (!columnWithSomeSelectedCell.includes(columnName)) {
      columnWithSomeSelectedCell.push(columnName);
    }
  }

  const SelectionProvider = useSelectionProvider({
    elementRef: innerRef,
    layout: "grid",
    value: selection,
    onChange: (value) => {
      selectionSignal.value = value;
      onSelectionChange(value);
    },
    selectAllName: "cell",
  });
  useFocusGroup(innerRef);
  useStickyGroup(innerRef);

  // Calculate last sticky column and row indexes
  const lastStickyColumnIndex = columns.reduce((lastIndex, col, index) => {
    return col.sticky ? index : lastIndex;
  }, -1);

  const lastStickyRowIndex = data.reduce((lastIndex, row, index) => {
    const rowOptions = rows[index] || {};
    return rowOptions.sticky ? index : lastIndex;
  }, -1);

  return (
    <div className="navi_table_container">
      <SelectionProvider>
        <table
          ref={innerRef}
          className="navi_table"
          aria-multiselectable="true"
          data-multiselection={selection.length > 1 ? "" : undefined}
          data-border-collapse={borderCollapse ? "" : undefined}
        >
          <thead>
            <tr>
              <RowNumberHeaderCell
                sticky
                isLastStickyColumn={lastStickyColumnIndex === -1} // Only sticky if no other columns are sticky
                isLastStickyRow={lastStickyRowIndex === -1} // Only sticky if no other rows are sticky
                onClick={() => {
                  ref.current.selectAll();
                }}
              />
              {columns.map((col, index) => (
                <HeaderCell
                  sticky={col.sticky}
                  isLastStickyColumn={index === lastStickyColumnIndex}
                  isLastStickyRow={true} // Header row is always the last (and only) sticky row in header
                  key={col.id}
                  columnName={col.header}
                  columnAccessorKey={col.accessorKey}
                  columnIndex={index + 1}
                  columnWithSomeSelectedCell={columnWithSomeSelectedCell}
                  data={data}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => {
              const rowOptions = rows[rowIndex] || {};
              const isRowSelected = selectedRowIds.includes(row.id);
              const isLastStickyRow = rowIndex === lastStickyRowIndex;

              return (
                <tr
                  key={row.id}
                  data-row-id={row.id}
                  aria-selected={isRowSelected}
                >
                  <RowNumberCell
                    stickyX={true}
                    stickyY={rowOptions.sticky}
                    isLastStickyColumn={lastStickyColumnIndex === -1} // Only if no data columns are sticky
                    isLastStickyRow={isLastStickyRow}
                    row={row}
                    rowWithSomeSelectedCell={rowWithSomeSelectedCell}
                    columns={columns}
                  />
                  {columns.map((col, colIndex) => (
                    <DataCell
                      stickyX={col.sticky}
                      stickyY={rowOptions.sticky}
                      isLastStickyColumn={colIndex === lastStickyColumnIndex}
                      isLastStickyRow={isLastStickyRow}
                      key={`${row.id}-${col.id}`}
                      columnName={col.accessorKey}
                      columnIndex={colIndex + 1} // +1 because number column is first
                      row={row}
                      value={row[col.accessorKey]}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </SelectionProvider>
      <TableSelectionBorders
        tableRef={innerRef}
        color={selectionColor}
        opacity={selectionOpacity}
      />
    </div>
  );
});

const RowNumberHeaderCell = ({
  sticky,
  isLastStickyColumn,
  isLastStickyRow,
  ...rest
}) => {
  return (
    <th
      className="navi_row_number_cell"
      data-sticky-x={sticky ? "" : undefined}
      data-sticky-y={sticky ? "" : undefined}
      data-last-sticky-column={sticky && isLastStickyColumn ? "" : undefined}
      data-last-sticky-row={sticky && isLastStickyRow ? "" : undefined}
      style={{ textAlign: "center" }}
      {...rest}
    ></th>
  );
};
const HeaderCell = ({
  sticky,
  isLastStickyColumn,
  isLastStickyRow,
  columnName,
  columnAccessorKey,
  columnWithSomeSelectedCell,
  data,
}) => {
  const cellRef = useRef();
  const columnValue = `column:${columnAccessorKey}`;
  const { selected } = useSelectableElement(cellRef, {
    selectionImpact: () => {
      const columnCells = data.map((row) => `${columnAccessorKey}:${row.id}`);
      return columnCells;
    },
  });

  const columnContainsSelectedCell =
    columnWithSomeSelectedCell.includes(columnAccessorKey);
  return (
    <th
      ref={cellRef}
      data-column-contains-selected={
        columnContainsSelectedCell ? "" : undefined
      }
      data-value={columnValue}
      data-selection-name="column"
      data-selection-toggle-shortcut="space"
      aria-selected={selected}
      data-sticky-x={sticky ? "" : undefined}
      data-sticky-y=""
      data-last-sticky-column={sticky && isLastStickyColumn ? "" : undefined}
      data-last-sticky-row={isLastStickyRow ? "" : undefined}
      style={{ cursor: "pointer" }}
      tabIndex={-1}
    >
      <span>{columnName}</span>
      <span className="navi_table_cell_content_bold_clone" aria-hidden="true">
        {columnName}
      </span>
    </th>
  );
};
const RowNumberCell = ({
  stickyX,
  stickyY,
  isLastStickyColumn,
  isLastStickyRow,
  row,
  columns,
  rowWithSomeSelectedCell,
}) => {
  const cellRef = useRef();

  const rowValue = `row:${row.id}`;
  const { selected } = useSelectableElement(cellRef, {
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
      data-last-sticky-column={stickyX && isLastStickyColumn ? "" : undefined}
      data-last-sticky-row={stickyY && isLastStickyRow ? "" : undefined}
      className="navi_row_number_cell"
      data-row-contains-selected={rowContainsSelectedCell ? "" : undefined}
      data-value={rowValue}
      data-selection-name="row"
      data-selection-toggle-shortcut="space"
      aria-selected={selected}
      style={{ cursor: "pointer", textAlign: "center" }}
      tabIndex={-1}
    >
      {row.index}
    </td>
  );
};

const DataCell = ({
  stickyX,
  stickyY,
  isLastStickyColumn,
  isLastStickyRow,
  columnName,
  row,
  value,
}) => {
  const cellId = `${columnName}:${row.id}`;
  const cellRef = useRef();
  const { selected } = useSelectableElement(cellRef);

  return (
    <td
      ref={cellRef}
      className="navi_data_cell"
      data-sticky-x={stickyX ? "" : undefined}
      data-sticky-y={stickyY ? "" : undefined}
      data-last-sticky-column={stickyX && isLastStickyColumn ? "" : undefined}
      data-last-sticky-row={stickyY && isLastStickyRow ? "" : undefined}
      tabIndex={-1}
      data-value={cellId}
      data-selection-name="cell"
      aria-selected={selected}
    >
      {value}
    </td>
  );
};
