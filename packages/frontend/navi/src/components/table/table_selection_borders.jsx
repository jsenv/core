import { useLayoutEffect, useState } from "preact/hooks";

import.meta.css = /* css */ `
  /* Selection border styling using box-shadow to override table borders */
  /* Higher specificity than table ::before pseudo-elements */

  /* DEFAULT MODE: Each cell has all inset borders, selection only overrides selected cell borders */
  /* Adjacent cells keep their red borders, selected cell gets blue borders */

  /* Single border selections */
  .navi_table [data-selection-border-top]::before {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table [data-selection-border-right]::before {
    box-shadow:
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table [data-selection-border-bottom]::before {
    box-shadow:
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color);
  }

  .navi_table [data-selection-border-left]::before {
    box-shadow:
      inset 1px 0 0 0 var(--selection-border-color),
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Two border combinations */
  .navi_table [data-selection-border-top][data-selection-border-right]::before {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table
    [data-selection-border-top][data-selection-border-bottom]::before {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color);
  }

  .navi_table [data-selection-border-top][data-selection-border-left]::before {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table
    [data-selection-border-right][data-selection-border-bottom]::before {
    box-shadow:
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color);
  }

  .navi_table
    [data-selection-border-right][data-selection-border-left]::before {
    box-shadow:
      inset 1px 0 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 1px 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table
    [data-selection-border-bottom][data-selection-border-left]::before {
    box-shadow:
      inset 1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color);
  }

  /* Three border combinations */
  .navi_table
    [data-selection-border-top][data-selection-border-right][data-selection-border-bottom]::before {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--border-color);
  }

  .navi_table
    [data-selection-border-top][data-selection-border-bottom][data-selection-border-left]::before {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--border-color);
  }

  .navi_table
    [data-selection-border-right][data-selection-border-bottom][data-selection-border-left]::before {
    box-shadow:
      inset 1px 0 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 0 1px 0 0 var(--border-color);
  }

  .navi_table
    [data-selection-border-top][data-selection-border-right][data-selection-border-left]::before {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Four border combination */
  .navi_table
    [data-selection-border-top][data-selection-border-right][data-selection-border-bottom][data-selection-border-left]::before {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  /* BORDER-COLLAPSE MODE: Specific rules that respect border ownership */
  /* Each cell type only shows borders it actually owns, with selection colors when selected */

  /* Regular cells - only own right and bottom borders */
  .navi_table[data-border-collapse] th::before,
  .navi_table[data-border-collapse] td::before {
    box-shadow:
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header row (thead tr) - adds top border */
  .navi_table[data-border-collapse] thead tr th::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* First column - adds left border */
  .navi_table[data-border-collapse] th:first-child::before,
  .navi_table[data-border-collapse] td:first-child::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header first column - all borders */
  .navi_table[data-border-collapse] thead tr th:first-child::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Selection overrides for border-collapse mode */

  /* Regular cells with selections */
  .navi_table[data-border-collapse] [data-selection-border-right]::before {
    box-shadow:
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse] [data-selection-border-bottom]::before {
    box-shadow:
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  .navi_table[data-border-collapse]
    [data-selection-border-right][data-selection-border-bottom]::before {
    box-shadow:
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  /* Header row with selections */
  .navi_table[data-border-collapse]
    thead
    tr
    [data-selection-border-top]::before {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse]
    thead
    tr
    [data-selection-border-right]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse]
    thead
    tr
    [data-selection-border-bottom]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  .navi_table[data-border-collapse]
    thead
    tr
    [data-selection-border-top][data-selection-border-right]::before {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse]
    thead
    tr
    [data-selection-border-top][data-selection-border-bottom]::before {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  .navi_table[data-border-collapse]
    thead
    tr
    [data-selection-border-right][data-selection-border-bottom]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  .navi_table[data-border-collapse]
    thead
    tr
    [data-selection-border-top][data-selection-border-right][data-selection-border-bottom]::before {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  /* First column with selections */
  .navi_table[data-border-collapse]
    th:first-child[data-selection-border-left]::before,
  .navi_table[data-border-collapse]
    td:first-child[data-selection-border-left]::before {
    box-shadow:
      inset 1px 0 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse]
    th:first-child[data-selection-border-right]::before,
  .navi_table[data-border-collapse]
    td:first-child[data-selection-border-right]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse]
    th:first-child[data-selection-border-bottom]::before,
  .navi_table[data-border-collapse]
    td:first-child[data-selection-border-bottom]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  .navi_table[data-border-collapse]
    th:first-child[data-selection-border-left][data-selection-border-right]::before,
  .navi_table[data-border-collapse]
    td:first-child[data-selection-border-left][data-selection-border-right]::before {
    box-shadow:
      inset 1px 0 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse]
    th:first-child[data-selection-border-left][data-selection-border-bottom]::before,
  .navi_table[data-border-collapse]
    td:first-child[data-selection-border-left][data-selection-border-bottom]::before {
    box-shadow:
      inset 1px 0 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  .navi_table[data-border-collapse]
    th:first-child[data-selection-border-right][data-selection-border-bottom]::before,
  .navi_table[data-border-collapse]
    td:first-child[data-selection-border-right][data-selection-border-bottom]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  .navi_table[data-border-collapse]
    th:first-child[data-selection-border-left][data-selection-border-right][data-selection-border-bottom]::before,
  .navi_table[data-border-collapse]
    td:first-child[data-selection-border-left][data-selection-border-right][data-selection-border-bottom]::before {
    box-shadow:
      inset 1px 0 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  /* First row first column with selections */
  .navi_table[data-border-collapse]
    thead
    tr
    th:first-child[data-selection-border-top]::before,
  .navi_table[data-border-collapse]
    thead
    tr
    td:first-child[data-selection-border-top]::before {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse]
    thead
    tr
    th:first-child[data-selection-border-left]::before,
  .navi_table[data-border-collapse]
    thead
    tr
    td:first-child[data-selection-border-left]::before {
    box-shadow:
      inset 1px 0 0 0 var(--selection-border-color),
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse]
    thead
    tr
    th:first-child[data-selection-border-right]::before,
  .navi_table[data-border-collapse]
    thead
    tr
    td:first-child[data-selection-border-right]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse]
    thead
    tr
    th:first-child[data-selection-border-bottom]::before,
  .navi_table[data-border-collapse]
    thead
    tr
    td:first-child[data-selection-border-bottom]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  .navi_table[data-border-collapse]
    thead
    tr
    th:first-child[data-selection-border-top][data-selection-border-left]::before,
  .navi_table[data-border-collapse]
    thead
    tr
    td:first-child[data-selection-border-top][data-selection-border-left]::before {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse]
    thead
    tr
    th:first-child[data-selection-border-top][data-selection-border-right]::before,
  .navi_table[data-border-collapse]
    thead
    tr
    td:first-child[data-selection-border-top][data-selection-border-right]::before {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse]
    thead
    tr
    th:first-child[data-selection-border-top][data-selection-border-bottom]::before,
  .navi_table[data-border-collapse]
    thead
    tr
    td:first-child[data-selection-border-top][data-selection-border-bottom]::before {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse]
    thead
    tr
    th:first-child[data-selection-border-left][data-selection-border-right]::before,
  .navi_table[data-border-collapse]
    thead
    tr
    td:first-child[data-selection-border-left][data-selection-border-right]::before {
    box-shadow:
      inset 1px 0 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 1px 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse]
    thead
    tr
    th:first-child[data-selection-border-left][data-selection-border-bottom]::before,
  .navi_table[data-border-collapse]
    thead
    tr
    td:first-child[data-selection-border-left][data-selection-border-bottom]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  .navi_table[data-border-collapse]
    thead
    tr
    th:first-child[data-selection-border-right][data-selection-border-bottom]::before,
  .navi_table[data-border-collapse]
    thead
    tr
    td:first-child[data-selection-border-right][data-selection-border-bottom]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  .navi_table[data-border-collapse]
    thead
    tr
    th:first-child[data-selection-border-top][data-selection-border-left][data-selection-border-right]::before,
  .navi_table[data-border-collapse]
    thead
    tr
    td:first-child[data-selection-border-top][data-selection-border-left][data-selection-border-right]::before {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse]
    thead
    tr
    th:first-child[data-selection-border-top][data-selection-border-left][data-selection-border-bottom]::before,
  .navi_table[data-border-collapse]
    thead
    tr
    td:first-child[data-selection-border-top][data-selection-border-left][data-selection-border-bottom]::before {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  .navi_table[data-border-collapse]
    thead
    tr
    th:first-child[data-selection-border-top][data-selection-border-right][data-selection-border-bottom]::before,
  .navi_table[data-border-collapse]
    thead
    tr
    td:first-child[data-selection-border-top][data-selection-border-right][data-selection-border-bottom]::before {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  .navi_table[data-border-collapse]
    thead
    tr
    th:first-child[data-selection-border-left][data-selection-border-right][data-selection-border-bottom]::before,
  .navi_table[data-border-collapse]
    thead
    tr
    td:first-child[data-selection-border-left][data-selection-border-right][data-selection-border-bottom]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }

  .navi_table[data-border-collapse]
    thead
    tr
    th:first-child[data-selection-border-top][data-selection-border-left][data-selection-border-right][data-selection-border-bottom]::before,
  .navi_table[data-border-collapse]
    thead
    tr
    td:first-child[data-selection-border-top][data-selection-border-left][data-selection-border-right][data-selection-border-bottom]::before {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }
`;
export const TableSelectionBorders = ({ tableRef, color }) => {
  const [selectionData, setSelectionData] = useState(null);

  useLayoutEffect(() => {
    const tableSelectionObserver = createTableSelectionObserver(
      tableRef.current,
    );
    setSelectionData(tableSelectionObserver.selectionData);
    tableSelectionObserver.onChange = () => {
      setSelectionData(tableSelectionObserver.selectionData);
    };
    return tableSelectionObserver.cleanup;
  }, [tableRef]);

  // Apply selection border styling whenever selection data changes
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    // Clear all existing selection border attributes
    table
      .querySelectorAll(
        "[data-selection-border-top], [data-selection-border-right], [data-selection-border-bottom], [data-selection-border-left]",
      )
      .forEach((cell) => {
        cell.removeAttribute("data-selection-border-top");
        cell.removeAttribute("data-selection-border-right");
        cell.removeAttribute("data-selection-border-bottom");
        cell.removeAttribute("data-selection-border-left");
      });

    // Set CSS custom property for selection border color
    table.style.setProperty("--selection-border-color", color || "#0078d4");

    if (!selectionData || selectionData.selectedCells.length === 0) {
      return;
    }

    applySelectionBorderAttributes(table, selectionData.selectedCells);
  }, [selectionData, color, tableRef]);

  // No canvas needed - we use CSS border styling
  return null;
};

