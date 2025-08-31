/**
 *
 * Next steps:
 *
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
 *
 * border-block-end might be the solution to fill partial borders
 * maybe also https://developer.mozilla.org/fr/docs/Web/CSS/border-inline-start-color
 *
 */

import { useSignal } from "@preact/signals";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useLayoutEffect, useRef } from "preact/hooks";
import {
  useSelectableElement,
  useSelectionProvider,
} from "../selection/selection.jsx";
import { useFocusGroup } from "../use_focus_group.js";
import { TableSelectionBorders } from "./table_selection_borders.jsx";

/* Border collapse using box-shadow */
/* Each cell owns its bottom and right borders via box-shadow */
/* This simulates border-collapse: collapse behavior */
/* .navi_table tbody td: only bottom and right borders */
/* .navi_table thead tr:not(:first-child) th: no top border (owned by row above) */
/* .navi_table th:not(:first-child), .navi_table td:not(:first-child): no left border (owned by cell to left) */

import.meta.css = /* css */ `
  .navi_table_container {
    --border-color: #e0e0e0;

    --z-index-focused: 0; /* must be above selection and anything else  */
    --z-index-sticky-cell: 1; /* must be above selection  */
    --z-index-sticky-row: 2; /* must be above selection sticky cell  */
    --z-index-sticky-corner: 3; /* must be above first column and first row  */

    position: relative;
  }

  .navi_table {
    border-radius: 2px;
    border-spacing: 0; /* Required for manual border collapse */
  }

  .navi_table th,
  .navi_table td {
    border: none; /* Remove default borders - we'll use pseudo-elements */
    position: relative; /* Required for pseudo-element positioning */
    white-space: nowrap;
  }

  /* Table borders using ::before pseudo-elements */
  .navi_table th::before,
  .navi_table td::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    /* Default: bottom and right borders (owned by this cell) */
    box-shadow:
      0 0 0 0 var(--border-color),
      /* Placeholder for top */ 1px 0 0 0 var(--border-color),
      /* Right border */ 0 1px 0 0 var(--border-color),
      /* Bottom border */ 0 0 0 0 var(--border-color); /* Placeholder for left */
  }
  /* First row gets top border */
  .navi_table tr:first-child th::before,
  .navi_table tr:first-child td::before {
    /* Extend to include top border */
    box-shadow:
      0 -1px 0 0 var(--border-color),
      /* Top border */ 1px 0 0 0 var(--border-color),
      /* Right border */ 0 1px 0 0 var(--border-color),
      /* Bottom border */ 0 0 0 0 var(--border-color); /* Placeholder for left */
  }
  /* First column gets left border */
  .navi_table th:first-child::before,
  .navi_table td:first-child::before {
    box-shadow:
      0 0 0 0 var(--border-color),
      /* Placeholder for top */ 1px 0 0 0 var(--border-color),
      /* Right border */ 0 1px 0 0 var(--border-color),
      /* Bottom border */ -1px 0 0 0 var(--border-color); /* Left border */
  }
  /* First row first column gets all borders */
  .navi_table tr:first-child th:first-child::before,
  .navi_table tr:first-child td:first-child::before {
    box-shadow:
      0 -1px 0 0 var(--border-color),
      /* Top border */ 1px 0 0 0 var(--border-color),
      /* Right border */ 0 1px 0 0 var(--border-color),
      /* Bottom border */ -1px 0 0 0 var(--border-color); /* Left border */
  }

  .navi_table th,
  .navi_table td {
    text-align: left;
  }

  .navi_table th {
    background: lightgrey;
    font-weight: normal;
    padding: 12px 8px;
  }

  .navi_table td,
  .navi_table th {
    padding: 0;
    padding: 8px;
    user-select: none;
    position: relative;
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
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border: 2px solid #0078d4;
    pointer-events: none;
  }
  .navi_table tr + tr td:focus::after,
  .navi_table tr + tr th:focus::after {
    top: -1px; /* Include top border */
  }
  .navi_table td + td:focus::after,
  .navi_table th + th:focus::after {
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
  .navi_table tr[data-sticky] {
    position: sticky;
    top: 0;
    z-index: var(--z-index-sticky-row);
  }
  .navi_table tr[data-sticky] th[data-sticky] {
    position: sticky;
    top: 0;
  }
  .navi_table th[data-sticky] {
    z-index: var(--z-index-sticky-corner);
  }
  .navi_table td[data-sticky],
  .navi_table th[data-sticky] {
    position: sticky;
    left: 0;
  }
  .navi_table td[data-sticky] {
    z-index: var(--z-index-sticky-cell);
  }

  /* Sticky columns/rows border collapse using box-shadow on ::before pseudo-elements */
  /* Border collapse simulation: each cell owns its bottom and right borders */
  /* When adjacent to sticky cells, we need to adjust the box-shadow to maintain borders */

  /* Cells after sticky rows need top border restored */
  .navi_table tr[data-sticky] + tr td::before,
  .navi_table tr[data-sticky] + tr th::before {
    box-shadow:
      0 -1px 0 0 var(--border-color),
      /* Top border */ 1px 0 0 0 var(--border-color),
      /* Right border */ 0 1px 0 0 var(--border-color),
      /* Bottom border */ 0 0 0 0 var(--border-color); /* Placeholder for left */
  }

  /* Cells after sticky columns need left border restored */
  .navi_table th[data-sticky] + th::before,
  .navi_table td[data-sticky] + td::before {
    box-shadow:
      0 0 0 0 var(--border-color),
      /* Placeholder for top */ 1px 0 0 0 var(--border-color),
      /* Right border */ 0 1px 0 0 var(--border-color),
      /* Bottom border */ -1px 0 0 0 var(--border-color); /* Left border */
  }

  /* Sticky column cells (first column) get thick right border and normal top/bottom */
  .navi_table td[data-sticky]:first-child::before,
  .navi_table th[data-sticky]:first-child::before {
    box-shadow:
      0 0 0 0 var(--border-color),
      /* Placeholder for top */ 5px 0 0 0 var(--border-color),
      /* Thick right border */ 0 1px 0 0 var(--border-color),
      /* Bottom border */ -1px 0 0 0 var(--border-color); /* Left border */
  }

  /* Sticky row cells (first row) get thick bottom border and normal left/right */
  .navi_table tr[data-sticky]:first-child th::before,
  .navi_table tr[data-sticky]:first-child td::before {
    box-shadow:
      0 -1px 0 0 var(--border-color),
      /* Top border */ 1px 0 0 0 var(--border-color),
      /* Right border */ 0 5px 0 0 var(--border-color),
      /* Thick bottom border */ 0 0 0 0 var(--border-color); /* Placeholder for left */
  }

  /* Corner cell (sticky row + sticky column) gets thick borders on both right and bottom */
  .navi_table tr[data-sticky]:first-child th[data-sticky]:first-child::before,
  .navi_table tr[data-sticky]:first-child td[data-sticky]:first-child::before {
    box-shadow:
      0 -1px 0 0 var(--border-color),
      /* Top border */ 5px 0 0 0 var(--border-color),
      /* Thick right border */ 0 5px 0 0 var(--border-color),
      /* Thick bottom border */ -1px 0 0 0 var(--border-color); /* Left border */
  }

  /* Sticky column cells after first row need top border */
  .navi_table tr:not(:first-child) td[data-sticky]:first-child::before,
  .navi_table tr:not(:first-child) th[data-sticky]:first-child::before {
    box-shadow:
      0 -1px 0 0 var(--border-color),
      /* Top border */ 5px 0 0 0 var(--border-color),
      /* Thick right border */ 0 1px 0 0 var(--border-color),
      /* Bottom border */ -1px 0 0 0 var(--border-color); /* Left border */
  }
`;

