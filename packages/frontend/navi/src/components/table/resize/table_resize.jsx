import { createDragToMoveGesture, getScrollableParent } from "@jsenv/dom";

import {
  Z_INDEX_RESIZER_BACKDROP,
  Z_INDEX_RESIZER_HANDLE,
} from "../z_indexes.js";
import { useTableSizeController } from "./table_size_context.js";

const ROW_MIN_HEIGHT = 30;
const ROW_MAX_HEIGHT = 100;
const COLUMN_MIN_WIDTH = 50;
const COLUMN_MAX_WIDTH = 500;

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
    top: var(--table-scroll-top, 0);
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
    left: var(--table-scroll-left, 0);
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
export const TableCellColumnResizeHandles = ({
  columnIndex,
  columnMinWidth,
  columnMaxWidth,
}) => {
  const { onColumnSizeChange } = useTableSizeController();

  return (
    <>
      {columnIndex > 0 && (
        <TableColumnLeftResizeHandle
          onRelease={(width) => onColumnSizeChange(width, columnIndex - 1)}
          columnMinWidth={columnMinWidth}
          columnMaxWidth={columnMaxWidth}
        />
      )}
      <TableColumnRightResizeHandle
        onRelease={(width) => onColumnSizeChange(width, columnIndex)}
        columnMinWidth={columnMinWidth}
        columnMaxWidth={columnMaxWidth}
      />
    </>
  );
};
const TableColumnLeftResizeHandle = ({
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
const TableColumnRightResizeHandle = ({
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

  const table = tableCell.closest("table");
  const scrollTop = getScrollableParent(table).scrollTop;
  tableColumnResizer.style.setProperty("--table-scroll-top", `${scrollTop}px`);

  tableColumnResizer.setAttribute("data-hover", "");
};
const onMouseEnterLeftResizeHandle = (e) => {
  const previousCell = e.target.closest("th,td").previousElementSibling;
  updateTableColumnResizerPosition(previousCell);
};
const onMouseEnterRightResizeHandle = (e) => {
  const cell = e.target.closest("th,td");
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
// Generic function to handle table cell resize for both axes
const initResizeByMousedown = (
  mousedownEvent,
  {
    tableCell,
    minSize,
    maxSize,
    onGrab,
    onDrag,
    onRelease,
    // Axis-specific configuration
    axis, // 'x' or 'y'
  },
) => {
  const table = tableCell.closest("table");
  const tableContainer = table.closest(".navi_table_container");
  const resizerSelector =
    axis === "x" ? ".navi_table_column_resizer" : ".navi_table_row_resizer";
  const resizer = tableContainer.querySelector(resizerSelector);
  const updateResizerPosition =
    axis === "x"
      ? updateTableColumnResizerPosition
      : updateTableRowResizerPosition;

  // Detect sticky positioning for advanced constraint handling
  const isSticky =
    axis === "x"
      ? tableCell.hasAttribute("data-sticky-left")
      : tableCell.hasAttribute("data-sticky-top");
  const scrollableParent = getScrollableParent(table);
  const scrollableParentRect = scrollableParent.getBoundingClientRect();
  const tableCellRect = tableCell.getBoundingClientRect();
  const tableContainerRect = tableContainer.getBoundingClientRect();

  // Calculate size and position based on axis
  const currentSize = axis === "x" ? tableCellRect.width : tableCellRect.height;
  const cellStartRelative = isSticky
    ? axis === "x"
      ? tableCellRect.left - scrollableParentRect.left
      : tableCellRect.top - scrollableParentRect.top
    : axis === "x"
      ? tableCellRect.left - tableContainerRect.left
      : tableCellRect.top - tableContainerRect.top;

  // Calculate bounds based on axis
  const defaultMinSize = axis === "x" ? COLUMN_MIN_WIDTH : ROW_MIN_HEIGHT;
  const defaultMaxSize = axis === "x" ? COLUMN_MAX_WIDTH : ROW_MAX_HEIGHT;

  const minCellSize =
    typeof minSize === "number" && minSize > defaultMinSize
      ? minSize
      : defaultMinSize;
  const maxCellSize =
    typeof maxSize === "number" && maxSize < defaultMaxSize
      ? maxSize
      : defaultMaxSize;

  let customStartBound = cellStartRelative + minCellSize;
  const maxExpandAmount = maxCellSize - currentSize;
  let customEndBound = cellStartRelative + currentSize + maxExpandAmount;

  if (isSticky) {
    const scrollOffset =
      axis === "x" ? scrollableParent.scrollLeft : scrollableParent.scrollTop;
    customStartBound += scrollOffset;
    customEndBound += scrollOffset;
  }

  // Build drag gesture configuration based on axis
  const gestureName = axis === "x" ? "resize-column" : "resize-row";
  const direction = axis === "x" ? { x: true } : { y: true };
  const customAreaConstraint =
    axis === "x"
      ? { left: customStartBound, right: customEndBound }
      : { top: customStartBound, bottom: customEndBound };

  const dragToMoveGesture = createDragToMoveGesture({
    name: gestureName,
    direction,
    backdropZIndex: Z_INDEX_RESIZER_BACKDROP,
    areaConstraint: isSticky ? "visible" : "none",
    customAreaConstraint,
    onGrab: () => {
      updateResizerPosition(tableCell);
      onGrab?.();
    },
    onDrag,
    onRelease: (gesture) => {
      const sizeChange = axis === "x" ? gesture.xMove : gesture.yMove;
      const newSize = currentSize + sizeChange;
      onRelease(newSize, currentSize);
    },
  });

  dragToMoveGesture.addTeardown(() => {
    const styleProperty = axis === "x" ? "left" : "top";
    resizer.style[styleProperty] = "";
    resizer.removeAttribute("data-resizing");
  });

  resizer.setAttribute("data-resizing", "");
  dragToMoveGesture.grabViaMousedown(mousedownEvent, {
    element: resizer,
  });
};

const initResizeTableColumnByMousedown = (
  mousedownEvent,
  { columnMinWidth, columnMaxWidth, onGrab, onDrag, onRelease, isLeft },
) => {
  let tableCell = mousedownEvent.target.closest("th,td");
  if (isLeft) {
    tableCell = tableCell.previousElementSibling;
  }
  initResizeByMousedown(mousedownEvent, {
    tableCell,
    minSize: columnMinWidth,
    maxSize: columnMaxWidth,
    onGrab,
    onDrag,
    onRelease,
    axis: "x",
  });
};

const initResizeTableRowByMousedown = (
  mousedownEvent,
  { rowMinHeight, rowMaxHeight, onGrab, onDrag, onRelease, isTop },
) => {
  let tableCell = mousedownEvent.target.closest("th,td");
  if (isTop) {
    const tableRow = tableCell.closest("tr");
    const previousTr = findPreviousTableRow(tableRow);
    if (!previousTr) {
      return;
    }
    // Select the same table cell (same column index) in previous row
    const columnIndex = Array.from(tableRow.children).indexOf(tableCell);
    tableCell = previousTr.children[columnIndex];
  }
  initResizeByMousedown(mousedownEvent, {
    tableCell,
    minSize: rowMinHeight,
    maxSize: rowMaxHeight,
    onGrab,
    onDrag,
    onRelease,
    axis: "y",
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
export const TableCellRowResizeHandles = ({
  rowIndex,
  rowMinHeight,
  rowMaxHeight,
}) => {
  const { onRowSizeChange } = useTableSizeController();

  return (
    <>
      {rowIndex > 0 && (
        <TableRowTopResizeHandle
          onRelease={(width) => onRowSizeChange(width, rowIndex - 1)}
          rowMinHeight={rowMinHeight}
          rowMaxHeight={rowMaxHeight}
        />
      )}
      <TableRowBottomResizeHandle
        onRelease={(width) => onRowSizeChange(width, rowIndex)}
        rowMinHeight={rowMinHeight}
        rowMaxHeight={rowMaxHeight}
      />
    </>
  );
};
const TableRowTopResizeHandle = ({
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
const TableRowBottomResizeHandle = ({
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
  const tableRowCellWidth = tableRowCellRect.width;
  const tableRowCellHeight = tableRowCellRect.height;
  const tableRowRelativeBottom = tableRowTopRelative + tableRowCellHeight;
  tableRowResizer.style.setProperty(
    "--table-cell-bottom",
    `${tableRowRelativeBottom}px`,
  );
  tableRowResizer.style.setProperty(
    "--table-cell-width",
    `${tableRowCellWidth}px`,
  );

  const table = rowCell.closest("table");
  const scrollLeft = getScrollableParent(table).scrollLeft;
  tableRowResizer.style.setProperty("--table-scroll-left", `${scrollLeft}px`);

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
