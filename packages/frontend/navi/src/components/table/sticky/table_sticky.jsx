import {
  createDragToMoveGesture,
  getScrollableParent,
  setAttribute,
} from "@jsenv/dom";

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
  .navi_table th[data-sticky-top],
  .navi_table td[data-sticky-top] {
    position: sticky;
    top: var(--sticky-group-top, 0);
    z-index: ${Z_INDEX_STICKY_ROW};
  }
  .navi_table th[data-sticky-left],
  .navi_table td[data-sticky-left] {
    position: sticky;
    left: var(--sticky-group-left, 0);
    z-index: ${Z_INDEX_STICKY_COLUMN};
  }
  .navi_table th[data-sticky-left][data-sticky-top],
  .navi_table td[data-sticky-left][data-sticky-top] {
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
  .navi_table[data-border-collapse] th[data-after-sticky-left-frontier]::after,
  .navi_table[data-border-collapse] td[data-after-sticky-left-frontier]::after {
    left: 0;
  }

  .navi_table[data-border-collapse] th[data-after-sticky-top-frontier]::after,
  .navi_table[data-border-collapse] td[data-after-sticky-top-frontier]::after {
    top: 0;
  }

  /* Base borders for sticky cells (will be overridden by frontier rules) */
  .navi_table[data-border-collapse] th[data-sticky-left]::before,
  .navi_table[data-border-collapse] td[data-sticky-left]::before {
    box-shadow:
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse] th[data-sticky-top]::before,
  .navi_table[data-border-collapse] td[data-sticky-top]::before {
    box-shadow:
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header row sticky cells need top border */
  .navi_table[data-border-collapse] th[data-sticky-left]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse] th[data-sticky-top]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* First column sticky cells need left border */
  .navi_table[data-border-collapse] th:first-child[data-sticky-left]::before,
  .navi_table[data-border-collapse] td:first-child[data-sticky-left]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse] th:first-child[data-sticky-top]::before,
  .navi_table[data-border-collapse] td:first-child[data-sticky-top]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header first column sticky cells get all four regular borders */
  .navi_table[data-border-collapse] th:first-child[data-sticky-left]::before,
  .navi_table[data-border-collapse] th:first-child[data-sticky-top]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Borders for cells immediately after sticky frontiers */

  /* Left border for the column after sticky-x-frontier */
  .navi_table[data-border-collapse] th[data-after-sticky-left-frontier]::before,
  .navi_table[data-border-collapse]
    td[data-after-sticky-left-frontier]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header cells after sticky-x-frontier also need top border (for border-collapse) */
  .navi_table[data-border-collapse]
    th[data-after-sticky-left-frontier]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Top border for the row after sticky-y-frontier */
  .navi_table[data-border-collapse] th[data-after-sticky-top-frontier]::before,
  .navi_table[data-border-collapse] td[data-after-sticky-top-frontier]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header cells after sticky-y-frontier also need left border (for border-collapse) */
  .navi_table[data-border-collapse] th[data-after-sticky-top-frontier]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* First column cells after sticky-y-frontier need all four borders (for border-collapse) */
  .navi_table[data-border-collapse]
    th:first-child[data-after-sticky-top-frontier]::before,
  .navi_table[data-border-collapse]
    td:first-child[data-after-sticky-top-frontier]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Corner case: cell after both sticky frontiers */
  .navi_table[data-border-collapse]
    th[data-after-sticky-left-frontier][data-after-sticky-top-frontier]::before,
  .navi_table[data-border-collapse]
    td[data-after-sticky-left-frontier][data-after-sticky-top-frontier]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table_container {
    --sticky-left-frontier-width: 5px;
    --sticky-top-frontier-height: 5px;
  }

  .navi_table_sticky_left_frontier {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: var(--sticky-left-frontier-width);
    background: #444746;
    opacity: 0.5;
    cursor: grab;
    z-index: ${Z_INDEX_STICKY_FRONTIER_HANDLE};
  }
  .navi_table_sticky_left_frontier[data-left] {
    left: 0;
    right: auto;
  }
  .navi_table_sticky_left_frontier_ghost,
  .navi_table_sticky_left_frontier_preview {
    position: absolute;
    top: 0
    width: var(--sticky-left-frontier-width);
    height: var(--table-height, 100%);
    pointer-events: none;
    opacity: 0;
  }
  .navi_table_sticky_left_frontier_ghost[data-visible],
  .navi_table_sticky_left_frontier_preview[data-visible] {
    opacity: 1;
  }
  .navi_table_sticky_left_frontier_ghost {
    z-index: ${Z_INDEX_STICKY_FRONTIER_GHOST};
    background: rgba(68, 71, 70, 0.5);
    left: calc(
      var(--sticky-left-frontier-ghost-left, 0px) - var(
          --sticky-left-frontier-width
        )
    );
  }
  .navi_table_sticky_left_frontier_preview {
    z-index: ${Z_INDEX_STICKY_FRONTIER_PREVIEW};
    background: red;
    left: calc(
      var(--sticky-left-frontier-preview-left, 0px) - var(
          --sticky-left-frontier-width
        )
    );
  }

  .navi_table_sticky_top_frontier {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: var(--sticky-top-frontier-height);
    background: #444746;
    opacity: 0.5;
    cursor: grab;
    z-index: ${Z_INDEX_STICKY_FRONTIER_HANDLE};
  }
  .navi_table_sticky_top_frontier[data-top] {
    top: 0;
    bottom: auto;
  }
  .navi_table_sticky_top_frontier_ghost,
  .navi_table_sticky_top_frontier_preview {
    position: absolute;
    left: 0;
    width: var(--table-width, 100%);
    height: var(--sticky-top-frontier-height);
    pointer-events: none;
    opacity: 0;
  }
  .navi_table_sticky_top_frontier_ghost[data-visible],
  .navi_table_sticky_top_frontier_preview[data-visible] {
    opacity: 1;
  }
  .navi_table_sticky_top_frontier_ghost {
    z-index: ${Z_INDEX_STICKY_FRONTIER_GHOST};
    background: rgba(68, 71, 70, 0.5);
    top: calc(
      var(--sticky-top-frontier-ghost-top, 0px) - var(
          --sticky-top-frontier-height
        )
    );
  }
  .navi_table_sticky_top_frontier_preview {
    z-index: ${Z_INDEX_STICKY_FRONTIER_PREVIEW};
    background: red;
    top: calc(
      var(--sticky-top-frontier-preview-top, 0px) - var(
          --sticky-top-frontier-height
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
export const TableStickyLeftFrontier = ({
  stickyLeftFrontierColumnIndex,
  onStickyLeftFrontierChange,
}) => {
  return (
    <div
      className="navi_table_sticky_left_frontier"
      data-left={stickyLeftFrontierColumnIndex === -1 ? "" : undefined}
      inert={!onStickyLeftFrontierChange}
      onMouseDown={(e) => {
        if (e.button !== 0) {
          return;
        }
        e.preventDefault(); // prevent text selection
        e.stopPropagation(); // prevent drag column
        initMoveStickyLeftFrontierByMousedown(e, {
          stickyLeftFrontierColumnIndex,
          onRelease: (_, index) => {
            if (index !== stickyLeftFrontierColumnIndex) {
              onStickyLeftFrontierChange(index);
            }
          },
        });
      }}
    ></div>
  );
};
export const TableStickyLeftFrontierGhost = () => {
  return <div className="navi_table_sticky_left_frontier_ghost"></div>;
};
export const TableStickyLeftFrontierPreview = () => {
  return <div className="navi_table_sticky_left_frontier_preview"></div>;
};

export const TableStickyTopFrontier = ({
  stickyTopFrontierRowIndex,
  onStickyTopFrontierChange,
}) => {
  return (
    <div
      className="navi_table_sticky_top_frontier"
      data-top={stickyTopFrontierRowIndex === -1 ? "" : undefined}
      inert={!onStickyTopFrontierChange}
      onMouseDown={(e) => {
        if (e.button !== 0) {
          return;
        }
        e.preventDefault(); // prevent text selection
        e.stopPropagation(); // prevent drag row
        initMoveStickyTopFrontierByMousedown(e, {
          stickyTopFrontierRowIndex,
          onRelease: (_, index) => {
            if (index !== stickyTopFrontierRowIndex) {
              onStickyTopFrontierChange(index);
            }
          },
        });
      }}
    ></div>
  );
};
export const TableStickyTopFrontierGhost = () => {
  return <div className="navi_table_sticky_top_frontier_ghost"></div>;
};
export const TableStickyTopFrontierPreview = () => {
  return <div className="navi_table_sticky_top_frontier_preview"></div>;
};

// When we cross half the width of a column we inject a second vertical line where the new frontier would be
// to tell user "hey if you grab here, the frontier will be there"
// At this stage user can see 3 frontiers. Where it is, the one he grab, the futurue one if he releases.
const initMoveStickyLeftFrontierByMousedown = (
  mousedownEvent,
  { stickyLeftFrontierColumnIndex, onGrab, onDrag, onRelease },
) => {
  const tableCell = mousedownEvent.target.closest("th,td");
  const table = tableCell.closest("table");
  const tableContainer = table.closest(".navi_table_container");
  const colgroup = table.querySelector("colgroup");
  const colElements = Array.from(colgroup.children);
  const tableStickyLeftFrontierGhost = tableContainer.querySelector(
    ".navi_table_sticky_left_frontier_ghost",
  );
  const tableStickyLeftFrontierPreview = tableContainer.querySelector(
    ".navi_table_sticky_left_frontier_preview",
  );
  // We must reset scroll because we're limiting ability to move the sticky frontier to a column
  // But if there is already a scroll we might already have crossed that column
  // Creating a scenario where we start the drag already at the right of an obstacle which won't provide a nice UX
  getScrollableParent(table).scrollLeft = 0;

  const tableRect = table.getBoundingClientRect();
  const tableContainerRect = tableContainer.getBoundingClientRect();
  tableStickyLeftFrontierGhost.style.setProperty(
    "--table-height",
    `${tableRect.height}px`,
  );
  tableStickyLeftFrontierPreview.style.setProperty(
    "--table-height",
    `${tableRect.height}px`,
  );

  if (stickyLeftFrontierColumnIndex === -1) {
    tableStickyLeftFrontierGhost.style.setProperty(
      "--sticky-left-frontier-ghost-left",
      `0px`,
    );
  } else {
    const tableCellRect = tableCell.getBoundingClientRect();
    const columnLeftRelative = tableCellRect.left - tableContainerRect.left;
    const columnRightRelative = columnLeftRelative + tableCellRect.width;
    tableStickyLeftFrontierGhost.style.setProperty(
      "--sticky-left-frontier-ghost-left",
      `${columnRightRelative}px`,
    );
  }
  tableStickyLeftFrontierGhost.setAttribute("data-visible", "");

  let futureStickyLeftFrontierColumnIndex = stickyLeftFrontierColumnIndex;
  const onFutureLeftStickyFrontierIndexChange = (index) => {
    futureStickyLeftFrontierColumnIndex = index;

    if (index === stickyLeftFrontierColumnIndex) {
      tableStickyLeftFrontierPreview.removeAttribute("data-visible");
      return;
    }
    let previewPosition;
    if (index === -1) {
      previewPosition =
        tableStickyLeftFrontierGhost.getBoundingClientRect().width;
    } else {
      const colElement = colElements[index];
      const columnRect = colElement.getBoundingClientRect();
      const tableContainerRect = tableContainer.getBoundingClientRect();
      previewPosition = columnRect.right - tableContainerRect.left;
    }

    tableStickyLeftFrontierPreview.style.setProperty(
      "--sticky-left-frontier-preview-left",
      `${previewPosition}px`,
    );
    tableStickyLeftFrontierPreview.setAttribute("data-visible", "");
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
        "move-sticky-left-frontier",
      );
      break;
    }
  }

  const moveStickyLeftFrontierGesture = createDragToMoveGesture({
    name: "move-sticky-left-frontier",
    direction: { x: true },
    // keepMarkersOnRelease: true,
    backdropZIndex: Z_INDEX_STICKY_FRONTIER_BACKDROP,

    onGrab,
    onDrag: (gesture) => {
      update_frontier_index: {
        const ghostRect = tableStickyLeftFrontierGhost.getBoundingClientRect();
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
            onFutureLeftStickyFrontierIndexChange(i - 1);
            break;
          }
          onFutureLeftStickyFrontierIndexChange(i);
          break;
        }
      }
      onDrag?.(gesture, futureStickyLeftFrontierColumnIndex);
    },
    onRelease: (gesture) => {
      onRelease?.(gesture, futureStickyLeftFrontierColumnIndex);
    },
  });

  moveStickyLeftFrontierGesture.addTeardown(() => {
    tableStickyLeftFrontierPreview.removeAttribute("data-visible");
    tableStickyLeftFrontierPreview.style.removeProperty(
      "--sitkcy-left-frontier-preview-left",
    );

    tableStickyLeftFrontierGhost.removeAttribute("data-visible");
    tableStickyLeftFrontierGhost.style.removeProperty(
      "--sitkcy-left-frontier-ghost-left",
    );
    tableStickyLeftFrontierGhost.style.left = ""; // reset left set by the drag

    restoreColumnDragObstacleAttr();
  });
  moveStickyLeftFrontierGesture.grabViaMousedown(mousedownEvent, {
    element: tableStickyLeftFrontierGhost,
  });
};

