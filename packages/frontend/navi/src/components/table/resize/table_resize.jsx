import {
  createDragToMoveGestureController,
  getScrollContainer,
} from "@jsenv/dom";
import { forwardRef } from "preact/compat";
import { useContext } from "preact/hooks";

import {
  Z_INDEX_RESIZER_BACKDROP,
  Z_INDEX_RESIZER_HANDLE,
} from "../z_indexes.js";
import { TableSizeContext } from "./table_size.js";

const ROW_MIN_HEIGHT = 30;
const ROW_MAX_HEIGHT = 100;
const COLUMN_MIN_WIDTH = 50;
const COLUMN_MAX_WIDTH = 500;

import.meta.css = /* css */ `
  body {
    --resizer-handle-color: #063b7c;
    --resizer-color: #387ec9;
  }

  .navi_table_cell {
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
    left: var(--table-column-resizer-left);
    width: 10px;
    top: var(--table-visual-top);
    height: var(--table-visual-height);
    opacity: 0;
  }
  .navi_table_column_resize_handle {
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
  .navi_table_column_resize_handle[data-left] {
    left: 2px;
  }
  .navi_table_column_resize_handle[data-right] {
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
    transition: opacity 0.1s ease;
  }
  .navi_table_column_resizer[data-hover],
  .navi_table_column_resizer[data-grabbed] {
    opacity: 1;
  }
  .navi_table_column_resizer[data-hover] {
    transition-delay: 150ms; /* Delay before showing hover effect */
  }
  .navi_table_column_resizer[data-grabbed] .navi_table_column_resizer_line {
    opacity: 1;
  }

  .navi_table_row_resizer {
    pointer-events: none;
    position: absolute;
    left: var(--table-visual-left);
    width: var(--table-visual-width);
    top: var(--table-row-resize-top);
    height: 10px;
    opacity: 0;
  }
  .navi_table_row_resize_handle {
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
  .navi_table_row_resize_handle[data-top] {
    top: 2px;
  }
  .navi_table_row_resize_handle[data-bottom] {
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
    transition: opacity 0.1s ease;
  }
  .navi_table_row_resizer[data-hover],
  .navi_table_row_resizer[data-grabbed] {
    opacity: 1;
  }
  .navi_table_row_resizer[data-hover] {
    transition-delay: 150ms; /* Delay before showing hover effect */
  }
  .navi_table_row_resizer[data-grabbed] .navi_table_row_resizer_line {
    opacity: 1;
  }
`;

// Column resize components
export const TableColumnResizer = forwardRef((props, ref) => {
  return (
    <div ref={ref} className="navi_table_column_resizer">
      <div className="navi_table_column_resize_handle_container">
        <div className="navi_table_column_resize_handle" data-left=""></div>
        <div className="navi_table_column_resize_handle" data-right=""></div>
      </div>
      <div className="navi_table_column_resizer_line"></div>
    </div>
  );
});
export const TableCellColumnResizeHandles = ({
  columnIndex,
  columnMinWidth,
  columnMaxWidth,
}) => {
  const { onColumnSizeChange } = useContext(TableSizeContext);
  const canResize = Boolean(onColumnSizeChange);

  return (
    <>
      {canResize && columnIndex > 0 && (
        <TableColumnLeftResizeHandle
          onRelease={(width) => onColumnSizeChange(width, columnIndex - 1)}
          columnMinWidth={columnMinWidth}
          columnMaxWidth={columnMaxWidth}
        />
      )}
      {canResize && (
        <TableColumnRightResizeHandle
          onRelease={(width) => onColumnSizeChange(width, columnIndex)}
          columnMinWidth={columnMinWidth}
          columnMaxWidth={columnMaxWidth}
        />
      )}
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
  const { columnResizerRef } = useContext(TableSizeContext);

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
          columnResizer: columnResizerRef.current,
          columnMinWidth,
          columnMaxWidth,
          onGrab,
          onDrag,
          onRelease,
          isLeft: true,
        });
      }}
      onMouseEnter={(e) => {
        onMouseEnterLeftResizeHandle(e, columnResizerRef.current);
      }}
      onMouseLeave={(e) => {
        onMouseLeaveLeftResizeHandle(e, columnResizerRef.current);
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
  const { columnResizerRef } = useContext(TableSizeContext);

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
          columnResizer: columnResizerRef.current,
          columnMinWidth,
          columnMaxWidth,
          onGrab,
          onDrag,
          onRelease,
        });
      }}
      onMouseEnter={(e) => {
        onMouseEnterRightResizeHandle(e, columnResizerRef.current);
      }}
      onMouseLeave={(e) => {
        onMouseLeaveRightResizeHandle(e, columnResizerRef.current);
      }}
    ></div>
  );
};

