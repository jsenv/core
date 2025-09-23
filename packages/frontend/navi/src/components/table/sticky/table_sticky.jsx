import { createDragToMoveGesture, setAttribute } from "@jsenv/dom";
import {
  Z_INDEX_STICKY_COLUMN,
  Z_INDEX_STICKY_CORNER,
  Z_INDEX_STICKY_FRONTIER_BACKDROP,
  Z_INDEX_STICKY_FRONTIER_GHOST,
  Z_INDEX_STICKY_FRONTIER_HANDLE,
  Z_INDEX_STICKY_FRONTIER_PREVIEW,
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

  /* Useful because drag gesture will read this value to detect <col>, <tr> virtual position */
  .navi_table col {
    left: var(--sticky-group-left, 0);
  }
  .navi_table tr {
    top: var(--sticky-group-top, 0);
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

  .navi_table_container {
    --column-sticky-frontier-width: 5px;
  }

  .navi_table_column_sticky_frontier {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: var(--column-sticky-frontier-width);
    background: #444746;
    cursor: grab;
    z-index: ${Z_INDEX_STICKY_FRONTIER_HANDLE};
  }
  .navi_table_column_sticky_frontier[data-left] {
    left: 0;
    right: auto;
  }
  .navi_table_column_sticky_frontier_ghost,
  .navi_table_column_sticky_frontier_preview {
    position: absolute;
    top: 0;
    bottom: 0;
    width: var(--column-sticky-frontier-width);
    pointer-events: none;
    opacity: 0;
  }
  .navi_table_column_sticky_frontier_ghost[data-visible],
  .navi_table_column_sticky_frontier_preview[data-visible] {
    opacity: 1;
  }
  .navi_table_column_sticky_frontier_ghost {
    z-index: ${Z_INDEX_STICKY_FRONTIER_GHOST};
    background: rgba(68, 71, 70, 0.5);
    left: calc(
      var(--table-column-right, 0px) - var(--column-sticky-frontier-width)
    );
  }
  .navi_table_column_sticky_frontier_preview {
    z-index: ${Z_INDEX_STICKY_FRONTIER_PREVIEW};
    background: red;
    left: calc(
      var(--table-column-preview-right, 0px) - var(
          --column-sticky-frontier-width
        )
    );
  }
`;

/**
 * We "need" to inject this into every <td>,<th> so it follows correctly the position of the cell
 * And cells are in position sticky
 * And we can't have an absolute element per <td> because they are in position: relative
 * so we can't know the table dimension within a table cell (and that would be very nasty and easy to break as soon
 * as a table cell uses a position relative)
 */
export const TableColumnStickyFrontier = ({
  columnStickyFrontierIndex,
  onColumnStickyFrontierChange,
}) => {
  return (
    <div
      className="navi_table_column_sticky_frontier"
      data-left={columnStickyFrontierIndex === -1 ? "" : undefined}
      inert={!onColumnStickyFrontierChange}
      onMouseDown={(e) => {
        if (e.button !== 0) {
          return;
        }
        e.preventDefault(); // prevent text selection
        e.stopPropagation(); // prevent drag column
        initMoveColumnStickyFrontierByMousedown(e, {
          columnIndex: columnStickyFrontierIndex,
          onRelease: (_, index) => {
            if (index !== columnStickyFrontierIndex) {
              onColumnStickyFrontierChange(index);
            }
          },
        });
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

// When we cross half the width of a column we inject a second vertical line where the new frontier would be
// to tell user "hey if you grab here, the frontier will be there"
// At this stage user can see 3 frontiers. Where it is, the one he grab, the futurue one if he releases.
const initMoveColumnStickyFrontierByMousedown = (
  mousedownEvent,
  { columnIndex, onGrab, onDrag, onRelease },
) => {
  const tableCell = mousedownEvent.target.closest("th,td");
  const table = tableCell.closest("table");
  const tableContainer = table.closest(".navi_table_container");
  const colgroup = table.querySelector("colgroup");
  const colElements = Array.from(colgroup.children);
  const tableColumnStickyFrontierGhost = tableContainer.querySelector(
    ".navi_table_column_sticky_frontier_ghost",
  );
  const tableColumnStickyFrontierPreview = tableContainer.querySelector(
    ".navi_table_column_sticky_frontier_preview",
  );
  const tableContainerRect = tableContainer.getBoundingClientRect();

  if (columnIndex === -1) {
    tableColumnStickyFrontierGhost.style.setProperty(
      "--table-column-right",
      `0px`,
    );
  } else {
    const tableCellRect = tableCell.getBoundingClientRect();
    const columnLeftRelative = tableCellRect.left - tableContainerRect.left;
    const columnRightRelative = columnLeftRelative + tableCellRect.width;
    tableColumnStickyFrontierGhost.style.setProperty(
      "--table-column-right",
      `${columnRightRelative}px`,
    );
  }
  tableColumnStickyFrontierGhost.setAttribute("data-visible", "");

  let futureColumnStickyFrontierIndex = columnIndex;
  const onFutureColumnStickyFrontierIndexChange = (index) => {
    futureColumnStickyFrontierIndex = index;

    if (index === columnIndex) {
      tableColumnStickyFrontierPreview.removeAttribute("data-visible");
      return;
    }
    let previewPosition;
    if (index === -1) {
      previewPosition =
        tableColumnStickyFrontierGhost.getBoundingClientRect().width;
    } else {
      const colElement = colElements[index];
      const columnRect = colElement.getBoundingClientRect();
      const tableContainerRect = tableContainer.getBoundingClientRect();
      previewPosition = columnRect.right - tableContainerRect.left;
    }

    tableColumnStickyFrontierPreview.style.setProperty(
      "--table-column-preview-right",
      `${previewPosition}px`,
    );
    tableColumnStickyFrontierPreview.setAttribute("data-visible", "");
  };

  // Find the column at the middle of the visible area to use as drag boundary
  // The goal it to prevent user from dragging the frontier too far
  // and ending with a situation where sticky columns take most/all the visible space
  let restoreColumnDragObstacleAttr = () => {};
  setup_middle_column_obstacle: {
    const tableContainerWidth = tableContainerRect.width;
    const middleX = tableContainerWidth / 2;
    // Find if there's a column at the middle position
    for (let i = 0; i < colElements.length; i++) {
      const colElement = colElements[i];
      const columnRect = colElement.getBoundingClientRect();
      const columnLeftRelative = columnRect.left - tableContainerRect.left;
      const columnRightRelative = columnRect.right - tableContainerRect.left;
      if (i + 1 === colElements.length) {
        // no next column
        break;
      }
      if (columnRightRelative < middleX) {
        // column is before the middle
        continue;
      }
      if (columnLeftRelative > middleX) {
        // column is after the middle
        continue;
      }
      // Add drag obstacle to prevent dragging beyond the middle area
      const obstacleColElement = colElements[i + 1];
      restoreColumnDragObstacleAttr = setAttribute(
        obstacleColElement,
        "data-drag-obstacle",
        "move-column-left-sticky-frontier",
      );
      break;
    }
  }

  const dragToMoveGesture = createDragToMoveGesture({
    name: "move-column-left-sticky-frontier",
    direction: { x: true },
    // keepMarkersOnRelease: true,
    backdropZIndex: Z_INDEX_STICKY_FRONTIER_BACKDROP,
    onGrab,
    onDrag: (gesture) => {
      update_frontier_index: {
        const ghostRect =
          tableColumnStickyFrontierGhost.getBoundingClientRect();
        const ghostCenterX = ghostRect.left + ghostRect.width / 2;
        // Find which column the ghost is currently over
        let i = 0;
        for (; i < colElements.length; i++) {
          const colElement = colElements[i];
          const columnRect = colElement.getBoundingClientRect();
          if (ghostCenterX < columnRect.left) {
            continue;
          }
          if (ghostCenterX > columnRect.right) {
            continue;
          }
          // on the column, left or right side?
          const columnCenterX = columnRect.left + columnRect.width / 2;
          if (ghostCenterX < columnCenterX) {
            onFutureColumnStickyFrontierIndexChange(i - 1);
            break;
          }
          onFutureColumnStickyFrontierIndexChange(i);
          break;
        }
      }
      onDrag?.(gesture, futureColumnStickyFrontierIndex);
    },
    onRelease: (gesture) => {
      onRelease?.(gesture, futureColumnStickyFrontierIndex);
    },
  });

  dragToMoveGesture.addTeardown(() => {
    tableColumnStickyFrontierPreview.removeAttribute("data-visible");
    tableColumnStickyFrontierPreview.style.removeProperty(
      "--table-column-preview-right",
    );

    tableColumnStickyFrontierGhost.removeAttribute("data-visible");
    tableColumnStickyFrontierGhost.style.removeProperty("--table-column-right");
    tableColumnStickyFrontierGhost.style.left = ""; // reset left set by the drag

    restoreColumnDragObstacleAttr();
  });
  dragToMoveGesture.grabViaMousedown(mousedownEvent, {
    element: tableColumnStickyFrontierGhost,
  });
};