// Custom hook to detect when a sticky element becomes stuck
const useStickyDetection = (elementRef) => {
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return null;
    }
    return initDataStuck(element);
  }, []);
};
const initDataStuck = (element) => {
  // Detect sticky direction from computed styles
  const computedStyle = getComputedStyle(element);
  const left = computedStyle.left;
  const top = computedStyle.top;

  // Determine direction based on which sticky property is set
  let direction = "left"; // default
  if (top !== "auto" && top !== "0px" && computedStyle.position === "sticky") {
    direction = "top";
  } else if (
    left !== "auto" &&
    left !== "0px" &&
    computedStyle.position === "sticky"
  ) {
    direction = "left";
  } else if (computedStyle.position === "sticky") {
    // If position is sticky but no explicit left/top, check which is more likely
    // For table cells, left sticky is more common for first column
    if (element.tagName === "TH" && element.closest("thead")) {
      direction = "top";
    } else {
      direction = "left";
    }
  }

  const checkSticky = () => {
    const rect = element.getBoundingClientRect();
    const parent = element.parentElement;
    const parentRect = parent?.getBoundingClientRect();

    if (!parentRect) return;

    let isStuck = false;

    if (direction === "left") {
      // For left sticky: element is stuck when it's at left edge despite parent scrolling
      const expectedLeft = parentRect.left;
      isStuck = Math.abs(rect.left - expectedLeft) > 10; // Threshold for being "stuck"
    } else if (direction === "top") {
      const expectedTop = parentRect.top;
      isStuck = Math.abs(rect.top - expectedTop) > 10;
    }

    element.toggleAttribute("data-stuck", isStuck);
  };

  // Find scrollable ancestor
  let scrollParent = element.parentElement;
  while (scrollParent) {
    const style = getComputedStyle(scrollParent);
    if (
      style.overflow === "auto" ||
      style.overflow === "scroll" ||
      style.overflowX === "auto" ||
      style.overflowX === "scroll"
    ) {
      break;
    }
    scrollParent = scrollParent.parentElement;
  }

  const handleScroll = checkSticky;

  // Initial check
  checkSticky();

  // Add listeners
  if (scrollParent) {
    scrollParent.addEventListener("scroll", handleScroll, { passive: true });
  }
  window.addEventListener("scroll", handleScroll, { passive: true });
  return () => {
    if (scrollParent) {
      scrollParent.removeEventListener("scroll", handleScroll);
    }
    window.removeEventListener("scroll", handleScroll);
  };
};

