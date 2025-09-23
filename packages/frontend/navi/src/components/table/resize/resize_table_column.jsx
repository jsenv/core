import { createDragToMoveGesture } from "@jsenv/dom";
import {
  Z_INDEX_RESIZER_BACKDROP,
  Z_INDEX_RESIZER_HANDLE,
} from "../z_indexes.js";

import.meta.css = /* css */ `
  .navi_table th,
  .navi_table td {
    /* ensure table cell padding does not count when we say column = 50px we want a column of 50px, not 50px + paddings */
    box-sizing: border-box;
  }

  .navi_table_column_resize_handle_left,
  .navi_table_column_resize_handle_right {
    cursor: ew-resize;
    position: absolute;
    width: 8px;
    height: 100%;
    top: 50%;
    transform: translateY(-50%);
    background: orange;
    opacity: 0.5;
    z-index: ${Z_INDEX_RESIZER_HANDLE};
  }
  .navi_table_column_resize_handle_left {
    left: 0;
  }
  .navi_table_column_resize_handle_right {
    right: 0;
  }

  .navi_table_column_resizer {
    pointer-events: none;
    position: absolute;
    z-index: 1000000;
    top: 0;
    bottom: 0;
    width: 10px;
    left: var(--table-cell-right, 0);
    opacity: 0;
  }

  .navi_table_column_resizer .navi_table_column_resize_handle_left,
  .navi_table_column_resizer .navi_table_column_resize_handle_right {
    border-radius: 15px;
    background: #444746;
    /* opacity: 0.5; */
    width: 5px;
    height: 26px;
    max-height: 80%;
  }
  .navi_table_column_resizer .navi_table_column_resize_handle_left {
    left: 2px;
  }
  .navi_table_column_resizer .navi_table_column_resize_handle_right {
    right: 2px;
  }

  .navi_table_column_resize_handle_container {
    position: absolute;
    top: 0;
    left: -10px;
    right: 0;
    height: var(--table-cell-height);
  }

  .navi_table_column_resizer_line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 6px;
    left: -3px;
    background: #c0c0c0;
    opacity: 0;
  }

  .navi_table_column_resizer[data-hover],
  .navi_table_column_resizer[data-resizing] {
    opacity: 1;
  }

  .navi_table_column_resizer[data-resizing] .navi_table_column_resizer_line {
    opacity: 1;
  }
`;

export const TableColumnResizer = () => {
  return (
    <div className="navi_table_column_resizer">
      <div className="navi_table_column_resize_handle_container">
        <div className="navi_table_column_resize_handle_left"></div>
        <div className="navi_table_column_resize_handle_right"></div>
      </div>
      <div className="navi_table_column_resizer_line"></div>
    </div>
  );
};
const updateTableColumnResizerPosition = (tableCell) => {
  const tableCellRect = tableCell.getBoundingClientRect();
  const tableContainer = tableCell.closest(".navi_table_container");
  const tableColumnResizer = tableContainer.querySelector(
    ".navi_table_column_resizer",
  );
  if (tableColumnResizer.hasAttribute("data-resizing")) {
    // ensure mouseenter/mouseleave while resizing cannot interfere
    // while resizing (would move the resizer on other columns)
    return;
  }
  const tableContainerRect = tableContainer.getBoundingClientRect();
  const tableCellLeftRelative = tableCellRect.left - tableContainerRect.left;
  const tableCellHeight = tableCellRect.height;
  const tableCellWidth = tableCellRect.width;

  const tableCellRelativeRight = tableCellLeftRelative + tableCellWidth;
  tableColumnResizer.style.setProperty(
    "--table-cell-right",
    `${tableCellRelativeRight}px`,
  );
  tableColumnResizer.style.setProperty(
    "--table-cell-height",
    `${tableCellHeight}px`,
  );
  tableColumnResizer.setAttribute("data-hover", "");
};