// When we cross half the height of a row we inject a second horizontal line where the new frontier would be
// to tell user "hey if you grab here, the frontier will be there"
// At this stage user can see 3 frontiers. Where it is, the one he grab, the future one if he releases.
const initMoveStickyTopFrontierByMousedown = (
  mousedownEvent,
  { stickyTopFrontierRowIndex, onGrab, onDrag, onRelease },
) => {
  const tableCell = mousedownEvent.target.closest("th,td");
  const table = tableCell.closest("table");
  const tableContainer = table.closest(".navi_table_container");
  const rowElements = Array.from(table.querySelectorAll("tr"));
  const tableStickyTopFrontierGhost = tableContainer.querySelector(
    ".navi_table_sticky_top_frontier_ghost",
  );
  const tableStickyTopFrontierPreview = tableContainer.querySelector(
    ".navi_table_sticky_top_frontier_preview",
  );
  // We must reset scroll because we're limiting ability to move the sticky frontier to a row
  // But if there is already a scroll we might already have crossed that row
  // Creating a scenario where we start the drag already at the bottom of an obstacle which won't provide a nice UX
  getScrollableParent(table).scrollTop = 0;

  const tableRect = table.getBoundingClientRect();
  const tableContainerRect = tableContainer.getBoundingClientRect();
  tableStickyTopFrontierGhost.style.setProperty(
    "--table-width",
    `${tableRect.width}px`,
  );
  tableStickyTopFrontierPreview.style.setProperty(
    "--table-width",
    `${tableRect.width}px`,
  );

  if (stickyTopFrontierRowIndex === -1) {
    tableStickyTopFrontierGhost.style.setProperty(
      "--sticky-top-frontier-ghost-top",
      `0px`,
    );
  } else {
    const tableCellRect = tableCell.getBoundingClientRect();
    const rowTopRelative = tableCellRect.top - tableContainerRect.top;
    const rowBottomRelative = rowTopRelative + tableCellRect.height;
    tableStickyTopFrontierGhost.style.setProperty(
      "--sticky-top-frontier-ghost-top",
      `${rowBottomRelative}px`,
    );
  }
  tableStickyTopFrontierGhost.setAttribute("data-visible", "");

  let futureStickyTopFrontierRowIndex = stickyTopFrontierRowIndex;
  const onFutureStickyTopFrontierIndexChange = (index) => {
    futureStickyTopFrontierRowIndex = index;

    if (index === stickyTopFrontierRowIndex) {
      tableStickyTopFrontierPreview.removeAttribute("data-visible");
      return;
    }
    let previewPosition;
    if (index === -1) {
      previewPosition =
        tableStickyTopFrontierGhost.getBoundingClientRect().height;
    } else {
      const rowElement = rowElements[index];
      const rowRect = rowElement.getBoundingClientRect();
      const tableContainerRect = tableContainer.getBoundingClientRect();
      previewPosition = rowRect.bottom - tableContainerRect.top;
    }

    tableStickyTopFrontierPreview.style.setProperty(
      "--sticky-top-frontier-preview-top",
      `${previewPosition}px`,
    );
    tableStickyTopFrontierPreview.setAttribute("data-visible", "");
  };

  // Find the row at the middle of the visible area to use as drag boundary
  // The goal it to prevent user from dragging the frontier too far
  // and ending with a situation where sticky rows take most/all the visible space
  let restoreRowDragObstacleAttr = () => {};
  setup_middle_row_obstacle: {
    const tableContainerHeight = tableContainerRect.height;
    const middleY = tableContainerHeight / 2;
    // Find if there's a row at the middle position
    for (let i = 0; i < rowElements.length; i++) {
      const rowElement = rowElements[i];
      const rowRect = rowElement.getBoundingClientRect();
      const rowTopRelative = rowRect.top - tableContainerRect.top;
      const rowBottomRelative = rowRect.bottom - tableContainerRect.top;
      if (i + 1 === rowElements.length) {
        // no next row
        break;
      }
      if (rowBottomRelative < middleY) {
        // row is before the middle
        continue;
      }
      if (rowTopRelative > middleY) {
        // row is after the middle
        continue;
      }
      // Add drag obstacle to prevent dragging beyond the middle area
      const obstacleRowElement = rowElements[i + 1];
      restoreRowDragObstacleAttr = setAttribute(
        obstacleRowElement,
        "data-drag-obstacle",
        "move-sticky-top-frontier",
      );
      break;
    }
  }

  const moveStickyTopFrontierGesture = createDragToMoveGesture({
    name: "move-sticky-top-frontier",
    direction: { y: true },
    // keepMarkersOnRelease: true,
    backdropZIndex: Z_INDEX_STICKY_FRONTIER_BACKDROP,

    onGrab,
    onDrag: (gesture) => {
      update_frontier_index: {
        const ghostRect = tableStickyTopFrontierGhost.getBoundingClientRect();
        const ghostCenterY = ghostRect.top + ghostRect.height / 2;
        // Find which row the ghost is currently over
        let i = 0;
        for (; i < rowElements.length; i++) {
          const rowElement = rowElements[i];
          const rowRect = rowElement.getBoundingClientRect();
          if (ghostCenterY < rowRect.top) {
            continue;
          }
          if (ghostCenterY > rowRect.bottom) {
            continue;
          }
          // on the row, top or bottom side?
          const rowCenterY = rowRect.top + rowRect.height / 2;
          if (ghostCenterY < rowCenterY) {
            onFutureStickyTopFrontierIndexChange(i - 1);
            break;
          }
          onFutureStickyTopFrontierIndexChange(i);
          break;
        }
      }
      onDrag?.(gesture, futureStickyTopFrontierRowIndex);
    },
    onRelease: (gesture) => {
      onRelease?.(gesture, futureStickyTopFrontierRowIndex);
    },
  });

  moveStickyTopFrontierGesture.addTeardown(() => {
    tableStickyTopFrontierPreview.removeAttribute("data-visible");
    tableStickyTopFrontierPreview.style.removeProperty(
      "--sticky-top-frontier-preview-top",
    );

    tableStickyTopFrontierGhost.removeAttribute("data-visible");
    tableStickyTopFrontierGhost.style.removeProperty(
      "--sticky-top-frontier-ghost-top",
    );
    tableStickyTopFrontierGhost.style.top = ""; // reset top set by the drag

    restoreRowDragObstacleAttr();
  });
  moveStickyTopFrontierGesture.grabViaMousedown(mousedownEvent, {
    element: tableStickyTopFrontierGhost,
  });
};
