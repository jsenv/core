import { createDragToMoveGesture } from "@jsenv/dom";
import {
  Z_INDEX_RESIZER_BACKDROP,
  Z_INDEX_RESIZER_HANDLE,
} from "../z_indexes.js";

const ROW_MIN_HEIGHT = 30;

import.meta.css = /* css */ `
  .navi_table_row_resize_handle_top_interaction,
  .navi_table_row_resize_handle_bottom_interaction {
    cursor: ns-resize;
    position: absolute;
    left: 0;
    right: 0;
    background: orange;
    opacity: 0.5;
    height: 8px;
    z-index: ${Z_INDEX_RESIZER_HANDLE};
  }
  .navi_table_row_resize_handle_top_interaction {
    top: 0;
  }
  .navi_table_row_resize_handle_bottom_interaction {
    bottom: 0;
  }

  [data-sticky-left-frontier] .navi_table_row_resize_handle_top_interaction,
  [data-sticky-left-frontier] .navi_table_row_resize_handle_bottom_interaction {
    /* Avoid overlaping the sticky frontier vertical line */
    right: 5px;
  }

  .navi_table_row_resizer {
    pointer-events: none;
    position: absolute;
    z-index: 1000000;
    left: 0;
    right: 0;
    height: 10px;
    top: var(--table-cell-bottom, 0);
    opacity: 0;
  }

  .navi_table_row_resizer .navi_table_row_resize_handle_top,
  .navi_table_row_resizer .navi_table_row_resize_handle_bottom {
    position: absolute;
    width: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 15px;
    background: #444746;
    /* opacity: 0.5; */
    width: 26px;
    height: 5px;
    max-width: 80%;
  }
  .navi_table_row_resizer .navi_table_row_resize_handle_top {
    top: 2px;
  }
  .navi_table_row_resizer .navi_table_row_resize_handle_bottom {
    bottom: 3px;
  }

  .navi_table_row_resize_handle_container {
    position: absolute;
    left: 0;
    top: -10px;
    bottom: 0;
    width: var(--table-cell-width);
  }

  .navi_table_row_resizer_line {
    position: absolute;
    left: 0;
    right: 0;
    height: 5px;
    top: -3px;
    background: #c0c0c0;
    opacity: 0;
  }

  .navi_table_row_resizer[data-hover],
  .navi_table_row_resizer[data-resizing] {
    opacity: 1;
  }

  .navi_table_row_resizer[data-resizing] .navi_table_row_resizer_line {
    opacity: 1;
  }
`;

export const TableRowResizer = () => {
  return (
    <div className="navi_table_row_resizer">
      <div className="navi_table_row_resize_handle_container">
        <div className="navi_table_row_resize_handle_top"></div>
        <div className="navi_table_row_resize_handle_bottom"></div>
      </div>
      <div className="navi_table_row_resizer_line"></div>
    </div>
  );
};

const updateTableRowResizerPosition = (rowCell) => {
  const tableRowCellRect = rowCell.getBoundingClientRect();
  const tableContainer = rowCell.closest(".navi_table_container");
  const tableRowResizer = tableContainer.querySelector(
    ".navi_table_row_resizer",
  );
  if (tableRowResizer.hasAttribute("data-resizing")) {
    // ensure mouseenter/mouseleave while resizing cannot interfere
    // while resizing (would move the resizer on other rows)
    return;
  }
  const tableContainerRect = tableContainer.getBoundingClientRect();
  const tableRowTopRelative = tableRowCellRect.top - tableContainerRect.top;
  const tableRowWidth = tableRowCellRect.width;
  const tableRowHeight = tableRowCellRect.height;

  const tableRowRelativeBottom = tableRowTopRelative + tableRowHeight;
  tableRowResizer.style.setProperty(
    "--table-cell-bottom",
    `${tableRowRelativeBottom}px`,
  );
  tableRowResizer.style.setProperty("--table-cell-width", `${tableRowWidth}px`);
  tableRowResizer.setAttribute("data-hover", "");
};

