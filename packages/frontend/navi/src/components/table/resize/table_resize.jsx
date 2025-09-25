import { createDragToMoveGesture } from "@jsenv/dom";
import {
  Z_INDEX_RESIZER_BACKDROP,
  Z_INDEX_RESIZER_HANDLE,
} from "../z_indexes.js";

const ROW_MIN_HEIGHT = 30;

import.meta.css = /* css */ `
  .navi_table_container {
    --resizer-handle-color: #444746;
    --resizer-color: #c0c0c0;
  }

  .navi_table th,
  .navi_table td {
    /* ensure table cell padding does not count when we say column = 50px we want a column of 50px, not 50px + paddings */
    box-sizing: border-box;
  }

  .navi_table_cell_resize_handle {
    position: absolute;
    /* background: orange; */
    /* opacity: 0.5; */
    z-index: ${Z_INDEX_RESIZER_HANDLE};
  }
  .navi_table_cell_resize_handle[data-left],
  .navi_table_cell_resize_handle[data-right] {
    cursor: ew-resize;
    top: 0;
    bottom: 0;
    width: 8px;
  }
  .navi_table_cell_resize_handle[data-left] {
    left: 0;
  }
  .navi_table_cell_resize_handle[data-right] {
    right: 0;
  }

  .navi_table_cell_resize_handle[data-top],
  .navi_table_cell_resize_handle[data-bottom] {
    cursor: ns-resize;
    left: 0;
    right: 0;
    height: 8px;
  }
  .navi_table_cell_resize_handle[data-top] {
    top: 0;
  }
  .navi_table_cell_resize_handle[data-bottom] {
    bottom: 0;
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
  .navi_table_column_resizer .navi_table_column_resize_handle {
    position: absolute;
    height: 100%;
    top: 50%;
    transform: translateY(-50%);
    border-radius: 15px;
    background: var(--resizer-handle-color);
    /* opacity: 0.5; */
    width: 5px;
    height: 26px;
    max-height: 80%;
  }
  .navi_table_column_resizer .navi_table_column_resize_handle[data-left] {
    left: 2px;
  }
  .navi_table_column_resizer .navi_table_column_resize_handle[data-right] {
    right: 3px;
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
    width: 5px;
    left: -3px;
    background: var(--resizer-color);
    opacity: 0;
  }
  .navi_table_column_resizer[data-hover],
  .navi_table_column_resizer[data-resizing] {
    opacity: 1;
  }
  .navi_table_column_resizer[data-resizing] .navi_table_column_resizer_line {
    opacity: 1;
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
  .navi_table_row_resizer .navi_table_row_resize_handle {
    position: absolute;
    width: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 15px;
    background: var(--resizer-handle-color);
    /* opacity: 0.5; */
    width: 26px;
    height: 5px;
    max-width: 80%;
  }
  .navi_table_row_resizer .navi_table_row_resize_handle[data-top] {
    top: 2px;
  }
  .navi_table_row_resizer .navi_table_row_resize_handle[data-bottom] {
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
    background: var(--resizer-color);
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

// Column resize components
export const TableColumnResizer = () => {
  return (
    <div className="navi_table_column_resizer">
      <div className="navi_table_column_resize_handle_container">
        <div className="navi_table_column_resize_handle" data-left=""></div>
        <div className="navi_table_column_resize_handle" data-right=""></div>
      </div>
      <div className="navi_table_column_resizer_line"></div>
    </div>
  );
};
export const TableCellResizeHandles = ({
  columnIndex,
  columnMinWidth,
  columnMaxWidth,
  onResizeRequested,
}) => {
  return (
    <>
      {columnIndex > 0 && (
        <TableColumnLeftResizeHandle
          onRelease={(width) => onResizeRequested(width, columnIndex - 1)}
          columnMinWidth={columnMinWidth}
          columnMaxWidth={columnMaxWidth}
        />
      )}
      <TableColumnRightResizeHandle
        onRelease={(width) => onResizeRequested(width, columnIndex)}
        columnMinWidth={columnMinWidth}
        columnMaxWidth={columnMaxWidth}
      />
    </>
  );
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
      className="navi_table_cell_resize_handle"
      data-left=""
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
      className="navi_table_cell_resize_handle"
      data-right=""
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
// Column resize helper functions
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

  const tableCellRect = tableCell.getBoundingClientRect();
  const tableCellWidth = tableCellRect.width;
  const tableContainerRect = tableContainer.getBoundingClientRect();
  const cellLeftRelative = tableCellRect.left - tableContainerRect.left;
  const minLeft = cellLeftRelative;

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
  const customLeftBound = minLeft + minWidth;
  const maxExpandAmount = maxWidth - tableCellWidth;
  const customRightBound = minLeft + tableCellWidth + maxExpandAmount;

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
      const newWidth = tableCellWidth + gesture.xMove;
      onRelease(newWidth, tableCellWidth);
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

// Row resize components
export const TableRowResizer = () => {
  return (
    <div className="navi_table_row_resizer">
      <div className="navi_table_row_resize_handle_container">
        <div className="navi_table_row_resize_handle" data-top=""></div>
        <div className="navi_table_row_resize_handle" data-bottom=""></div>
      </div>
      <div className="navi_table_row_resizer_line"></div>
    </div>
  );
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
      className="navi_table_cell_resize_handle"
      data-top=""
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
      className="navi_table_cell_resize_handle"
      data-bottom=""
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

// Row resize helper functions
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
  // Bottom bound: maximum height of 300px (can expand beyond scrollable parent if needed)
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
      updateTableRowResizerPosition(tableCell);
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