const updateTableColumnResizerPosition = (columnCell, columnResizer) => {
  if (columnResizer.hasAttribute("data-grabbed")) {
    // ensure mouseenter/mouseleave while resizing cannot interfere
    // while resizing (would move the resizer on other columns)
    return;
  }
  const columnCellRect = columnCell.getBoundingClientRect();
  const columnRight = columnCellRect.right;
  const cellHeight = columnCellRect.height;
  columnResizer.style.setProperty(
    "--table-column-resizer-left",
    `${columnRight}px`,
  );
  columnResizer.style.setProperty("--table-cell-height", `${cellHeight}px`);
  columnResizer.setAttribute("data-hover", "");
};
// Row resize helper functions
const updateTableRowResizerPosition = (rowCell, rowResizer) => {
  if (rowResizer.hasAttribute("data-grabbed")) {
    // ensure mouseenter/mouseleave while resizing cannot interfere
    // while resizing (would move the resizer on other rows)
    return;
  }
  const rowCellRect = rowCell.getBoundingClientRect();
  const rowBottom = rowCellRect.bottom;
  const cellWidth = rowCellRect.width;
  rowResizer.style.setProperty("--table-row-resizer-top", `${rowBottom}px`);
  rowResizer.style.setProperty("--table-cell-width", `${cellWidth}px`);
  rowResizer.setAttribute("data-hover", "");
};

const onMouseEnterLeftResizeHandle = (e, columnResizer) => {
  const previousCell =
    e.target.closest(".navi_table_cell").previousElementSibling;
  updateTableColumnResizerPosition(previousCell, columnResizer);
};
const onMouseEnterRightResizeHandle = (e, columnResizer) => {
  const cell = e.target.closest(".navi_table_cell");
  updateTableColumnResizerPosition(cell, columnResizer);
};
const onMouseLeaveLeftResizeHandle = (e, columnResizer) => {
  columnResizer.removeAttribute("data-hover");
};
const onMouseLeaveRightResizeHandle = (e, columnResizer) => {
  columnResizer.removeAttribute("data-hover");
};
// Generic function to handle table cell resize for both axes
const initResizeByMousedown = (
  mousedownEvent,
  {
    tableCell,
    resizer,
    minSize,
    maxSize,
    onGrab,
    onDrag,
    onRelease,
    // Axis-specific configuration
    axis, // 'x' or 'y'
  },
) => {
  const updateResizerPosition =
    axis === "x"
      ? updateTableColumnResizerPosition
      : updateTableRowResizerPosition;

  const tableCellRect = tableCell.getBoundingClientRect();
  // Calculate size and position based on axis
  const currentSize = axis === "x" ? tableCellRect.width : tableCellRect.height;

  // Convert constraint bounds to scroll container coordinates
  // (Same as boundingClientRect + document scrolls but within the scroll container)
  const { customAreaConstraint, areaConstraint } = (() => {
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

    const scrollContainer = getScrollContainer(tableCell);
    const { left, top } = tableCell.getBoundingClientRect();
    const { scrollLeft, scrollTop } = scrollContainer;
    const cellStart = axis === "x" ? scrollLeft + left : scrollTop + top;
    const customStartBound = cellStart + minCellSize;
    const customEndBound = cellStart + maxCellSize;
    const isSticky =
      axis === "x"
        ? tableCell.hasAttribute("data-sticky-left")
        : tableCell.hasAttribute("data-sticky-top");

    if (axis === "x") {
      return {
        areaConstraint: isSticky ? "visible" : "none",
        customAreaConstraint: { left: customStartBound, right: customEndBound },
      };
    }
    return {
      areaConstraint: isSticky ? "visible" : "none",
      customAreaConstraint: { top: customStartBound, bottom: customEndBound },
    };
  })();

  // Build drag gesture configuration based on axis
  const gestureName = axis === "x" ? "resize-column" : "resize-row";
  const direction = axis === "x" ? { x: true } : { y: true };

  updateResizerPosition(tableCell, resizer);
  const dragToMoveGestureController = createDragToMoveGestureController({
    name: gestureName,
    direction,
    backdropZIndex: Z_INDEX_RESIZER_BACKDROP,
    areaConstraint,
    customAreaConstraint,
    visibleAreaPadding: 20,
    onGrab: () => {
      onGrab?.();
    },
    onDrag,
    onRelease: (gestureInfo) => {
      const styleProperty = axis === "x" ? "left" : "top";
      resizer.style[styleProperty] = "";
      const sizeChange = axis === "x" ? gestureInfo.moveX : gestureInfo.moveY;
      const newSize = currentSize + sizeChange;
      onRelease(newSize, currentSize);
    },
  });
  dragToMoveGestureController.grabViaMouse(mousedownEvent, {
    element: resizer,
    referenceElement: tableCell,
  });
};

