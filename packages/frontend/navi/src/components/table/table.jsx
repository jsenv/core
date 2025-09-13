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
 * - Drag to reorder columns
 *
 *  Et on veut créer une copie visuelle (<div><table>...</table></div>) avec des dimensions fixes qui correspondent
 *  a la colonne que l'on déplace en absolute
 *
 *  Pour faire cela je pense que lorsque le drag démarre on va avoir besoin d'une fonction qui append ce truc dans le body
 *  alors ptet qu'on peut le faire avec react apres tout let's go
 *
 *  Lorsqu'on "vide" la collone il faut juste s'assurer de cacher le contenu mais pas de la modifier réellement car
 *  on veut pas impacter le layout
 *
 * - Drag to reorder rows (won't be possible with database so not for now)
 * - Can add a column (+ button at the end of table headers)
 * - Can add a row (+ button at the end of the row number column )
 * - Resizing columns
 * - Resizing rows
 * - Delete a row (how?)
 * - Delete a column (how?)
 * - Rename a column (I guess with enter, double click, A-Z keys)
 * - Update table column info (I guess a down arrow icon which opens a meny when clicked for instance)
 */

import { startDragGesture } from "@jsenv/dom";
import { forwardRef } from "preact/compat";
import {
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import { useKeyboardShortcuts } from "../keyboard_shortcuts/keyboard_shortcuts.js";
import {
  createSelectionKeyboardShortcuts,
  useSelectableElement,
  useSelectionController,
} from "../selection/selection.jsx";
import { useFocusGroup } from "../use_focus_group.js";
import { useStickyGroup } from "./sticky_group.js";
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
    --selection-border-color: #0078d4;
    --focus-border-color: #0078d4;
    --selection-background-color: #eaf1fd;

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
    padding: 12px 8px;
  }

  .navi_table td {
    padding: 12px 8px;
    user-select: none;
  }

  .navi_table th {
    user-select: none;
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
    font-weight: bold; /* force bold to compute max width */
    visibility: hidden; /* not visible */
    display: block; /* in-flow so it contributes to width */
    height: 0; /* zero height so it doesn't change layout height */
    overflow: hidden; /* avoid any accidental height */
    pointer-events: none; /* inert */
  }

  /* Selection */
  .navi_table th[aria-selected="true"],
  .navi_table td[aria-selected="true"] {
    background-color: var(--selection-background-color);
  }
  td[data-row-contains-selected] {
    position: relative;
    font-weight: 500;
    color: #444;
  }

  th[data-column-contains-selected] {
    position: relative;
    font-weight: bold;
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

  /* Border-collapse mode: Sticky columns/rows border adjustments */
  /* These rules only apply when border-collapse is enabled */

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

  .navi_table [data-selection-border-top]::after {
    box-shadow: inset 0 1px 0 0 var(--selection-border-color);
  }

  .navi_table [data-selection-border-right]::after {
    box-shadow: inset -1px 0 0 0 var(--selection-border-color);
  }

  .navi_table [data-selection-border-bottom]::after {
    box-shadow: inset 0 -1px 0 0 var(--selection-border-color);
  }

  .navi_table [data-selection-border-left]::after {
    box-shadow: inset 1px 0 0 0 var(--selection-border-color);
  }

  /* Two border combinations */
  .navi_table [data-selection-border-top][data-selection-border-right]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color);
  }

  .navi_table [data-selection-border-top][data-selection-border-bottom]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  .navi_table [data-selection-border-top][data-selection-border-left]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }

  .navi_table
    [data-selection-border-right][data-selection-border-bottom]::after {
    box-shadow:
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  .navi_table [data-selection-border-right][data-selection-border-left]::after {
    box-shadow:
      inset -1px 0 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }

  .navi_table
    [data-selection-border-bottom][data-selection-border-left]::after {
    box-shadow:
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }

  /* Three border combinations */
  .navi_table
    [data-selection-border-top][data-selection-border-right][data-selection-border-bottom]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  .navi_table
    [data-selection-border-top][data-selection-border-bottom][data-selection-border-left]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }

  .navi_table
    [data-selection-border-top][data-selection-border-right][data-selection-border-left]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }

  .navi_table
    [data-selection-border-right][data-selection-border-bottom][data-selection-border-left]::after {
    box-shadow:
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }

  /* Four border combinations (full selection) */
  .navi_table
    [data-selection-border-top][data-selection-border-right][data-selection-border-bottom][data-selection-border-left]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }

  /* Base borders for sticky cells (will be overridden by frontier rules) */
  .navi_table[data-border-collapse] th[data-sticky-x]::before,
  .navi_table[data-border-collapse] td[data-sticky-x]::before {
    box-shadow:
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse] th[data-sticky-y]::before,
  .navi_table[data-border-collapse] td[data-sticky-y]::before {
    box-shadow:
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header row sticky cells need top border */
  .navi_table[data-border-collapse] th[data-sticky-x]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse] th[data-sticky-y]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* First column sticky cells need left border */
  .navi_table[data-border-collapse] th:first-child[data-sticky-x]::before,
  .navi_table[data-border-collapse] td:first-child[data-sticky-x]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse] th:first-child[data-sticky-y]::before,
  .navi_table[data-border-collapse] td:first-child[data-sticky-y]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header first column sticky cells get all four regular borders */
  .navi_table[data-border-collapse] th:first-child[data-sticky-x]::before,
  .navi_table[data-border-collapse] th:first-child[data-sticky-y]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Borders for cells immediately after sticky frontiers */

  /* Left border for the column after sticky-x-frontier */
  .navi_table[data-border-collapse] th[data-after-sticky-x-frontier]::before,
  .navi_table[data-border-collapse] td[data-after-sticky-x-frontier]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header cells after sticky-x-frontier also need top border (for border-collapse) */
  .navi_table[data-border-collapse] th[data-after-sticky-x-frontier]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Top border for the row after sticky-y-frontier */
  .navi_table[data-border-collapse] th[data-after-sticky-y-frontier]::before,
  .navi_table[data-border-collapse] td[data-after-sticky-y-frontier]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header cells after sticky-y-frontier also need left border (for border-collapse) */
  .navi_table[data-border-collapse] th[data-after-sticky-y-frontier]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* First column cells after sticky-y-frontier need all four borders (for border-collapse) */
  .navi_table[data-border-collapse]
    th:first-child[data-after-sticky-y-frontier]::before,
  .navi_table[data-border-collapse]
    td:first-child[data-after-sticky-y-frontier]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Corner case: cell after both sticky frontiers */
  .navi_table[data-border-collapse]
    th[data-after-sticky-x-frontier][data-after-sticky-y-frontier]::before,
  .navi_table[data-border-collapse]
    td[data-after-sticky-x-frontier][data-after-sticky-y-frontier]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset 0 1px 0 0 var(--border-color),
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

  /* Positioning adjustments for ::after pseudo-elements on cells adjacent to sticky frontiers */
  /* These ensure selection and focus borders align with the ::before borders */

  .navi_table[data-border-collapse] th[data-after-sticky-x-frontier]::after,
  .navi_table[data-border-collapse] td[data-after-sticky-x-frontier]::after {
    left: 0;
  }

  .navi_table[data-border-collapse] th[data-after-sticky-y-frontier]::after,
  .navi_table[data-border-collapse] td[data-after-sticky-y-frontier]::after {
    top: 0;
  }

  .navi_table_drag_placeholder {
    position: absolute;
    inset: 0;
    background: grey;
  }

  .navi_table_drag_clone_container {
    position: absolute;
    cursor: grabbing;
    user-select: none;
  }