export const TableRowTopResizeHandle = ({
  rowMinHeight,
  rowMaxHeight,
  onGrab,
  onDrag,
  onRelease,
}) => {
  return (
    <div
      className="navi_table_row_resize_handle_top_interaction"
      onMouseDown={(e) => {
        if (e.button !== 0) {
          return;
        }
        e.preventDefault(); // prevent text selection
        e.stopPropagation(); // prevent drag row
        initResizeTableRowByMousedown(e, {
          rowMinHeight,
          rowMaxHeight,
          onGrab,
          onDrag,
          onRelease,
          isTop: true,
        });
      }}
      onMouseEnter={(e) => {
        onMouseEnterTopResizeHandle(e);
      }}
      onMouseLeave={(e) => {
        onMouseLeaveTopResizeHandle(e);
      }}
    ></div>
  );
};
export const TableRowBottomResizeHandle = ({
  rowMinHeight,
  rowMaxHeight,
  onGrab,
  onDrag,
  onRelease,
}) => {
  return (
    <div
      className="navi_table_row_resize_handle_bottom_interaction"
      onMouseDown={(e) => {
        if (e.button !== 0) {
          return;
        }
        e.preventDefault(); // prevent text selection
        e.stopPropagation(); // prevent drag row
        initResizeTableRowByMousedown(e, {
          rowMinHeight,
          rowMaxHeight,
          onGrab,
          onDrag,
          onRelease,
        });
      }}
      onMouseEnter={(e) => {
        onMouseEnterBottomResizeHandle(e);
      }}
      onMouseLeave={(e) => {
        onMouseLeaveBottomResizeHandle(e);
      }}
    ></div>
  );
};
const onMouseEnterTopResizeHandle = (e) => {
  const currentRow = e.target.closest("tr");
  const previousRow = findPreviousTableRow(currentRow);
  if (previousRow) {
    updateTableRowResizerPosition(previousRow.querySelector("th,td"));
  }
};
const onMouseEnterBottomResizeHandle = (e) => {
  const rowCell = e.target.closest("th,td");
  updateTableRowResizerPosition(rowCell);
};
const onMouseLeaveTopResizeHandle = (e) => {
  const tableContainer = e.target.closest(".navi_table_container");
  const tableRowResizer = tableContainer.querySelector(
    ".navi_table_row_resizer",
  );
  tableRowResizer.removeAttribute("data-hover");
};
const onMouseLeaveBottomResizeHandle = (e) => {
  const tableContainer = e.target.closest(".navi_table_container");
  const tableRowResizer = tableContainer.querySelector(
    ".navi_table_row_resizer",
  );
  tableRowResizer.removeAttribute("data-hover");
};

const initResizeTableRowByMousedown = (
  mousedownEvent,
  { rowMinHeight, rowMaxHeight, onGrab, onDrag, onRelease, isTop },
) => {
  let tableRow = mousedownEvent.target.closest("tr");
  if (isTop) {
    tableRow = findPreviousTableRow(tableRow);
  }
  if (!tableRow) {
    return; // No row to resize
  }

  const tableCell = tableRow.querySelector("th,td");
  const tableContainer = tableCell.closest(".navi_table_container");
  const tableRowResizer = tableContainer.querySelector(
    ".navi_table_row_resizer",
  );

  // Calculate custom bounds for row resizing
  const tableRowCellRect = tableCell.getBoundingClientRect();
  const tableContainerRect = tableContainer.getBoundingClientRect();
  const currentRowCellTop = tableRowCellRect.top - tableContainerRect.top;
  const currentRowCellHeight = tableRowCellRect.height;

  // Top bound: minimum height of 30px (can shrink row down to this height)
  const minHeight =
    typeof rowMinHeight === "number" && rowMinHeight > ROW_MIN_HEIGHT
      ? rowMinHeight
      : ROW_MIN_HEIGHT;
  // Bottom bound: maximum height of 500px (can expand beyond scrollable parent if needed)
  const maxHeight =
    typeof rowMaxHeight === "number" && rowMaxHeight < 300 ? rowMaxHeight : 300;
  const customTopBound = currentRowCellTop + minHeight;
  const maxExpandAmount = maxHeight - currentRowCellHeight;
  const customBottomBound =
    currentRowCellTop + currentRowCellHeight + maxExpandAmount;

  const dragToMoveGesture = createDragToMoveGesture({
    name: "resize-row",
    direction: { y: true },
    backdropZIndex: Z_INDEX_RESIZER_BACKDROP,
    customTopBound,
    customBottomBound,
    onGrab: () => {
      updateTableRowResizerPosition(tableRow);
      onGrab?.();
    },
    onDrag,
    onRelease: (gesture) => {
      const newHeight = currentRowCellHeight + gesture.yMove;
      onRelease(newHeight, currentRowCellHeight);
    },
  });
  dragToMoveGesture.addTeardown(() => {
    tableRowResizer.style.top = "";
    tableRowResizer.removeAttribute("data-resizing");
  });

  tableRowResizer.setAttribute("data-resizing", "");
  dragToMoveGesture.grabViaMousedown(mousedownEvent, {
    element: tableRowResizer,
  });
};

const findPreviousTableRow = (currentRow) => {
  // First, try to find previous sibling within the same table section
  const previousSibling = currentRow.previousElementSibling;
  if (previousSibling) {
    return previousSibling;
  }

  // Otherwise, get all rows in the table and find the previous one
  const table = currentRow.closest("table");
  const allRows = Array.from(table.querySelectorAll("tr"));
  const currentIndex = allRows.indexOf(currentRow);
  return currentIndex > 0 ? allRows[currentIndex - 1] : null;
};