export const Table = forwardRef((props, ref) => {
  let {
    columns,
    data,
    selection = [],
    selectionColor,
    selectionOpacity,
    onSelectionChange,
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

  return (
    <div className="navi_table_container">
      <SelectionProvider>
        <table
          ref={innerRef}
          className="navi_table"
          aria-multiselectable="true"
          data-multiselection={selection.length > 1 ? "" : undefined}
        >
          <thead>
            <tr data-sticky="">
              <RowNumberHeaderCell sticky />
              {columns.map((col, index) => (
                <HeaderCell
                  sticky={col.sticky}
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
            {data.map((row) => {
              const isRowSelected = selectedRowIds.includes(row.id);
              return (
                <tr
                  key={row.id}
                  data-row-id={row.id}
                  aria-selected={isRowSelected}
                >
                  <RowNumberCell
                    sticky
                    row={row}
                    rowWithSomeSelectedCell={rowWithSomeSelectedCell}
                    columns={columns}
                  />
                  {columns.map((col, colIndex) => (
                    <DataCell
                      sticky={col.sticky}
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

const RowNumberHeaderCell = ({ sticky }) => {
  return (
    <th
      className="navi_row_number_cell"
      data-sticky={sticky ? "" : undefined}
      style={{ textAlign: "center" }}
    >
      #
    </th>
  );
};
const RowNumberCell = ({ sticky, row, columns, rowWithSomeSelectedCell }) => {
  const cellRef = useRef();

  // Detect when this sticky element becomes stuck
  useStickyDetection(cellRef);

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
      data-sticky={sticky ? "" : undefined}
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
const HeaderCell = ({
  sticky,
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
      data-sticky={sticky ? "" : undefined}
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
const DataCell = ({ sticky, columnName, row, value }) => {
  const cellId = `${columnName}:${row.id}`;
  const cellRef = useRef();

  // Detect when this sticky element becomes stuck
  if (sticky) {
    useStickyDetection(cellRef);
  }

  const { selected } = useSelectableElement(cellRef);

  return (
    <td
      ref={cellRef}
      className="navi_data_cell"
      data-sticky={sticky ? "" : undefined}
      tabIndex={-1}
      data-value={cellId}
      data-selection-name="cell"
      aria-selected={selected}
    >
      {value}
    </td>
  );
};