`;

const NO_SELECTION = [];
export const Table = forwardRef((props, ref) => {
  let {
    stickyHeader = true,
    rowColumnSticky = true,
    columns,
    rows = [],
    data,
    selection,
    selectionColor,
    onSelectionChange,
    borderCollapse = false,
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

  const {
    rowWithSomeSelectedCell,
    columnWithSomeSelectedCell,
    selectedRowIds,
  } = useMemo(() => {
    const rowWithSomeSelectedCell = [];
    const columnWithSomeSelectedCell = [];
    const selectedRowIds = [];
    const selectedColumnIds = [];

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
      // Add to some-selected tracking
      if (!rowWithSomeSelectedCell.includes(rowId)) {
        rowWithSomeSelectedCell.push(rowId);
      }
      if (!columnWithSomeSelectedCell.includes(columnName)) {
        columnWithSomeSelectedCell.push(columnName);
      }
    }

    return {
      rowWithSomeSelectedCell,
      columnWithSomeSelectedCell,
      selectedRowIds,
      selectedColumnIds,
    };
  }, [selection]);

  const selectionController = useSelectionController({
    elementRef: innerRef,
    layout: "grid",
    value: selection,
    onChange: (value) => {
      onSelectionChange(value);
    },
    selectAllName: "cell",
  });
  useFocusGroup(innerRef);
  useStickyGroup(innerRef);
  useTableSelectionBorders(innerRef, selectionController);

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

  useLayoutEffect(() => {
    if (selectionColor) {
      innerRef.current?.style.setProperty(
        "--selection-border-color",
        selectionColor,
      );
    }
  }, [selectionColor]);

  // Calculate frontier sticky column and row indexes (boundary between sticky and non-sticky)
  let columnIndex = 0;
  let stickyColumnFrontierIndex = 0;
  while (columnIndex < columns.length) {
    const column = columns[columnIndex];
    columnIndex++;
    if (column.sticky) {
      stickyColumnFrontierIndex = columnIndex;
    } else {
      break;
    }
  }
  let stickyRowFrontierIndex = 0;
  let rowIndex = 0;
  while (rowIndex < rows.length) {
    const { sticky } = rows[rowIndex];
    rowIndex++;
    if (sticky) {
      stickyRowFrontierIndex = rowIndex;
    } else {
      break;
    }
  }

  const [grabTarget, setGrabTarget] = useState(null);
  const [grabTargetRect, setGrabTargetRect] = useState(null);
  const [dragPosition, setDragPosition] = useState(null);

  const startGrabbingColumn = (columnIndex) => {
    const table = innerRef.current;
    const columnHeaderCell =
      table.querySelector("thead tr").children[columnIndex + 1]; // +1 to skip row number column
    const columnClientRect = columnHeaderCell.getBoundingClientRect();
    const tableClientRect = table.getBoundingClientRect();
    // Calculate position relative to table
    const relativeRect = {
      left: columnClientRect.left - tableClientRect.left,
      top: columnClientRect.top - tableClientRect.top,
      width: columnClientRect.width,
      height: columnClientRect.height,
    };
    setGrabTarget(`column:${columnIndex}`);
    setGrabTargetRect(relativeRect);
  };
  const stopGrabbingColumn = () => {
    setGrabTarget(null);
    setGrabTargetRect(null);
    setDragPosition(null);
  };

  return (
    <div className="navi_table_container">
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
              stickyX={rowColumnSticky}
              stickyY={stickyHeader}
              isStickyXFrontier={
                rowColumnSticky && stickyColumnFrontierIndex === 0
              } // Only frontier if no other columns are sticky
              isStickyYFrontier={stickyHeader && stickyRowFrontierIndex === 0} // Only frontier if no other rows are sticky
              onClick={() => {
                ref.current.selectAll();
              }}
            />
            {columns.map((col, index) => {
              const columnIsGrabbed = grabTarget === `column:${index}`;

              return (
                <HeaderCell
                  stickyX={col.sticky}
                  stickyY={stickyHeader}
                  isStickyXFrontier={stickyColumnFrontierIndex === index + 1}
                  isAfterStickyXFrontier={
                    index + 1 === stickyColumnFrontierIndex + 1
                  }
                  isStickyYFrontier={
                    stickyHeader && stickyRowFrontierIndex === 0
                  } // Header row is always the frontier (no rows above it)
                  isAfterStickyYFrontier={false} // Header row can't be after sticky Y frontier
                  key={col.id}
                  columnAccessorKey={col.accessorKey}
                  columnIndex={index + 1}
                  columnWithSomeSelectedCell={columnWithSomeSelectedCell}
                  data={data}
                  selectionController={selectionController}
                  grabbed={columnIsGrabbed}
                  onGrab={() => {
                    startGrabbingColumn(index);
                    setDragPosition([0, 0]);
                  }}
                  onDrag={({ xMove, yMove }) => {
                    setDragPosition([xMove, yMove]);
                  }}
                  onRelease={() => {
                    stopGrabbingColumn(index);
                  }}
                >
                  {col.header}
                </HeaderCell>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => {
            const rowOptions = rows[rowIndex] || {};
            const isRowSelected = selectedRowIds.includes(row.id);
            const isStickyYFrontier = stickyRowFrontierIndex === rowIndex + 1;
            const isAfterStickyYFrontier =
              rowIndex + 1 === stickyRowFrontierIndex + 1;

            return (
              <tr
                key={row.id}
                data-row-id={row.id}
                aria-selected={isRowSelected}
              >
                <RowNumberCell
                  stickyX={rowColumnSticky}
                  stickyY={rowOptions.sticky}
                  isStickyXFrontier={stickyColumnFrontierIndex === 0} // Only if no data columns are sticky
                  isAfterStickyXFrontier={false} // Row number column can't be after sticky X frontier (it's the first column)
                  isStickyYFrontier={isStickyYFrontier}
                  isAfterStickyYFrontier={isAfterStickyYFrontier}
                  row={row}
                  rowWithSomeSelectedCell={rowWithSomeSelectedCell}
                  columns={columns}
                  selectionController={selectionController}
                />
                {columns.map((col, colIndex) => {
                  const columnGrabbed = grabTarget === `column:${colIndex}`;

                  return (
                    <DataCell
                      key={`${row.id}-${col.id}`}
                      stickyX={col.sticky}
                      stickyY={rowOptions.sticky}
                      isStickyXFrontier={
                        stickyColumnFrontierIndex === colIndex + 1
                      }
                      isAfterStickyXFrontier={
                        colIndex + 1 === stickyColumnFrontierIndex + 1
                      }
                      isStickyYFrontier={isStickyYFrontier}
                      isAfterStickyYFrontier={isAfterStickyYFrontier}
                      columnName={col.accessorKey}
                      columnIndex={colIndex + 1} // +1 because number column is first
                      row={row}
                      value={row[col.accessorKey]}
                      selectionController={selectionController}
                      grabbed={columnGrabbed}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {grabTarget && (
        <DragClone
          tableRef={innerRef}
          grabTarget={grabTarget}
          grabTargetRect={grabTargetRect}
          dragPosition={dragPosition}
        />
      )}
    </div>
  );
});

const useTableSelectionBorders = (tableRef, selectionController) => {
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (table) {
      updateSelectionBorders(table, selectionController);
    }
  }, [selectionController.value]);
};
const updateSelectionBorders = (tableElement, selectionController) => {
  // Find all selected cells
  const cells = Array.from(tableElement.querySelectorAll("td, th"));
  const selectedCells = [];
  for (const cell of cells) {
    if (selectionController.isElementSelected(cell)) {
      selectedCells.push(cell);
    }
  }

  // Clear all existing selection border attributes
  tableElement
    .querySelectorAll(
      "[data-selection-border-top], [data-selection-border-right], [data-selection-border-bottom], [data-selection-border-left]",
    )
    .forEach((cell) => {
      cell.removeAttribute("data-selection-border-top");
      cell.removeAttribute("data-selection-border-right");
      cell.removeAttribute("data-selection-border-bottom");
      cell.removeAttribute("data-selection-border-left");
    });

  if (selectedCells.length === 0) {
    return;
  }

  // Convert NodeList to array and get cell positions

  const cellPositions = selectedCells.map((cell) => {
    const row = cell.parentElement;
    const allRows = Array.from(tableElement.querySelectorAll("tr"));
    return {
      element: cell,
      rowIndex: allRows.indexOf(row),
      columnIndex: Array.from(row.children).indexOf(cell),
    };
  });

  // Create a set for fast lookup of selected cell positions
  const selectedPositions = new Set(
    cellPositions.map((pos) => `${pos.rowIndex},${pos.columnIndex}`),
  );

  // Apply selection borders based on actual neighbors (for proper L-shaped selection support)
  cellPositions.forEach(({ element, rowIndex, columnIndex }) => {
    // Top border: if cell above is NOT selected or doesn't exist
    const cellAbove = `${rowIndex - 1},${columnIndex}`;
    if (!selectedPositions.has(cellAbove)) {
      element.setAttribute("data-selection-border-top", "");
    }

    // Bottom border: if cell below is NOT selected or doesn't exist
    const cellBelow = `${rowIndex + 1},${columnIndex}`;
    if (!selectedPositions.has(cellBelow)) {
      element.setAttribute("data-selection-border-bottom", "");
    }

    // Left border: if cell to the left is NOT selected or doesn't exist
    const cellLeft = `${rowIndex},${columnIndex - 1}`;
    if (!selectedPositions.has(cellLeft)) {
      element.setAttribute("data-selection-border-left", "");
    }

    // Right border: if cell to the right is NOT selected or doesn't exist
    const cellRight = `${rowIndex},${columnIndex + 1}`;
    if (!selectedPositions.has(cellRight)) {
      element.setAttribute("data-selection-border-right", "");
    }
  });
};

const RowNumberHeaderCell = ({
  stickyX,
  stickyY,
  isStickyXFrontier,
  isStickyYFrontier,
  ...rest
}) => {
  return (
    <th
      className="navi_row_number_cell"
      data-sticky-x={stickyX ? "" : undefined}
      data-sticky-y={stickyY ? "" : undefined}
      data-sticky-x-frontier={stickyX && isStickyXFrontier ? "" : undefined}
      data-sticky-y-frontier={stickyY && isStickyYFrontier ? "" : undefined}
      style={{ textAlign: "center" }}
      {...rest}
    ></th>
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
  data,
  selectionController,
  grabbed,
  onGrab,
  onDrag,
  onRelease,
  children,
}) => {
  const cellRef = useRef();
  const columnValue = `column:${columnAccessorKey}`;
  const { selected } = useSelectableElement(cellRef, {
    selectionController,
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
      data-selection-keyboard-toggle
      aria-selected={selected}
      data-sticky-x={stickyX ? "" : undefined}
      data-sticky-y={stickyY ? "" : undefined}
      data-sticky-x-frontier={stickyX && isStickyXFrontier ? "" : undefined}
      data-sticky-y-frontier={stickyY && isStickyYFrontier ? "" : undefined}
      data-after-sticky-x-frontier={isAfterStickyXFrontier ? "" : undefined}
      data-after-sticky-y-frontier={isAfterStickyYFrontier ? "" : undefined}
      style={{ cursor: grabbed ? "grabbing" : "grab" }}
      tabIndex={-1}
      onMouseDown={(e) => {
        startDragGesture(e, {
          direction: { x: true },
          onGrab,
          onDrag,
          onRelease,
        });
      }}
    >
      <span>{children}</span>
      <span className="navi_table_cell_content_bold_clone" aria-hidden="true">
        {children}
      </span>
      {grabbed && <div className="navi_table_drag_placeholder"></div>}
    </th>
  );
};
const RowNumberCell = ({
  stickyX,
  stickyY,
  isStickyXFrontier,
  isStickyYFrontier,
  isAfterStickyXFrontier,
  isAfterStickyYFrontier,
  row,
  columns,
  rowWithSomeSelectedCell,
  selectionController,
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
      style={{ cursor: "pointer", textAlign: "center" }}
      tabIndex={-1}
    >
      {row.index}
    </td>
  );
};

const DataCell = (props) => {
  return <TableCell {...props} />;
};

const DragClone = ({ tableRef, grabTarget, dragPosition }) => {
  const columnIndex = parseInt(grabTarget.slice(7), 10);
  const [dragX, dragY] = dragPosition;
  const x = dragX;
  const y = dragY;

  return (
    <div
      className="navi_table_drag_clone_container"
      style={{
        left: `${x < 0 ? 0 : x}px`,
        top: `${y < 0 ? 0 : y}px`,
      }}
    >
      <ColumnDragClone tableRef={tableRef} columnIndex={columnIndex} />
      {/* to catch any mouse over effect and stuff like that */}
      <div style={{ position: "absolute", inset: 0 }}></div>
    </div>
  );
};

const ColumnDragClone = ({ tableRef, columnIndex }) => {
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) {
      return null;
    }

    const tableClone = table.cloneNode(true);

    const tableCellArray = Array.from(tableClone.querySelectorAll("th, td"));
    for (const tableCell of tableCellArray) {
      // TODO: if table cell is not in the column being dragged, force opacity: 0
    }

    const tableDragCloneContainer = table.querySelector(
      ".navi_table_drag_clone_container",
    );
    tableDragCloneContainer.appendChild(tableClone);
    tableDragCloneContainer.style.width = `${width}px`;

    return () => {
      tableDragCloneContainer.removeChild(tableClone);
    };
  }, []);

  return null;
};