/**
 * Apply data attributes to control border colors for selection perimeter only
 * Accounts for CSS border collapse where some cells don't own certain borders
 */
const applySelectionBorderAttributes = (table, selectedCells) => {
  if (!selectedCells || selectedCells.length === 0) return;

  // Create a map of selected cells for quick lookup
  const selectedCellsMap = new Map();
  selectedCells.forEach((cell) => {
    const key = `${cell.column},${cell.row}`;
    selectedCellsMap.set(key, cell);
  });

  // Create a map of ALL cells (selected and unselected) for neighbor lookup
  const allCellsMap = new Map();
  const allRows = Array.from(table.querySelectorAll("tr"));
  allRows.forEach((row, rowIndex) => {
    Array.from(row.children).forEach((cellElement, columnIndex) => {
      const key = `${columnIndex},${rowIndex}`;
      allCellsMap.set(key, {
        element: cellElement,
        row: rowIndex,
        column: columnIndex,
      });
    });
  });

  // Helper function to check if a cell is selected
  const isCellSelected = (column, row) => {
    return selectedCellsMap.has(`${column},${row}`);
  };

  // Helper function to get any cell (selected or not)
  const getCell = (column, row) => {
    return allCellsMap.get(`${column},${row}`);
  };

  // Helper function to check if a cell has a computed border (box-shadow based)
  const hasBorder = (element, side) => {
    const table = element.closest("table");
    const isBorderCollapse =
      table && table.hasAttribute("data-border-collapse");

    if (!isBorderCollapse) {
      // Default mode: all cells have all borders
      return true;
    }

    // Border-collapse mode: check actual border ownership based on CSS rules
    const isInHeaderRow = element.closest("thead") !== null;
    const isFirstColumn = element.matches(":first-child");

    switch (side) {
      case "top":
        // Only header cells (thead th) own top borders
        return isInHeaderRow;
      case "right":
        // All cells own right borders
        return true;
      case "bottom":
        // All cells own bottom borders
        return true;
      case "left":
        // Only first column cells own left borders
        return isFirstColumn;
      default:
        return false;
    }
  };

  // Apply border attributes only for perimeter borders
  selectedCells.forEach((cell) => {
    const { element, row, column } = cell;

    // Check neighboring cells to determine if this cell is on the perimeter
    const hasTopNeighbor = isCellSelected(column, row - 1);
    const hasBottomNeighbor = isCellSelected(column, row + 1);
    const hasLeftNeighbor = isCellSelected(column - 1, row);
    const hasRightNeighbor = isCellSelected(column + 1, row);

    // PERIMETER BORDER LOGIC with Dynamic Border Detection:

    // TOP BORDER: Color if no selected cell above (perimeter edge)
    if (!hasTopNeighbor) {
      if (hasBorder(element, "top")) {
        // This cell has a top border - it owns the border
        element.setAttribute("data-selection-border-top", "");
      } else {
        // This cell doesn't have a top border - check if cell above owns the shared border
        const cellAbove = getCell(column, row - 1);
        if (
          cellAbove &&
          !isCellSelected(column, row - 1) &&
          hasBorder(cellAbove.element, "bottom")
        ) {
          // Cell above is unselected and owns the border - color it
          cellAbove.element.setAttribute("data-selection-border-bottom", "");
        } else {
          // Fallback: color this cell's top border
          element.setAttribute("data-selection-border-top", "");
        }
      }
    }

    // BOTTOM BORDER: Color if no selected cell below (perimeter edge)
    if (!hasBottomNeighbor) {
      if (hasBorder(element, "bottom")) {
        // This cell has a bottom border - it owns the border
        element.setAttribute("data-selection-border-bottom", "");
      } else {
        // This cell doesn't have a bottom border - check if cell below owns the shared border
        const cellBelow = getCell(column, row + 1);
        if (
          cellBelow &&
          !isCellSelected(column, row + 1) &&
          hasBorder(cellBelow.element, "top")
        ) {
          // Cell below is unselected and owns the border - color it
          cellBelow.element.setAttribute("data-selection-border-top", "");
        } else {
          // Fallback: color this cell's bottom border
          element.setAttribute("data-selection-border-bottom", "");
        }
      }
    }

    // LEFT BORDER: Color if no selected cell to the left (perimeter edge)
    if (!hasLeftNeighbor) {
      if (hasBorder(element, "left")) {
        // This cell has a left border - it owns the border
        element.setAttribute("data-selection-border-left", "");
      } else {
        // This cell doesn't have a left border - check if cell to left owns the shared border
        const cellToLeft = getCell(column - 1, row);
        if (
          cellToLeft &&
          !isCellSelected(column - 1, row) &&
          hasBorder(cellToLeft.element, "right")
        ) {
          // Cell to left is unselected and owns the border - color it
          cellToLeft.element.setAttribute("data-selection-border-right", "");
        } else {
          // Fallback: color this cell's left border
          element.setAttribute("data-selection-border-left", "");
        }
      }
    }

    // RIGHT BORDER: Color if no selected cell to the right (perimeter edge)
    if (!hasRightNeighbor) {
      if (hasBorder(element, "right")) {
        // This cell has a right border - it owns the border
        element.setAttribute("data-selection-border-right", "");
      } else {
        // This cell doesn't have a right border - check if cell to right owns the shared border
        const cellToRight = getCell(column + 1, row);
        if (
          cellToRight &&
          !isCellSelected(column + 1, row) &&
          hasBorder(cellToRight.element, "left")
        ) {
          // Cell to right is unselected and owns the border - color it
          cellToRight.element.setAttribute("data-selection-border-left", "");
        } else {
          // Fallback: color this cell's right border
          element.setAttribute("data-selection-border-right", "");
        }
      }
    }

    // SHARED BORDER RESPONSIBILITY: Handle cases where the current cell doesn't own
    // a border, but a neighbor does and needs to show the selection perimeter
    // IMPORTANT: Only set borders on unselected neighbors that own shared borders

    // Handle TOP shared borders: If this cell has a top neighbor and doesn't own its top border,
    // check if there's an unselected cell above that should show the border
    if (hasTopNeighbor && !hasBorder(element, "top")) {
      const cellAbove = getCell(column, row - 1);
      if (
        cellAbove &&
        !isCellSelected(column, row - 1) &&
        hasBorder(cellAbove.element, "bottom")
      ) {
        // Cell above is unselected and owns the border - color it
        cellAbove.element.setAttribute("data-selection-border-bottom", "");
      }
    }

    // Handle LEFT shared borders: If this cell has a left neighbor and doesn't own its left border,
    // check if there's an unselected cell to the left that should show the border
    if (hasLeftNeighbor && !hasBorder(element, "left")) {
      const cellToLeft = getCell(column - 1, row);
      if (
        cellToLeft &&
        !isCellSelected(column - 1, row) &&
        hasBorder(cellToLeft.element, "right")
      ) {
        // Cell to left is unselected and owns the border - color it
        cellToLeft.element.setAttribute("data-selection-border-right", "");
      }
    }

    // Handle BOTTOM shared borders: If this cell has a bottom neighbor and doesn't own its bottom border,
    // check if there's an unselected cell below that should show the border
    if (hasBottomNeighbor && !hasBorder(element, "bottom")) {
      const cellBelow = getCell(column, row + 1);
      if (
        cellBelow &&
        !isCellSelected(column, row + 1) &&
        hasBorder(cellBelow.element, "top")
      ) {
        // Cell below is unselected and owns the border - color it
        cellBelow.element.setAttribute("data-selection-border-top", "");
      }
    }

    // Handle RIGHT shared borders: If this cell has a right neighbor and doesn't own its right border,
    // check if there's an unselected cell to the right that should show the border
    if (hasRightNeighbor && !hasBorder(element, "right")) {
      const cellToRight = getCell(column + 1, row);
      if (
        cellToRight &&
        !isCellSelected(column + 1, row) &&
        hasBorder(cellToRight.element, "left")
      ) {
        // Cell to right is unselected and owns the border - color it
        cellToRight.element.setAttribute("data-selection-border-left", "");
      }
    }
  });
};

