import {
  Z_INDEX_STICKY_COLUMN,
  Z_INDEX_STICKY_CORNER,
  Z_INDEX_STICKY_FRONTIER,
  Z_INDEX_STICKY_ROW,
} from "../z_indexes.js";

import.meta.css = /* css */ `
  .navi_table th[data-sticky-y],
  .navi_table td[data-sticky-y] {
    position: sticky;
    top: var(--sticky-group-top, 0);
    z-index: ${Z_INDEX_STICKY_ROW};
  }
  .navi_table th[data-sticky-x],
  .navi_table td[data-sticky-x] {
    position: sticky;
    left: var(--sticky-group-left, 0);
    z-index: ${Z_INDEX_STICKY_COLUMN};
  }
  .navi_table th[data-sticky-x][data-sticky-y],
  .navi_table td[data-sticky-x][data-sticky-y] {
    position: sticky;
    top: var(--sticky-group-top, 0);
    left: var(--sticky-group-left, 0);
    z-index: ${Z_INDEX_STICKY_CORNER};
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

  .navi_table_sticky_container {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: ${Z_INDEX_STICKY_FRONTIER};
  }

  .navi_table_sticky_column_frontier {
    position: sticky;
    top: 0;
    bottom: 0;
    left: var(--sticky-group-left, 0);
    width: 5px;
    background: #444746;
  }
`;

export const TableStickyColumnFrontier = () => {
  return (
    <div className="navi_table_sticky_container">
      <div className="navi_table_sticky_column_frontier"></div>
    </div>
  );
};
