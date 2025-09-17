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
`;

export const TableColumnLeftResizeHandle = () => {
  return (
    <div
      className="navi_table_column_resize_handle_left"
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
export const TableColumnRightResizeHandle = () => {
  return (
    <div
      className="navi_table_column_resize_handle_right"
      onMouseDown={(e) => {
        e.stopPropagation(); // prevent drag column
        initResizeTableColumnByMousedown(e);
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

const initResizeTableColumnByMousedown = () => {};
