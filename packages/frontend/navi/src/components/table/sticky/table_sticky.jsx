import { createDragToMoveGesture } from "@jsenv/dom";
import {
  Z_INDEX_STICKY_COLUMN,
  Z_INDEX_STICKY_CORNER,
  Z_INDEX_STICKY_FRONTIER,
  Z_INDEX_STICKY_FRONTIER_BACKDROP,
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

  .navi_table_column_sticky_frontier {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 5px;
    background: #444746;
    cursor: grab;
  }
  .navi_table_column_sticky_frontier_ghost,
  .navi_table_column_sticky_frontier_preview {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 5px;
    pointer-events: none;
    opacity: 0;
    z-index: ${Z_INDEX_STICKY_FRONTIER};
  }
  .navi_table_column_sticky_frontier_ghost {
    background: rgba(68, 71, 70, 0.5);
    left: var(--table-column-right, 0);
  }
  .navi_table_column_sticky_frontier_preview {
    background: red;
  }
`;

/**
 * We "need" to inject this into every <td>,<th> so it follows correctly the position of the cell
 * And cells are in position sticky
 * And we can't have an absolute element per <td> because they are in position: relative
 * so we can't know the table dimension within a table cell (and that would be very nasty and easy to break as soon
 * as a table cell uses a position relative)
 */
export const TableColumnStickyFrontier = () => {
  return (
    <div
      className="navi_table_column_sticky_frontier"
      onMouseDown={(e) => {
        initMoveColumnStickyFrontierByMousedown(e);
      }}
    ></div>
  );
};
export const TableColumnStickyFrontierGhost = () => {
  return <div className="navi_table_column_sticky_frontier_ghost"></div>;
};

export const TableColumnStickyFrontierPreview = () => {
  return <div className="navi_table_column_sticky_frontier_preview"></div>;
};

// TODO: we'll move the frontier
// we need to
// inject an element into the table to be able to move it because our
// line is actually inside every <td>,<th>
// It must be at the right left position. I guess in absolute.
// This element will have a 0.5 opacity
// When we cross half the width of a column we inject a second vertical line where the new frontier would be
// to tell user "hey if you grab here, the frontier will be there"
// At this stage user can see 3 frontiers. Where it is, the one he grab, the futurue one if he releases.
const initMoveColumnStickyFrontierByMousedown = (
  mousedownEvent,
  {
    onGrab,
    onDrag,
    // onRelease
  },
) => {
  const tableCell = mousedownEvent.target.closest("th,td");
  const tableContainer = tableCell.closest(".navi_table_container");
  const tableCellRect = tableCell.getBoundingClientRect();
  const tableContainerRect = tableContainer.getBoundingClientRect();
  const columnLeftRelative = tableCellRect.left - tableContainerRect.left;
  const columnRightRelative = columnLeftRelative + tableCellRect.width;

  const dragToMoveGesture = createDragToMoveGesture({
    name: "move-column-sticky-frontier",
    direction: { x: true },
    backdropZIndex: Z_INDEX_STICKY_FRONTIER_BACKDROP,
    onGrab: () => {
      onGrab({ columnWidth: 0 });
    },
    onDrag,
    // onRelease: (gesture) => {},
  });

  const tableColumnStickyFrontierGhost = tableContainer.querySelector(
    ".navi_table_column_sticky_frontier_ghost",
  );
  tableColumnStickyFrontierGhost.style.setProperty(
    "--table-column-right",
    `${columnRightRelative}px`,
  );
  tableColumnStickyFrontierGhost.setAttribute("data-visible", "");
  dragToMoveGesture.addTeardown(() => {
    tableColumnStickyFrontierGhost.removeAttribute("data-visible");
    tableColumnStickyFrontierGhost.style.removeProperty("--table-column-right");
    tableColumnStickyFrontierGhost.style.left = ""; // reset left set by the drag
  });

  dragToMoveGesture.grabViaMousedown(mousedownEvent, {
    element: tableColumnStickyFrontierGhost,
  });
};
