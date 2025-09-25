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
    top: 0;
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

  /* Avoid overlaping between sticky frontiers and resize handles */
  [data-after-sticky-left-frontier]
    .navi_table_row_resize_handle_top_interaction,
  [data-after-sticky-left-frontier]
    .navi_table_row_resize_handle_bottom_interaction {
    left: var(--sticky-left-frontier-width);
  }
  [data-sticky-left-frontier] .navi_table_row_resize_handle_top_interaction,
  [data-sticky-left-frontier] .navi_table_row_resize_handle_bottom_interaction {
    right: var(--sticky-left-frontier-width);
  }
  [data-after-sticky-top-frontier]
    .navi_table_column_resize_handle_left_interaction,
  [data-after-sticky-top-frontier]
    .navi_table_column_resize_handle_right_interaction {
    top: var(--sticky-top-frontier-height);
  }
  [data-sticky-top-frontier] .navi_table_column_resize_handle_left_interaction,
  [data-sticky-top-frontier]
    .navi_table_column_resize_handle_right_interaction {
    bottom: var(--sticky-top-frontier-height);
  }
`;

export const TableCellStickyFrontier = ({
  columnIndex,
  rowIndex,
  stickyLeftFrontierColumnIndex,
  stickyTopFrontierRowIndex,
  onStickyLeftFrontierChange,
  onStickyTopFrontierChange,
}) => {
  let shouldDisplayStickyLeftFrontier = false;
  let shouldDisplayStickyTopFrontier = false;

  const isBeforeStickyLeftFrontier =
    columnIndex < stickyLeftFrontierColumnIndex;
  const isAfterStickyLeftFrontier = columnIndex > stickyLeftFrontierColumnIndex;
  const isOnStickyLeftFrontier = columnIndex === stickyLeftFrontierColumnIndex;
  const isBeforeStickyTopFrontier = rowIndex < stickyTopFrontierRowIndex;
  const isAfterStickyTopFrontier = rowIndex > stickyTopFrontierRowIndex;
  const isOnStickyTopFrontier = rowIndex === stickyTopFrontierRowIndex;

  if (isOnStickyLeftFrontier) {
    shouldDisplayStickyLeftFrontier = true;
  }
  if (isOnStickyTopFrontier) {
    shouldDisplayStickyTopFrontier = false;
  }

  return (
    <>
      {shouldDisplayStickyLeftFrontier && (
        <TableStickyLeftFrontier
          stickyLeftFrontierColumnIndex={stickyLeftFrontierColumnIndex}
          onStickyLeftFrontierChange={onStickyLeftFrontierChange}
        />
      )}
      {shouldDisplayStickyTopFrontier && (
        <TableStickyTopFrontier
          stickyTopFrontierRowIndex={stickyTopFrontierRowIndex}
          onStickyTopFrontierChange={onStickyTopFrontierChange}
        />
      )}
    </>
  );
};

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

// Generic function to handle sticky frontier movement for both axes
const initMoveStickyFrontierByMousedown = (
  mousedownEvent,
  {
    frontierIndex,
    onGrab,
    onDrag,
    onRelease,
    // Axis-specific configuration
    axis, // 'x' or 'y'
    elements, // array of colElements or rowElements
  },
) => {
  const tableCell = mousedownEvent.target.closest("th,td");
  const table = tableCell.closest("table");
  const tableContainer = table.closest(".navi_table_container");

  // Get elements based on axis
  const gestureName =
    axis === "x" ? "move-sticky-left-frontier" : "move-sticky-top-frontier";
  const scrollProperty = axis === "x" ? "scrollLeft" : "scrollTop";
  const ghostSelector =
    axis === "x"
      ? ".navi_table_sticky_left_frontier_ghost"
      : ".navi_table_sticky_top_frontier_ghost";
  const previewSelector =
    axis === "x"
      ? ".navi_table_sticky_left_frontier_preview"
      : ".navi_table_sticky_top_frontier_preview";
  const ghostVariableName =
    axis === "x"
      ? "--sticky-left-frontier-ghost-left"
      : "--sticky-top-frontier-ghost-top";
  const previewVariableName =
    axis === "x"
      ? "--sticky-left-frontier-preview-left"
      : "--sticky-top-frontier-preview-top";

  const ghostElement = tableContainer.querySelector(ghostSelector);
  const previewElement = tableContainer.querySelector(previewSelector);

  // Find the element (column/row) at the middle of the visible area to use as drag boundary
  // The goal it to prevent user from dragging the frontier too far
  // and ending with a situation where sticky elements take most/all the visible space
  const setupObstacle = (elements, tableContainerRect, gestureName) => {
    const containerSize =
      axis === "x" ? tableContainerRect.width : tableContainerRect.height;
    const middle = containerSize / 2;

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const elementRect = element.getBoundingClientRect();
      let startRelative;
      let endRelative;

      if (axis === "x") {
        startRelative = elementRect.left - tableContainerRect.left;
        endRelative = elementRect.right - tableContainerRect.left;
      } else {
        startRelative = elementRect.top - tableContainerRect.top;
        endRelative = elementRect.bottom - tableContainerRect.top;
      }

      if (i + 1 === elements.length) {
        break;
      }
      if (endRelative < middle) {
        continue;
      }
      if (startRelative > middle) {
        continue;
      }

      const obstacleElement = elements[i + 1];
      return setAttribute(obstacleElement, "data-drag-obstacle", gestureName);
    }
    return () => {};
  };

  // Reset scroll to prevent starting drag in obstacle position
  getScrollableParent(table)[scrollProperty] = 0;

  // Setup table dimensions for ghost/preview
  const tableRect = table.getBoundingClientRect();
  const tableContainerRect = tableContainer.getBoundingClientRect();
  if (axis === "x") {
    ghostElement.style.setProperty("--table-height", `${tableRect.height}px`);
    previewElement.style.setProperty("--table-height", `${tableRect.height}px`);
  } else {
    ghostElement.style.setProperty("--table-width", `${tableRect.width}px`);
    previewElement.style.setProperty("--table-width", `${tableRect.width}px`);
  }

  // Setup initial ghost position
  if (frontierIndex === -1) {
    ghostElement.style.setProperty(ghostVariableName, "0px");
  } else {
    const element = elements[frontierIndex];
    const elementRect = element.getBoundingClientRect();
    let position;

    if (axis === "x") {
      const elementLeftRelative = elementRect.left - tableContainerRect.left;
      position = elementLeftRelative + elementRect.width;
    } else {
      const elementTopRelative = elementRect.top - tableContainerRect.top;
      position = elementTopRelative + elementRect.height;
    }

    ghostElement.style.setProperty(ghostVariableName, `${position}px`);
  }
  ghostElement.setAttribute("data-visible", "");

  let futureFrontierIndex = frontierIndex;
  const onFutureFrontierIndexChange = (index) => {
    futureFrontierIndex = index;

    // We maintain a visible preview of the frontier
    // to tell user "hey if you grab here, the frontier will be there"
    // At this stage user can see 3 frontiers. Where it is, the one he grab, the future one if he releases.
    if (index === frontierIndex) {
      previewElement.removeAttribute("data-visible");
      return;
    }
    let previewPosition;
    if (index === -1) {
      const ghostRect = ghostElement.getBoundingClientRect();
      previewPosition = axis === "x" ? ghostRect.width : ghostRect.height;
    } else {
      const element = elements[index];
      const elementRect = element.getBoundingClientRect();
      const tableContainerRect = tableContainer.getBoundingClientRect();
      if (axis === "x") {
        previewPosition = elementRect.right - tableContainerRect.left;
      } else {
        previewPosition = elementRect.bottom - tableContainerRect.top;
      }
    }
    previewElement.style.setProperty(
      previewVariableName,
      `${previewPosition}px`,
    );
    previewElement.setAttribute("data-visible", "");
  };

  const restoreDragObstacleAttr = setupObstacle(
    elements,
    tableContainerRect,
    gestureName,
  );

  const moveFrontierGesture = createDragToMoveGesture({
    name: gestureName,
    direction: { [axis]: true },
    backdropZIndex: Z_INDEX_STICKY_FRONTIER_BACKDROP,

    onGrab,
    onDrag: (gesture) => {
      const ghostRect = ghostElement.getBoundingClientRect();
      const ghostCenter =
        axis === "x"
          ? ghostRect.left + ghostRect.width / 2
          : ghostRect.top + ghostRect.height / 2;

      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const elementRect = element.getBoundingClientRect();
        let elementStart;
        let elementEnd;

        if (axis === "x") {
          elementStart = elementRect.left;
          elementEnd = elementRect.right;
        } else {
          elementStart = elementRect.top;
          elementEnd = elementRect.bottom;
        }

        if (ghostCenter < elementStart) {
          continue;
        }
        if (ghostCenter > elementEnd) {
          continue;
        }
        // We are over this element, now decide if we are before or after the middle of the element
        const elementCenter = elementStart + (elementEnd - elementStart) / 2;
        if (ghostCenter < elementCenter) {
          onFutureFrontierIndexChange(i - 1);
        } else {
          onFutureFrontierIndexChange(i);
        }
        break;
      }
      onDrag?.(gesture, futureFrontierIndex);
    },
    onRelease: (gesture) => {
      onRelease?.(gesture, futureFrontierIndex);
    },
  });

  moveFrontierGesture.addTeardown(() => {
    previewElement.removeAttribute("data-visible");
    previewElement.style.removeProperty(previewVariableName);
    ghostElement.removeAttribute("data-visible");
    ghostElement.style.removeProperty(ghostVariableName);
    ghostElement.style[axis === "x" ? "left" : "top"] = ""; // reset position set by drag
    restoreDragObstacleAttr();
  });

  moveFrontierGesture.grabViaMousedown(mousedownEvent, {
    element: ghostElement,
  });
};

const initMoveStickyLeftFrontierByMousedown = (
  mousedownEvent,
  { stickyLeftFrontierColumnIndex, onGrab, onDrag, onRelease },
) => {
  const tableContainer = mousedownEvent.target.closest(".navi_table_container");
  const table = tableContainer.querySelector("table");
  const colgroup = table.querySelector("colgroup");
  const colElements = Array.from(colgroup.children);

  return initMoveStickyFrontierByMousedown(mousedownEvent, {
    frontierIndex: stickyLeftFrontierColumnIndex,
    onGrab,
    onDrag,
    onRelease,
    axis: "x",
    elements: colElements,
  });
};

const initMoveStickyTopFrontierByMousedown = (
  mousedownEvent,
  { stickyTopFrontierRowIndex, onGrab, onDrag, onRelease },
) => {
  const tableContainer = mousedownEvent.target.closest(".navi_table_container");
  const table = tableContainer.querySelector("table");
  const rowElements = Array.from(table.querySelectorAll("tr"));

  return initMoveStickyFrontierByMousedown(mousedownEvent, {
    frontierIndex: stickyTopFrontierRowIndex,
    onGrab,
    onDrag,
    onRelease,
    axis: "y",
    elements: rowElements,
  });
};
