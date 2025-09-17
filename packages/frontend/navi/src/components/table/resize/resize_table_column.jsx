import { createDragToMoveGesture } from "@jsenv/dom";

import.meta.css = /* css */ `
  .navi_table_column_resize_handle_left,
  .navi_table_column_resize_handle_right {
    cursor: ew-resize;
    position: absolute;
    z-index: 1;
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
  }

  .navi_table_column_resizer .navi_table_column_resize_handle_left,
  .navi_table_column_resizer .navi_table_column_resize_handle_right {
    pointer-events: auto;
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
        initResizeTableColumnByMousedown(e, { onGrab, onDrag, onRelease });
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
const updateTableColumnResizerPosition = (e) => {
  const tableCell = e.target.closest("th");
  const tableCellRect = tableCell.getBoundingClientRect();
  const tableContainer = e.target.closest(".navi_table_container");
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
};

const onMouseEnterLeftResizeHandle = (e) => {
  updateTableColumnResizerPosition(e);
};
const onMouseLeaveLeftResizeHandle = () => {};

export const TableColumnRightResizeHandle = ({ onGrab, onDrag, onRelease }) => {
  return (
    <div
      className="navi_table_column_resize_handle_right"
      onMouseDown={(e) => {
        e.stopPropagation(); // prevent drag column
        initResizeTableColumnByMousedown(e, { onGrab, onDrag, onRelease });
      }}
      onMouseEnter={(e) => {
        updateTableColumnResizerPosition(e);
      }}
      onMouseLeave={() => {}}
    ></div>
  );
};
export const TableColumnResizer = () => {
  return (
    <div className="navi_table_column_resizer" data-resizing>
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
  { onGrab, onDrag, onRelease },
) => {
  const dragToMoveGesture = createDragToMoveGesture({
    direction: { x: true },
    onGrab: () => {
      //  tableColumnResizer.style.left = `${tableCellLeftRelative + tableCellWidth}px`;
      onGrab({ rowHeight: 0 });
    },
    onDrag,
    onRelease,
  });

  dragToMoveGesture.grabViaMousedown(mousedownEvent, {
    element: null,
  });
};
