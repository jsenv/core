// TODO: sticky left/top frontier should likely use "followPosition"
// to be properly position in absolute in the document body
// because otherwise they can't properly follow table as it scrolls
// (they can't be sticky, they can't react to scroll, so they have to be absolute in the document body)

import {
  createDragToMoveGesture,
  getDropTargetInfo,
  getScrollableParent,
} from "@jsenv/dom";
import { useContext } from "preact/hooks";

import {
  Z_INDEX_STICKY_COLUMN,
  Z_INDEX_STICKY_CORNER,
  Z_INDEX_STICKY_FRONTIER_BACKDROP,
  Z_INDEX_STICKY_FRONTIER_GHOST,
  Z_INDEX_STICKY_FRONTIER_PREVIEW,
  Z_INDEX_STICKY_ROW,
} from "../z_indexes.js";
import { TableStickyContext } from "./table_sticky.js";

import.meta.css = /* css */ `
  body {
    --sticky-frontier-color: #c0c0c0;
    --sticky-left-frontier-width: 5px;
    --sticky-top-frontier-height: 5px;
  }

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

  .navi_table_sticky_frontier {
    position: absolute;
  }

  .navi_table_sticky_frontier[data-left] {
    top: 0;
    bottom: 0;
    left: var(--sticky-group-left-frontier, 0px);
    width: var(--sticky-left-frontier-width);
    background: linear-gradient(
      to right,
      rgba(0, 0, 0, 0.3) 0%,
      rgba(0, 0, 0, 0.1) 50%,
      rgba(0, 0, 0, 0) 100%
    );
  }

  .navi_table_sticky_frontier[data-top] {
    left: 0;
    right: 0;
    top: var(--sticky-group-top-frontier, 0px);
    height: var(--sticky-top-frontier-height);
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.3) 0%,
      rgba(0, 0, 0, 0.1) 50%,
      rgba(0, 0, 0, 0) 100%
    );
  }

  .navi_table_sticky_frontier_ghost,
  .navi_table_sticky_frontier_preview {
    position: absolute;
    pointer-events: none;
    opacity: 0;
  }
  .navi_table_sticky_frontier_ghost {
    z-index: ${Z_INDEX_STICKY_FRONTIER_GHOST};
    background: rgba(68, 71, 70, 0.5);
  }
  .navi_table_sticky_frontier_preview {
    z-index: ${Z_INDEX_STICKY_FRONTIER_PREVIEW};
    background: red;
  }
  .navi_table_sticky_frontier_preview[data-visible] {
    opacity: 1;
  }
  .navi_table_sticky_frontier_ghost[data-left],
  .navi_table_sticky_frontier_preview[data-left] {
    top: 0;
    width: var(--sticky-left-frontier-width);
    height: var(--table-height, 100%);
  }
  .navi_table_sticky_frontier_ghost[data-left] {
    left: calc(
      var(--sticky-left-frontier-ghost-left, 0px) - var(
          --sticky-left-frontier-width
        )
    );
  }
  .navi_table_sticky_frontier_preview[data-left] {
    left: calc(
      var(--sticky-left-frontier-preview-left, 0px) - var(
          --sticky-left-frontier-width
        )
    );
  }

  .navi_table_sticky_frontier_ghost[data-top],
  .navi_table_sticky_frontier_preview[data-top] {
    left: 0;
    width: var(--table-width, 100%);
    height: var(--sticky-top-frontier-height);
  }

  .navi_table_sticky_frontier_ghost[data-top] {
    top: calc(
      var(--sticky-top-frontier-ghost-top, 0px) - var(
          --sticky-top-frontier-height
        )
    );
  }
  .navi_table_sticky_frontier_preview[data-top] {
    top: calc(
      var(--sticky-top-frontier-preview-top, 0px) - var(
          --sticky-top-frontier-height
        )
    );
  }

  /* Avoid overlaping between sticky frontiers and resize handles */
  [data-after-sticky-left-frontier] .navi_table_cell_resize_handle[data-top],
  [data-after-sticky-left-frontier]
    .navi_table_cell_resize_handle[data-bottom] {
    left: var(--sticky-left-frontier-width);
  }
  [data-sticky-left-frontier] .navi_table_cell_resize_handle[data-top],
  [data-sticky-left-frontier] .navi_table_cell_resize_handle[data-bottom] {
    right: var(--sticky-left-frontier-width);
  }
  [data-after-sticky-top-frontier] .navi_table_cell_resize_handle[data-left],
  [data-after-sticky-top-frontier] .navi_table_cell_resize_handle[data-right] {
    top: var(--sticky-top-frontier-height);
  }
  [data-sticky-top-frontier] .navi_table_cell_resize_handle[data-left],
  [data-sticky-top-frontier] .navi_table_cell_resize_handle[data-right] {
    bottom: var(--sticky-top-frontier-height);
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
`;

