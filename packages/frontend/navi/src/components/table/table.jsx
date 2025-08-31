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

import.meta.css = /* css */ `
  .navi_table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #e0e0e0;
    border-radius: 2px;
  }

  .navi_table th,
  .navi_table td {
    border: 1px solid #e0e0e0;
    text-align: left;
  }

  .navi_table th {
    /* background: #lightgrey; */
    font-weight: normal;
    padding: 12px 8px;
  }

  .navi_table td,
  .navi_table th {
    padding: 0;
    padding: 8px;
    user-select: none;
  }

  .navi_table td:focus,
  .navi_table th:focus {
    outline: 2px solid #0078d4;
    outline-offset: -1.5px;
    z-index: 1;
  }

  .navi_table td[data-sticky],
  .navi_table th[data-sticky] {
    position: sticky;
    left: 0;
  }

  /* When sticky elements are actually stuck, use outline for borders to avoid doubling */
  .navi_table td[data-sticky][data-stuck],
  .navi_table th[data-sticky][data-stuck] {
    border-left: none;
    border-right: none;
    outline: 1px solid #e0e0e0;
    outline-offset: -1px;
  }

  .navi_table thead[data-sticky] {
    position: sticky;
    top: 0;
  }
  .navi_table thead[data-sticky] th[data-sticky] {
    position: static;
    left: 0;
    top: 0;
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
    font-weight: 500;
    color: #444;
  }
  /* Absolutely positioned left border indicator for rows with selected cells */
  td[data-row-contains-selected]::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: rgba(128, 128, 128, 0.3);
    pointer-events: none;
    z-index: 1;
  }
  th[data-column-contains-selected] {
    font-weight: 600;
    color: #444;
  }
  /* Absolutely positioned top border indicator for columns with selected cells */
  th[data-column-contains-selected]::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 4px;
    background: rgba(128, 128, 128, 0.4);
    pointer-events: none;
    z-index: 1;
  }

  /* Container for table with relative positioning */
  .table_container {
    position: relative;
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
  let { columns, data, selection = [], onSelectionChange } = props;

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
    <div className="table_container">
      <SelectionProvider>
        <table
          ref={innerRef}
          className="navi_table"
          aria-multiselectable="true"
          data-multiselection={selection.length > 1 ? "" : undefined}
        >
          <thead data-sticky="">
            <tr>
              <RowNumberHeaderCell sticky />
              {columns.map((col, index) => (
                <HeaderCell
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
                    sticky={true}
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
      <TableSelectionBorders tableRef={innerRef} />
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