const NO_SELECTION = { selectedCells: [] };
const createTableSelectionObserver = (table) => {
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cb of cleanupCallbackSet) {
      cb();
    }
  };
  const tableSelection = {
    selectionData: undefined,
    onChange: () => {},
    cleanup,
  };

  const updateSelectionData = (newData) => {
    if (newData === tableSelection.selectionData) {
      return;
    }
    tableSelection.selectionData = newData;
    tableSelection.onChange();
  };

  if (!table) {
    updateSelectionData(NO_SELECTION);
    return tableSelection;
  }

  const calculateSelectionData = () => {
    // Don't update during drag selection - wait for drag to complete
    if (table.hasAttribute("data-drag-selecting")) {
      return;
    }

    // Find all selected cells by aria-selected attribute
    const selectedCells = table.querySelectorAll(
      'td[aria-selected="true"], th[aria-selected="true"]',
    );

    if (selectedCells.length === 0) {
      updateSelectionData(NO_SELECTION);
      return;
    }

    // Get cell information for each selected cell (simplified for border attributes)
    const cellInfos = Array.from(selectedCells).map((cell) => {
      const row = cell.closest("tr");
      const allRows = Array.from(table.querySelectorAll("tr"));
      const rowIndex = allRows.indexOf(row);
      const columnIndex = Array.from(row.children).indexOf(cell);

      return {
        element: cell,
        row: rowIndex,
        column: columnIndex,
      };
    });

    updateSelectionData({
      selectedCells: cellInfos,
    });
  };

  calculateSelectionData();

  update_on_selection_change: {
    // Set up MutationObserver to watch for aria-selected and drag state changes
    const mutationObserver = new MutationObserver(() => {
      calculateSelectionData();
    });

    mutationObserver.observe(table, {
      attributes: true,
      attributeFilter: ["aria-selected", "data-drag-selecting"],
      subtree: true,
    });

    cleanupCallbackSet.add(() => mutationObserver.disconnect());
  }

  update_on_dom_changes: {
    // Also listen to DOM changes that might affect cell structure
    const mutationObserver = new MutationObserver(() => {
      calculateSelectionData();
    });

    mutationObserver.observe(table, {
      childList: true,
      subtree: true,
    });

    cleanupCallbackSet.add(() => mutationObserver.disconnect());
  }

  update_on_window_resize: {
    const handleWindowResize = () => {
      calculateSelectionData();
    };

    window.addEventListener("resize", handleWindowResize);
    cleanupCallbackSet.add(() =>
      window.removeEventListener("resize", handleWindowResize),
    );
  }

  return tableSelection;
};