export const TableColumnLeftResizeHandle = ({
  columnMinWidth,
  columnMaxWidth,
  onGrab,
  onDrag,
  onRelease,
}) => {
  return (
    <div
      className="navi_table_column_resize_handle_left"
      onMouseDown={(e) => {
        if (e.button !== 0) {
          return;
        }
        e.preventDefault(); // prevent text selection
        e.stopPropagation(); // prevent drag column or drag sticky frontier
        initResizeTableColumnByMousedown(e, {
          columnMinWidth,
          columnMaxWidth,
          onGrab,
          onDrag,
          onRelease,
          isLeft: true,
        });
      }}
      onMouseEnter={(e) => {
        onMouseEnterLeftResizeHandle(e);
      }}
      onMouseLeave={(e) => {
        onMouseLeaveLeftResizeHandle(e);
      }}
    ></div>
  );
};
export const TableColumnRightResizeHandle = ({
  columnMinWidth,
  columnMaxWidth,
  onGrab,
  onDrag,
  onRelease,
}) => {
  return (
    <div
      className="navi_table_column_resize_handle_right"
      onMouseDown={(e) => {
        if (e.button !== 0) {
          return;
        }
        e.preventDefault(); // prevent text selection
        e.stopPropagation(); // prevent drag column or drag sticky frontier
        initResizeTableColumnByMousedown(e, {
          columnMinWidth,
          columnMaxWidth,
          onGrab,
          onDrag,
          onRelease,
        });
      }}
      onMouseEnter={(e) => {
        onMouseEnterRightResizeHandle(e);
      }}
      onMouseLeave={(e) => {
        onMouseLeaveRightResizeHandle(e);
      }}
    ></div>
  );
};
const onMouseEnterLeftResizeHandle = (e) => {
  const previousCell = e.target.closest("th").previousElementSibling;
  updateTableColumnResizerPosition(previousCell);
};
const onMouseEnterRightResizeHandle = (e) => {
  const cell = e.target.closest("th");
  updateTableColumnResizerPosition(cell);
};
const onMouseLeaveLeftResizeHandle = (e) => {
  const tableContainer = e.target.closest(".navi_table_container");
  const tableColumnResizer = tableContainer.querySelector(
    ".navi_table_column_resizer",
  );
  tableColumnResizer.removeAttribute("data-hover");
};
const onMouseLeaveRightResizeHandle = (e) => {
  const tableContainer = e.target.closest(".navi_table_container");
  const tableColumnResizer = tableContainer.querySelector(
    ".navi_table_column_resizer",
  );
  tableColumnResizer.removeAttribute("data-hover");
};
const initResizeTableColumnByMousedown = (
  mousedownEvent,
  { columnMinWidth, columnMaxWidth, onGrab, onDrag, onRelease, isLeft },
) => {
  let tableCell = mousedownEvent.target.closest("th");
  if (isLeft) {
    tableCell = tableCell.previousElementSibling;
  }
  const tableContainer = tableCell.closest(".navi_table_container");
  const tableColumnResizer = tableContainer.querySelector(
    ".navi_table_column_resizer",
  );

  // Calculate custom bounds for column resizing
  const tableCellRect = tableCell.getBoundingClientRect();
  const tableContainerRect = tableContainer.getBoundingClientRect();
  const currentCellLeft = tableCellRect.left - tableContainerRect.left;
  const currentCellWidth = tableCellRect.width;

  // Left bound: minimum width of 50px (can shrink column down to this width)
  const minWidth =
    typeof columnMinWidth === "number" && columnMinWidth > 50
      ? columnMinWidth
      : 50;
  // Right bound: maximum width of 1000px (can expand beyond scrollable parent if needed)
  const maxWidth =
    typeof columnMaxWidth === "number" && columnMaxWidth < 1000
      ? columnMaxWidth
      : 1000;
  const customLeftBound = currentCellLeft + minWidth;
  const maxExpandAmount = maxWidth - currentCellWidth;
  const customRightBound = currentCellLeft + currentCellWidth + maxExpandAmount;

  const dragToMoveGesture = createDragToMoveGesture({
    name: "resize-column",
    direction: { x: true },
    backdropZIndex: Z_INDEX_RESIZER_BACKDROP,
    customLeftBound,
    customRightBound,
    onGrab: () => {
      updateTableColumnResizerPosition(tableCell);
      onGrab?.();
    },
    onDrag,
    onRelease: (gesture) => {
      const newWidth = currentCellWidth + gesture.xMove;
      onRelease(newWidth, currentCellWidth);
    },
  });
  dragToMoveGesture.addTeardown(() => {
    tableColumnResizer.style.left = "";
    tableColumnResizer.removeAttribute("data-resizing");
  });

  tableColumnResizer.setAttribute("data-resizing", "");
  dragToMoveGesture.grabViaMousedown(mousedownEvent, {
    element: tableColumnResizer,
  });
};