const initResizeTableColumnByMousedown = (
  mousedownEvent,
  {
    columnResizer,
    columnMinWidth,
    columnMaxWidth,
    onGrab,
    onDrag,
    onRelease,
    isLeft,
  },
) => {
  let tableCell = mousedownEvent.target.closest(".navi_table_cell");
  if (isLeft) {
    tableCell = tableCell.previousElementSibling;
  }
  initResizeByMousedown(mousedownEvent, {
    tableCell,
    resizer: columnResizer,
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
  { rowResizer, rowMinHeight, rowMaxHeight, onGrab, onDrag, onRelease, isTop },
) => {
  let tableCell = mousedownEvent.target.closest(".navi_table_cell");
  if (isTop) {
    const tableRow = tableCell.closest(".navi_tr");
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
    resizer: rowResizer,
    minSize: rowMinHeight,
    maxSize: rowMaxHeight,
    onGrab,
    onDrag,
    onRelease,
    axis: "y",
  });
};

// Row resize components
export const TableRowResizer = forwardRef((props, ref) => {
  return (
    <div ref={ref} className="navi_table_row_resizer">
      <div className="navi_table_row_resize_handle_container">
        <div className="navi_table_row_resize_handle" data-top=""></div>
        <div className="navi_table_row_resize_handle" data-bottom=""></div>
      </div>
      <div className="navi_table_row_resizer_line"></div>
    </div>
  );
});
export const TableCellRowResizeHandles = ({
  rowIndex,
  rowMinHeight,
  rowMaxHeight,
}) => {
  const { onRowSizeChange } = useContext(TableSizeContext);
  const canResize = Boolean(onRowSizeChange);

  return (
    <>
      {canResize && rowIndex > 0 && (
        <TableRowTopResizeHandle
          onRelease={(width) => onRowSizeChange(width, rowIndex - 1)}
          rowMinHeight={rowMinHeight}
          rowMaxHeight={rowMaxHeight}
        />
      )}
      {canResize && (
        <TableRowBottomResizeHandle
          onRelease={(width) => onRowSizeChange(width, rowIndex)}
          rowMinHeight={rowMinHeight}
          rowMaxHeight={rowMaxHeight}
        />
      )}
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
  const { rowResizerRef } = useContext(TableSizeContext);

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
          rowResizer: rowResizerRef.current,
          rowMinHeight,
          rowMaxHeight,
          onGrab,
          onDrag,
          onRelease,
          isTop: true,
        });
      }}
      onMouseEnter={(e) => {
        onMouseEnterTopResizeHandle(e, rowResizerRef.current);
      }}
      onMouseLeave={(e) => {
        onMouseLeaveTopResizeHandle(e, rowResizerRef.current);
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
  const { rowResizerRef } = useContext(TableSizeContext);

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
          rowResizer: rowResizerRef.current,
          rowMinHeight,
          rowMaxHeight,
          onGrab,
          onDrag,
          onRelease,
        });
      }}
      onMouseEnter={(e) => {
        onMouseEnterBottomResizeHandle(e, rowResizerRef.current);
      }}
      onMouseLeave={(e) => {
        onMouseLeaveBottomResizeHandle(e, rowResizerRef.current);
      }}
    ></div>
  );
};

const onMouseEnterTopResizeHandle = (e, rowResize) => {
  const currentRow = e.target.closest(".navi_tr");
  const previousRow = findPreviousTableRow(currentRow);
  if (previousRow) {
    updateTableRowResizerPosition(
      previousRow.querySelector(".navi_table_cell"),
      rowResize,
    );
  }
};
const onMouseEnterBottomResizeHandle = (e, rowResizer) => {
  const rowCell = e.target.closest(".navi_table_cell");
  updateTableRowResizerPosition(rowCell, rowResizer);
};
const onMouseLeaveTopResizeHandle = (e, rowResizer) => {
  rowResizer.removeAttribute("data-hover");
};
const onMouseLeaveBottomResizeHandle = (e, rowResizer) => {
  rowResizer.removeAttribute("data-hover");
};

const findPreviousTableRow = (currentRow) => {
  // First, try to find previous sibling within the same table section
  const previousSibling = currentRow.previousElementSibling;
  if (previousSibling) {
    return previousSibling;
  }

  // Otherwise, get all rows in the table and find the previous one
  const table = currentRow.closest(".navi_table");
  const allRows = Array.from(table.querySelectorAll(".navi_tr"));
  const currentIndex = allRows.indexOf(currentRow);
  return currentIndex > 0 ? allRows[currentIndex - 1] : null;
};