export const TableStickyFrontier = () => {
  return (
    <>
      <TableStickyLeftFrontier />
      <TableStickyTopFrontier />
      <TableStickyLeftFrontierGhost />
      <TableStickyLeftFrontierPreview />
      <TableStickyTopFrontierGhost />
      <TableStickyTopFrontierPreview />
    </>
  );
};

const TableStickyLeftFrontier = () => {
  const { stickyLeftFrontierColumnIndex, onStickyLeftFrontierChange } =
    useContext(TableStickyContext);
  const canMoveFrontier = Boolean(onStickyLeftFrontierChange);

  if (stickyLeftFrontierColumnIndex === -1) {
    return null;
  }
  return (
    <div
      className="navi_table_sticky_frontier"
      data-left=""
      inert={!canMoveFrontier}
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
const TableStickyTopFrontier = () => {
  const { stickyTopFrontierRowIndex, onStickyTopFrontierChange } =
    useContext(TableStickyContext);
  const canMoveFrontier = Boolean(onStickyTopFrontierChange);

  if (stickyTopFrontierRowIndex === -1) {
    return null;
  }
  return (
    <div
      className="navi_table_sticky_frontier"
      data-top=""
      inert={!canMoveFrontier}
      onMouseDown={(e) => {
        if (e.button !== 0) {
          return;
        }
        e.preventDefault(); // prevent text selection
        e.stopPropagation(); // prevent drag column
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

const TableStickyLeftFrontierGhost = () => {
  return <div className="navi_table_sticky_frontier_ghost" data-left=""></div>;
};
const TableStickyLeftFrontierPreview = () => {
  return <div className="navi_table_sticky_frontier_preview" data-top=""></div>;
};

const TableStickyTopFrontierGhost = () => {
  return <div className="navi_table_sticky_frontier_ghost" data-top=""></div>;
};
const TableStickyTopFrontierPreview = () => {
  return <div className="navi_table_sticky_frontier_preview" data-top=""></div>;
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
      ? ".navi_table_sticky_frontier_ghost[data-left]"
      : ".navi_table_sticky_frontier_ghost[data-top]";
  const previewSelector =
    axis === "x"
      ? ".navi_table_sticky_frontier_preview[data-left]"
      : ".navi_table_sticky_frontier_preview[data-top]";
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

  const scrollableParent = getScrollableParent(table);
  // Reset scroll to prevent starting drag in obstacle position
  scrollableParent[scrollProperty] = 0;

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

  const moveFrontierGesture = createDragToMoveGesture({
    name: gestureName,
    direction: { [axis]: true },
    backdropZIndex: Z_INDEX_STICKY_FRONTIER_BACKDROP,
    areaConstraint: "visible",

    onGrab,
    onDrag: (gestureInfo) => {
      const dropTargetInfo = getDropTargetInfo(gestureInfo, elements);
      if (dropTargetInfo) {
        const dropColumnIndex = dropTargetInfo.index;
        const dropFrontierIndex =
          dropTargetInfo.elementSide[axis] === "start"
            ? dropColumnIndex - 1
            : dropColumnIndex;
        if (dropFrontierIndex !== futureFrontierIndex) {
          onFutureFrontierIndexChange(dropFrontierIndex);
        }
      }
      onDrag?.(gestureInfo, futureFrontierIndex);
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
