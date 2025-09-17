import { createDragToMoveGesture } from "@jsenv/dom";

import.meta.css = /* css */ `
  .navi_table_column_resize_handle_left,
  .navi_table_column_resize_handle_right {
    cursor: ew-resize;
    position: absolute;
    width: 7px;
    height: 22px;
    top: 50%;
    transform: translateY(-50%);
    background: orange;
    border-radius: 15px;
    opacity: 0.5;
  }
  .navi_table_column_resize_handle_left {
    left: 0px;
  }
  .navi_table_column_resize_handle_right {
    right: 0px;
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
    background: #444746;
    opacity: 0.5;
    width: 4px;
  }
  .navi_table_column_resizer .navi_table_column_resize_handle_left {
    left: 3px;
  }
  .navi_table_column_resizer .navi_table_column_resize_handle_right {
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

export const TableColumnLeftResizeHandle = ({ onGrab, onDrag, onRelease }) => {
  return (
    <div
      className="navi_table_column_resize_handle_left"
      onMouseDown={(e) => {
        e.stopPropagation(); // prevent drag column
        initResizeTableColumnByMousedown(e, {
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
export const TableColumnRightResizeHandle = ({ onGrab, onDrag, onRelease }) => {
  return (
    <div
      className="navi_table_column_resize_handle_right"
      onMouseDown={(e) => {
        e.stopPropagation(); // prevent drag column
        initResizeTableColumnByMousedown(e, { onGrab, onDrag, onRelease });
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

const updateTableColumnResizerPosition = (tableCell) => {
  const tableCellRect = tableCell.getBoundingClientRect();
  const tableContainer = tableCell.closest(".navi_table_container");
  const tableColumnResizer = tableContainer.querySelector(
    ".navi_table_column_resizer",
  );
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

export const TableColumnResizer = () => {
  return (
    <div className="navi_table_column_resizer">
      <div className="navi_table_column_resize_handle_container">
        <div className="navi_table_column_resize_handle_left" data-hover></div>
        <div className="navi_table_column_resize_handle_right" data-hover></div>
      </div>
      <div className="navi_table_column_resizer_line"></div>
    </div>
  );
};

const initResizeTableColumnByMousedown = (
  mousedownEvent,
  { onGrab, onDrag, onRelease, isLeft },
) => {
  let tableCell = mousedownEvent.target.closest("th");
  if (isLeft) {
    tableCell = tableCell.previousElementSibling;
  }
  const tableContainer = tableCell.closest(".navi_table_container");
  const tableColumnResizer = tableContainer.querySelector(
    ".navi_table_column_resizer",
  );
  const dragToMoveGesture = createDragToMoveGesture({
    direction: { x: true },
    onGrab: () => {
      updateTableColumnResizerPosition(tableCell);
      onGrab({ rowHeight: 0 });
    },
    onDrag,
    onRelease,
  });
  dragToMoveGesture.addTeardown(() => {
    tableColumnResizer.style.left = "";
    tableColumnResizer.removeAttribute("data-resizing");
  });

  // (column.minWidth default to 50)
  // a droite pas de limite (enfin disons columnmaxWidth default to 1000)
  tableColumnResizer.setAttribute("data-resizing", "");
  dragToMoveGesture.grabViaMousedown(mousedownEvent, {
    element: tableColumnResizer,
  });
};
