import { createDragToMoveGesture } from "@jsenv/dom";

import.meta.css = /* css */ `
  .navi_table_column_resize_handle_right {
    cursor: ew-resize;
    position: absolute;
    z-index: 1;
    right: 0px;
    width: 10px;
    top: 5px;
    bottom: 5px;
    background: red;
    opacity: 0;
  }
  .navi_table_column_resize_handle_right[data-hover] {
    opacity: 1;
  }

  .navi_table_column_resize_handle_left {
    cursor: ew-resize;
    position: absolute;
    z-index: 1;
    left: 0px;
    width: 10px;
    top: 5px;
    bottom: 5px;
    background: red;
    opacity: 0;
  }
  .navi_table_column_resize_handle_left[data-hover] {
    opacity: 1;
  }

  .navi_table_column_resizer {
    position: absolute;
    z-index: 1000000;
    top: 0;
    bottom: 0;
    background: grey;
    width: 10px;
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
        e.target.setAttribute("data-hover", "");
        setDataHoverOnPreviousColumnRightHandle(e, true);
      }}
      onMouseLeave={(e) => {
        e.target.removeAttribute("data-hover");
        setDataHoverOnPreviousColumnRightHandle(e, false);
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
        e.target.setAttribute("data-hover", "");
        setDataHoverOnNextColumnLeftHandle(e, true);
      }}
      onMouseLeave={(e) => {
        e.target.removeAttribute("data-hover");
        setDataHoverOnNextColumnLeftHandle(e, false);
      }}
    ></div>
  );
};
export const TableColumnResizer = ({ resizeInfo }) => {
  const { rowHeight } = resizeInfo || {};

  return (
    <div
      className="navi_table_column_resizer"
      style={{
        display: resizeInfo ? "block" : "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "0px",
          left: "-10px",
          right: "-10px",
          height: `${rowHeight}px`,
        }}
      >
        <div className="navi_table_column_resize_handle_left" data-hover></div>
        <div className="navi_table_column_resize_handle_right" data-hover></div>
      </div>
    </div>
  );
};

const setDataHoverOnPreviousColumnRightHandle = (e, isHover) => {
  const currentCell = e.target.closest("th");
  const previousCell = currentCell.previousElementSibling;
  if (previousCell) {
    const previousRightHandle = previousCell.querySelector(
      ".navi_table_column_resize_handle_right",
    );
    if (previousRightHandle) {
      if (isHover) {
        previousRightHandle.setAttribute("data-hover", "");
      } else {
        previousRightHandle.removeAttribute("data-hover");
      }
    }
  }
};
const setDataHoverOnNextColumnLeftHandle = (e, isHover) => {
  const currentCell = e.target.closest("th");
  const nextCell = currentCell.nextElementSibling;
  if (nextCell) {
    const nextLeftHandle = nextCell.querySelector(
      ".navi_table_column_resize_handle_left",
    );
    if (nextLeftHandle) {
      if (isHover) {
        nextLeftHandle.setAttribute("data-hover", "");
      } else {
        nextLeftHandle.removeAttribute("data-hover");
      }
    }
  }
};

const initResizeTableColumnByMousedown = (
  mousedownEvent,
  { onGrab, onDrag, onRelease },
) => {
  const tableColumnResizer = mousedownEvent.target
    .closest(".navi_table_container")
    .querySelector(".navi_table_column_resizer");

  const tableCell = mousedownEvent.target.closest("th");
  const rowHeight = tableCell.getBoundingClientRect().height;

  const dragToMoveGesture = createDragToMoveGesture({
    direction: { x: true },
    onGrab: () => {
      onGrab({ rowHeight });
    },
    onDrag,
    onRelease,
  });

  dragToMoveGesture.grabViaMousedown(mousedownEvent, {
    element: tableColumnResizer,
  });
};
